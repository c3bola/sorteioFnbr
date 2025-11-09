const { Markup } = require('telegraf');
const db = require('../data/database');
const { isAdmin } = require('../utils/utils');
const Logger = require('../utils/logger');
const { parseCaptionInfo } = require('../utils/captionParser');
const raffleMetadata = require('../utils/raffleMetadata');

/**
 * Helper para responder callback queries ignorando erros de timeout
 */
async function safeAnswerCbQuery(ctx, text, options = {}) {
  try {
    await ctx.answerCbQuery(text, options);
  } catch (error) {
    if (error.response?.error_code === 400 && error.response?.description?.includes('too old')) {
      console.log('[CALLBACK] Query muito antiga, ignorando resposta');
    } else {
      console.error('[CALLBACK] Erro ao responder:', error.message);
    }
  }
}

function setupActionHandlers(bot) {
  const logger = new Logger(bot);

  bot.action(/participar_(.+)/, async (ctx) => {
    console.log(ctx.callbackQuery.message.caption);
    try {
      const raffleId = ctx.match[1];
      const groupId = ctx.chat.id;
      const userId = ctx.from.id;
      const userName = ctx.from.first_name;

      console.log(`[PARTICIPAÇÃO] Iniciando - User: ${userId} (${userName}), Raffle: ${raffleId}, Group: ${groupId}`);

      // Verificar se o sorteio existe, se não criar
      const raffleCheck = await db.query('SELECT idRafflesDetails FROM tbRafflesDetails WHERE idRafflesDetails = ?', [raffleId]);
      
      if (!raffleCheck || raffleCheck.length === 0) {
        console.log(`[PARTICIPAÇÃO] Criando sorteio ${raffleId}`);
        
        // Extrair informações da legenda
        const caption = ctx.callbackQuery.message.caption || '';
        const captionInfo = parseCaptionInfo(caption);
        
        console.log(`[PARTICIPAÇÃO] Informações extraídas:`, captionInfo);
        
        // Criar sorteio se não existir (versão antiga da procedure com 4 parâmetros)
        await db.callProcedure('sp_create_raffle', [
          raffleId,
          groupId,
          1, // numWinners padrão
          caption || 'Sorteio via botão inline'
        ]);

        // Salvar informações estruturadas como metadata
        await raffleMetadata.saveCaptionInfo(raffleId, captionInfo);
      }

      // Registrar participação usando a procedure
      try {
        console.log(`[PARTICIPAÇÃO] Chamando sp_register_participation`);
        const result = await db.callProcedure('sp_register_participation', [
          raffleId,
          userId,
          userName,
          groupId
        ]);
        console.log(`[PARTICIPAÇÃO] Procedure executada com sucesso:`, result);
        
        // Verificar se realmente foi registrado
        const verifyResult = await db.query(
          'SELECT COUNT(*) as count FROM tbRaffles WHERE fkIdRafflesDetails = ? AND fkIdUser = ?',
          [raffleId, userId]
        );
        console.log(`[PARTICIPAÇÃO] Verificação no banco: ${verifyResult[0].count} registro(s) encontrado(s)`);
        
        if (verifyResult[0].count > 0) {
          await safeAnswerCbQuery(ctx, `${userName} está participando do sorteio!`, { show_alert: true });
        } else {
          console.error(`[PARTICIPAÇÃO ERRO] Procedure executou mas não gravou no banco!`);
          await safeAnswerCbQuery(ctx, '❌ Erro ao registrar participação. Tente novamente.', { show_alert: true });
          return;
        }
      } catch (error) {
        if (error.message.includes('Assinatura')) {
          // Erro de assinatura
          console.log(`[PARTICIPAÇÃO] Assinatura necessária - User: ${userId}`);
          await safeAnswerCbQuery(ctx, error.message, { show_alert: true });
          return;
        } else if (error.code === 'ER_DUP_ENTRY') {
          // Usuário já está participando (comportamento esperado)
          console.log(`[PARTICIPAÇÃO] Duplicada ignorada - User: ${userId} (${userName}), Raffle: ${raffleId}`);
          await safeAnswerCbQuery(ctx, 'Você já está participando do sorteio.', { show_alert: true });
          return;
        } else {
          // Erro inesperado - logar completo
          console.error(`[PARTICIPAÇÃO ERRO]`, error);
          await safeAnswerCbQuery(ctx, '❌ Erro ao processar participação.', { show_alert: true });
          return;
        }
      }

      // Buscar número de participantes atualizado
      const countResult = await db.query(
        'SELECT participantCount FROM tbRafflesDetails WHERE idRafflesDetails = ?',
        [raffleId]
      );
      const numParticipants = countResult[0]?.participantCount || 0;

      // Atualizar caption com número de participantes
      let originalCaption = ctx.callbackQuery.message.caption;
      let newCaption;
      
      if (!originalCaption.includes('Participantes:')) {
        // Primeira participação - adicionar linha de participantes
        newCaption = `${originalCaption}\n\nParticipantes: ${numParticipants}`;
      } else {
        // Atualizar contador existente usando regex para substituir o número
        newCaption = originalCaption.replace(/Participantes:\s*\d+/, `Participantes: ${numParticipants}`);
      }

      if (newCaption !== ctx.callbackQuery.message.caption) {
        ctx.editMessageCaption(newCaption, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('Participar do sorteio', `participar_${raffleId}`)],
            [Markup.button.callback('Sortear (apenas adm)', `sortear_${raffleId}_${numParticipants}`)],
            [Markup.button.callback('❌ Cancelar sorteio', `cancelar_${raffleId}`)]
          ])
        }).catch((error) => {
          if (error.response && error.response.error_code === 400 && error.response.description.includes('message is not modified')) {
            console.warn('Message is not modified:', error);
          } else {
            console.error('Error editing message caption:', error);
          }
        });
      }

      // Log apenas a cada 10 participantes para não encher o log
      if (numParticipants % 10 === 0) {
        await logger.logRaffle(
          `📊 **Milestone de participação**\n\n` +
          `🎯 Sorteio: \`${raffleId}\`\n` +
          `👥 Total de participantes: ${numParticipants}\n` +
          `💬 Grupo: ${ctx.chat.title || 'Desconhecido'}\n` +
          `📅 Data: ${new Date().toLocaleString('pt-BR')}`
        );
      }
    } catch (error) {
      console.error('Error handling participar action:', error);
      await safeAnswerCbQuery(ctx, 'Ocorreu um erro ao participar do sorteio.', { show_alert: true });
    }
  });

  bot.action(/sortear_(.+)_(\d+)/, async (ctx) => {
    try {
      const raffleId = ctx.match[1];
      const groupId = ctx.chat.id;
      const userId = ctx.from.id;

      // Verificar se é admin com permissão no grupo
      const adminCheck = await db.callProcedure('sp_check_admin_permission', [userId, groupId]);

      if (!adminCheck || adminCheck.length === 0) {
        return ctx.answerCbQuery('❌ Apenas administradores podem realizar o sorteio.', { show_alert: true });
      }

      // Buscar participantes elegíveis usando a procedure (com modificador de sorte)
      const eligibleParticipants = await db.callProcedure('sp_get_eligible_participants', [
        raffleId,
        groupId
      ]);

      if (!eligibleParticipants || eligibleParticipants.length === 0) {
        return ctx.answerCbQuery('Não há participantes no sorteio.', { show_alert: true });
      }

      // Buscar número de vencedores do sorteio
      const raffleInfo = await db.query(
        'SELECT numWinners FROM tbRafflesDetails WHERE idRafflesDetails = ?',
        [raffleId]
      );
      const numWinners = raffleInfo[0]?.numWinners || 1;

      // Sortear vencedores usando o modificador de sorte (luck_modifier)
      // Participantes com menos vitórias têm maior chance
      const winners = [];
      const pool = [...eligibleParticipants];

      for (let i = 0; i < numWinners && pool.length > 0; i++) {
        // Criar pool ponderado baseado no luck_modifier
        const weightedPool = [];
        pool.forEach(participant => {
          const weight = Math.round(participant.luck_modifier * 100);
          for (let j = 0; j < weight; j++) {
            weightedPool.push(participant);
          }
        });

        // Selecionar vencedor aleatório do pool ponderado
        const randomIndex = Math.floor(Math.random() * weightedPool.length);
        const winner = weightedPool[randomIndex];

        // Adicionar vencedor e remover do pool
        winners.push(winner);
        const winnerIdx = pool.findIndex(p => p.user_id === winner.user_id);
        if (winnerIdx > -1) {
          pool.splice(winnerIdx, 1);
        }

        // Registrar vencedor no banco
        await db.callProcedure('sp_register_winner', [
          raffleId,
          winner.user_id,
          i + 1,
          groupId
        ]);
      }

      // Fechar o sorteio
      await db.callProcedure('sp_close_raffle', [raffleId]);

      if (winners.length > 0) {
        const winnerNames = winners.map(w => `<a href="tg://user?id=${w.user_id}">${w.name}</a>`).join('\n');
        const winnerText = winners.length === 1 ? 'O vencedor é' : 'Os vencedores são';
        const dateTime = new Date().toLocaleString('pt-BR');
        const originalCaption = ctx.callbackQuery.message.caption;
        
        ctx.editMessageCaption(`${originalCaption}\n\n${winnerText}:\n${winnerNames}\n\nSorteio realizado em: ${dateTime}`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([])
        }).catch((error) => {
          if (error.response && error.response.error_code === 400 && error.response.description.includes('message is not modified')) {
            console.warn('Message is not modified:', error);
          } else {
            console.error('Error editing message caption:', error);
          }
        });
        
        ctx.answerCbQuery('Sorteio finalizado!', { show_alert: true });
        ctx.replyWithHTML(`Parabéns aos vencedores:\n${winnerNames}`);

        // Notificar cada vencedor no privado
        const groupName = ctx.chat.title || 'Grupo';
        const raffleCaption = originalCaption.split('\n')[0] || 'Sorteio';
        
        for (let i = 0; i < winners.length; i++) {
          const winner = winners[i];
          try {
            await bot.telegram.sendMessage(
              winner.user_id,
              `🎉 *Parabéns! Você ganhou um sorteio!*\n\n` +
              `🏆 *Posição:* ${i + 1}º lugar\n` +
              `📝 *Sorteio:* ${raffleCaption}\n` +
              `💬 *Grupo:* ${groupName}\n` +
              `📅 *Data:* ${dateTime}\n\n` +
              `✨ Entre em contato com os administradores para resgatar seu prêmio!`,
              { parse_mode: 'Markdown' }
            );
            console.log(`[SORTEAR] Vencedor ${winner.user_id} (${winner.name}) notificado com sucesso`);
          } catch (error) {
            console.log(`[SORTEAR] Não foi possível notificar o vencedor ${winner.user_id} (${winner.name}):`, error.message);
            // Continuar mesmo se não conseguir notificar
          }
        }

        // Enviar log do sorteio realizado
        await logger.logRaffle(
          `🎊 **Sorteio finalizado**\n\n` +
          `🎯 ID: \`${raffleId}\`\n` +
          `👥 Participantes: ${eligibleParticipants.length}\n` +
          `🏆 Vencedores: ${winners.length}\n` +
          `${winners.map((w, i) => `${i + 1}º - ${w.name} (\`${w.user_id}\`)`).join('\n')}\n\n` +
          `💬 Grupo: ${ctx.chat.title || 'Desconhecido'}\n` +
          `👮 Sorteado por: ${ctx.from.first_name || ctx.from.username} (\`${ctx.from.id}\`)\n` +
          `📅 Data: ${dateTime}`
        );
      } else {
        ctx.answerCbQuery('Não foi possível selecionar vencedores.', { show_alert: true });
        
        // Log de erro
        await logger.logError(
          `⚠️ **Nenhum vencedor selecionado**\n\n` +
          `🎯 Sorteio: \`${raffleId}\`\n` +
          `👥 Participantes: ${eligibleParticipants.length}\n` +
          `💬 Grupo: ${ctx.chat.title || 'Desconhecido'}\n` +
          `👮 Tentativa por: ${ctx.from.first_name || ctx.from.username}\n` +
          `📅 Data: ${new Date().toLocaleString('pt-BR')}`
        );
      }
    } catch (error) {
      console.error('Error handling sortear action:', error);
      
      // Log de erro
      await logger.logError(
        `❌ **Erro ao realizar sorteio**\n\n` +
        `🎯 Sorteio: \`${raffleId}\`\n` +
        `👤 Usuário: ${ctx.from.first_name || ctx.from.username} (\`${ctx.from.id}\`)\n` +
        `💬 Grupo: ${ctx.chat.title || 'Desconhecido'}\n` +
        `🐛 Erro: ${error.message}\n` +
        `📅 Data: ${new Date().toLocaleString('pt-BR')}`
      );
      
      ctx.answerCbQuery('Ocorreu um erro ao realizar o sorteio.', { show_alert: true });
    }
  });

  // Handler para cancelar sorteio
  bot.action(/cancelar_(.+)/, async (ctx) => {
    try {
      const raffleId = ctx.match[1];
      const groupId = ctx.chat.id;
      const userId = ctx.from.id;

      console.log(`[CANCELAR] Tentativa de cancelamento - User: ${userId}, Group: ${groupId}, Raffle: ${raffleId}`);

      // Verificar se é admin com permissão no grupo
      const adminCheck = await db.callProcedure('sp_check_admin_permission', [userId, groupId]);

      console.log(`[CANCELAR] Admin check result:`, JSON.stringify(adminCheck));

      if (!adminCheck || adminCheck.length === 0) {
        console.log(`[CANCELAR] Usuário ${userId} NÃO é admin - acesso negado`);
        return ctx.answerCbQuery('❌ Apenas administradores podem cancelar o sorteio.', { show_alert: true });
      }

      console.log(`[CANCELAR] Usuário ${userId} é admin (perfil: ${adminCheck[0].permission_level}) - prosseguindo...`);

      // Verificar se o sorteio existe
      const raffleInfo = await db.query(
        'SELECT statusRaffles FROM tbRafflesDetails WHERE idRafflesDetails = ?',
        [raffleId]
      );

      if (!raffleInfo || raffleInfo.length === 0) {
        return ctx.answerCbQuery('❌ Sorteio não encontrado.', { show_alert: true });
      }

      if (raffleInfo[0].statusRaffles === 'drawn') {
        return ctx.answerCbQuery('❌ Este sorteio já foi realizado e não pode ser cancelado.', { show_alert: true });
      }

      if (raffleInfo[0].statusRaffles === 'cancelled') {
        return ctx.answerCbQuery('⚠️ Este sorteio já está cancelado.', { show_alert: true });
      }

      // Cancelar sorteio no banco
      await db.query(
        'UPDATE tbRafflesDetails SET statusRaffles = ?, performedAt = CURRENT_TIMESTAMP WHERE idRafflesDetails = ?',
        ['cancelled', raffleId]
      );

      // Editar mensagem para mostrar cancelamento
      const originalCaption = ctx.callbackQuery.message.caption;
      const dateTime = new Date().toLocaleString('pt-BR');

      ctx.editMessageCaption(
        `${originalCaption}\n\n❌ <b>SORTEIO CANCELADO</b>\n\nCancelado por: ${ctx.from.first_name || ctx.from.username}\nData: ${dateTime}`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([])
        }
      ).catch((error) => {
        if (error.response && error.response.error_code === 400 && error.response.description.includes('message is not modified')) {
          console.warn('Message is not modified:', error);
        } else {
          console.error('Error editing message caption:', error);
        }
      });

      ctx.answerCbQuery('✅ Sorteio cancelado com sucesso!', { show_alert: true });

      // Enviar log
      await logger.logRaffle(
        `❌ **Sorteio Cancelado**\n\n` +
        `🎯 ID: \`${raffleId}\`\n` +
        `💬 Grupo: ${ctx.chat.title || 'Desconhecido'} (\`${groupId}\`)\n` +
        `👮 Cancelado por: ${ctx.from.first_name || ctx.from.username} (\`${ctx.from.id}\`)\n` +
        `📅 Data: ${dateTime}`
      );

    } catch (error) {
      console.error('[ACTIONS] Erro ao cancelar sorteio:', error);
      
      // Log de erro
      await logger.logError(
        `❌ **Erro ao Cancelar Sorteio**\n\n` +
        `🎯 Sorteio: \`${raffleId}\`\n` +
        `👤 Usuário: ${ctx.from.first_name || ctx.from.username} (\`${ctx.from.id}\`)\n` +
        `💬 Grupo: ${ctx.chat.title || 'Desconhecido'}\n` +
        `🐛 Erro: ${error.message}\n` +
        `📅 Data: ${new Date().toLocaleString('pt-BR')}`
      );
      
      ctx.answerCbQuery('❌ Ocorreu um erro ao cancelar o sorteio.', { show_alert: true });
    }
  });
}

module.exports = {
  setupActionHandlers
};
