const db = require('../data/database');
const { Markup } = require('telegraf');
const raffleMetadata = require('../utils/raffleMetadata');

/**
 * Comando /participantes - Listar participantes de um sorteio (disponível para todos)
 */
function setupParticipantesCommand(bot) {
  
  bot.command('participantes', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const isPrivate = ctx.chat.type === 'private';
    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';

    try {
      // Pegar o código do sorteio
      const args = ctx.message.text.split(' ').slice(1).join(' ').trim();

      if (!args) {
        // Sem argumentos - mostrar lista de sorteios ativos com botões
        
        let query, params;
        
        if (isGroup) {
          // Se estiver em grupo, mostrar apenas sorteios deste grupo
          query = `SELECT 
            rd.idRafflesDetails,
            rd.prizeDescription,
            rd.participantCount,
            rd.createdAt,
            g.nameGroup,
            g.idGroup
          FROM tbRafflesDetails rd
          INNER JOIN tbGroup g ON rd.fkIdGroup = g.idGroup
          WHERE rd.statusRaffles = 'open' AND rd.fkIdGroup = ?
          ORDER BY rd.createdAt DESC
          LIMIT 20`;
          params = [chatId];
        } else {
          // No privado, buscar grupos onde o usuário participou de sorteios
          query = `SELECT DISTINCT
            rd.idRafflesDetails,
            rd.prizeDescription,
            rd.participantCount,
            rd.createdAt,
            g.nameGroup,
            g.idGroup
          FROM tbRafflesDetails rd
          INNER JOIN tbGroup g ON rd.fkIdGroup = g.idGroup
          INNER JOIN tbRaffles r ON rd.idRafflesDetails = r.fkIdRafflesDetails
          WHERE rd.statusRaffles = 'open' 
            AND r.fkIdUser = ?
          ORDER BY rd.createdAt DESC
          LIMIT 20`;
          params = [userId];
        }
        
        const activeRaffles = await db.query(query, params);

        if (!activeRaffles || activeRaffles.length === 0) {
          const message = isGroup 
            ? '📭 <b>Nenhum sorteio ativo neste grupo</b>\n\nNão há sorteios abertos neste grupo no momento.'
            : '📭 <b>Nenhum sorteio encontrado</b>\n\nVocê não está participando de nenhum sorteio ativo no momento.\n\n💡 Participe de sorteios nos grupos para vê-los aqui!';
          
          return ctx.reply(message, { parse_mode: 'HTML' });
        }

        // Criar botões inline com os sorteios
        const buttons = [];
        
        for (const raffle of activeRaffles) {
          // Buscar data do metadata
          const raffleDate = await raffleMetadata.get(raffle.idRafflesDetails, 'raffle_date');
          const buttonText = raffleDate || new Date(raffle.createdAt).toLocaleDateString('pt-BR');
          
          // No privado, incluir nome do grupo no botão
          const buttonLabel = isPrivate 
            ? `📅 ${buttonText} - ${raffle.nameGroup} (${raffle.participantCount})`
            : `📅 ${buttonText} (${raffle.participantCount} participantes)`;
          
          buttons.push([Markup.button.callback(
            buttonLabel,
            `ver_participantes_${raffle.idRafflesDetails}`
          )]);
        }

        const headerMessage = isGroup
          ? `👥 <b>Sorteios Ativos - ${ctx.chat.title}</b>\n\nSelecione um sorteio para ver os participantes:`
          : '👥 <b>Seus Sorteios Ativos</b>\n\nSelecione um sorteio para ver os participantes:';

        return ctx.reply(
          headerMessage,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
          }
        );
      }

      const raffleId = args;

      // Verificar se o sorteio existe
      const raffleCheck = await db.query(
        `SELECT 
          rd.idRafflesDetails,
          rd.prizeDescription,
          rd.participantCount,
          rd.numWinners,
          rd.statusRaffles,
          rd.createdAt,
          rd.performedAt,
          g.nameGroup
        FROM tbRafflesDetails rd
        INNER JOIN tbGroup g ON rd.fkIdGroup = g.idGroup
        WHERE rd.idRafflesDetails = ?`,
        [raffleId]
      );

      if (!raffleCheck || raffleCheck.length === 0) {
        return ctx.reply(
          '❌ <b>Sorteio não encontrado!</b>\n\n' +
          'O código informado não corresponde a nenhum sorteio.\n\n' +
          '💡 Use <code>/sorteios</code> para ver os códigos disponíveis.',
          { parse_mode: 'HTML' }
        );
      }

      const raffle = raffleCheck[0];

      // Buscar participantes do sorteio
      const participants = await db.query(
        `SELECT 
          r.fkIdUser,
          r.isWinner,
          r.winPosition,
          r.createdAt,
          m.valueMetadata as userName
        FROM tbRaffles r
        LEFT JOIN tbMetadataUser m ON r.fkIdUser = m.fkIdUser AND m.fkIdMetadata = (
          SELECT idMetadata FROM tbMetadata WHERE nameMetadata = 'name' LIMIT 1
        )
        WHERE r.fkIdRafflesDetails = ?
        ORDER BY r.isWinner DESC, r.winPosition ASC, r.createdAt ASC`,
        [raffleId]
      );

      if (!participants || participants.length === 0) {
        return ctx.reply(
          '📭 <b>Nenhum participante</b>\n\n' +
          `O sorteio <code>${raffleId}</code> ainda não tem participantes.`,
          { parse_mode: 'HTML' }
        );
      }

      // Formatar cabeçalho (usando HTML ao invés de Markdown)
      const statusEmoji = {
        open: '🟢',
        drawn: '✅',
        cancelled: '❌'
      };

      const statusName = {
        open: 'Aberto',
        drawn: 'Finalizado',
        cancelled: 'Cancelado'
      };

      let message = `📊 <b>Participantes do Sorteio</b>\n\n`;
      message += `🎯 <b>Código:</b> <code>${raffle.idRafflesDetails}</code>\n`;
      message += `📱 <b>Grupo:</b> ${raffle.nameGroup}\n`;
      message += `${statusEmoji[raffle.statusRaffles]} <b>Status:</b> ${statusName[raffle.statusRaffles]}\n`;
      message += `👥 <b>Total:</b> ${raffle.participantCount} participantes\n`;
      message += `🏆 <b>Vencedores:</b> ${raffle.numWinners}\n`;
      
      if (raffle.prizeDescription) {
        message += `🎁 <b>Prêmio:</b> ${raffle.prizeDescription}\n`;
      }
      
      message += `📅 <b>Criado:</b> ${new Date(raffle.createdAt).toLocaleString('pt-BR')}\n`;
      
      if (raffle.performedAt) {
        message += `✅ <b>Realizado:</b> ${new Date(raffle.performedAt).toLocaleString('pt-BR')}\n`;
      }
      
      message += '\n';

      // Separar vencedores e participantes
      const winners = participants.filter(p => p.isWinner === 1);
      const regularParticipants = participants.filter(p => p.isWinner === 0);

      // Listar vencedores (se houver)
      if (winners.length > 0) {
        message += '🏆 <b>VENCEDORES:</b>\n';
        winners.forEach((winner) => {
          const name = winner.userName || 'Sem nome';
          const position = winner.winPosition ? `${winner.winPosition}º lugar - ` : '';
          message += `   ${position}<a href="tg://user?id=${winner.fkIdUser}">${name}</a> (ID: <code>${winner.fkIdUser}</code>)\n`;
        });
        message += '\n';
      }

      // Listar participantes
      if (regularParticipants.length > 0) {
        message += '👥 <b>PARTICIPANTES:</b>\n';
        
        // Se houver muitos participantes, limitar a exibição
        const maxDisplay = 100;
        const toDisplay = regularParticipants.slice(0, maxDisplay);
        
        toDisplay.forEach((participant, index) => {
          const name = participant.userName || 'Sem nome';
          const joinDate = new Date(participant.createdAt).toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          message += `   ${index + 1}. <a href="tg://user?id=${participant.fkIdUser}">${name}</a> - ${joinDate}\n`;
        });

        if (regularParticipants.length > maxDisplay) {
          message += `\n   ... e mais ${regularParticipants.length - maxDisplay} participantes\n`;
        }
      }

      // Enviar mensagem (pode ser grande, então dividir se necessário)
      const maxLength = 4000;
      
      if (message.length > maxLength) {
        // Dividir mensagem em partes
        const parts = [];
        let currentPart = '';
        const lines = message.split('\n');
        
        for (const line of lines) {
          if ((currentPart + line + '\n').length > maxLength) {
            parts.push(currentPart);
            currentPart = line + '\n';
          } else {
            currentPart += line + '\n';
          }
        }
        
        if (currentPart) {
          parts.push(currentPart);
        }
        
        // Enviar partes
        for (let i = 0; i < parts.length; i++) {
          await ctx.reply(
            i === 0 ? parts[i] : `📊 <b>(continuação ${i + 1}/${parts.length})</b>\n\n${parts[i]}`,
            { parse_mode: 'HTML' }
          );
        }
      } else {
        await ctx.reply(message, { parse_mode: 'HTML' });
      }

    } catch (error) {
      console.error('[PARTICIPANTES] Erro no comando /participantes:', error);
      await ctx.reply('❌ Erro ao buscar participantes. Tente novamente.');
    }
  });

  // Handler para callback dos botões de ver participantes
  bot.action(/ver_participantes_(.+)/, async (ctx) => {
    try {
      const raffleId = ctx.match[1];
      
      // Deletar a mensagem com os botões
      try {
        await ctx.deleteMessage();
      } catch (e) {
        // Ignorar erro se não conseguir deletar
        console.log('[PARTICIPANTES] Não foi possível deletar mensagem:', e.message);
      }
      
      // Buscar informações do sorteio
      const raffleCheck = await db.query(
        `SELECT 
          rd.idRafflesDetails,
          rd.prizeDescription,
          rd.participantCount,
          rd.numWinners,
          rd.statusRaffles,
          rd.createdAt,
          rd.performedAt,
          g.nameGroup
        FROM tbRafflesDetails rd
        INNER JOIN tbGroup g ON rd.fkIdGroup = g.idGroup
        WHERE rd.idRafflesDetails = ?`,
        [raffleId]
      );

      if (!raffleCheck || raffleCheck.length === 0) {
        return ctx.answerCbQuery('❌ Sorteio não encontrado!', { show_alert: true });
      }

      const raffle = raffleCheck[0];

      // Buscar participantes
      const participants = await db.query(
        `SELECT 
          r.fkIdUser,
          r.isWinner,
          r.winPosition,
          r.createdAt,
          m.valueMetadata as userName
        FROM tbRaffles r
        LEFT JOIN tbMetadataUser m ON r.fkIdUser = m.fkIdUser AND m.fkIdMetadata = (
          SELECT idMetadata FROM tbMetadata WHERE nameMetadata = 'name' LIMIT 1
        )
        WHERE r.fkIdRafflesDetails = ?
        ORDER BY r.isWinner DESC, r.winPosition ASC, r.createdAt ASC`,
        [raffleId]
      );

      if (!participants || participants.length === 0) {
        return ctx.answerCbQuery('📭 Este sorteio ainda não tem participantes.', { show_alert: true });
      }

      // Formatar mensagem
      const statusEmoji = {
        open: '🟢',
        drawn: '✅',
        cancelled: '❌'
      };

      const statusName = {
        open: 'Aberto',
        drawn: 'Finalizado',
        cancelled: 'Cancelado'
      };

      // Buscar metadata do sorteio
      const raffleTitle = await raffleMetadata.get(raffleId, 'raffle_title');
      const raffleDate = await raffleMetadata.get(raffleId, 'raffle_date');

      let message = `📊 <b>Participantes do Sorteio</b>\n\n`;
      
      if (raffleTitle) {
        message += `📋 <b>Título:</b> ${raffleTitle}\n`;
      }
      if (raffleDate) {
        message += `📅 <b>Data:</b> ${raffleDate}\n`;
      }
      
      message += `📱 <b>Grupo:</b> ${raffle.nameGroup}\n`;
      message += `${statusEmoji[raffle.statusRaffles]} <b>Status:</b> ${statusName[raffle.statusRaffles]}\n`;
      message += `👥 <b>Total:</b> ${raffle.participantCount} participantes\n`;
      message += `🏆 <b>Vencedores:</b> ${raffle.numWinners}\n\n`;

      // Separar vencedores e participantes
      const winners = participants.filter(p => p.isWinner === 1);
      const regularParticipants = participants.filter(p => p.isWinner === 0);

      // Listar vencedores (se houver)
      if (winners.length > 0) {
        message += '🏆 <b>VENCEDORES:</b>\n';
        winners.forEach((winner) => {
          const name = winner.userName || 'Sem nome';
          const position = winner.winPosition ? `${winner.winPosition}º lugar - ` : '';
          message += `   ${position}<a href="tg://user?id=${winner.fkIdUser}">${name}</a>\n`;
        });
        message += '\n';
      }

      // Listar participantes
      if (regularParticipants.length > 0) {
        message += '👥 <b>PARTICIPANTES:</b>\n';
        
        const maxDisplay = 50; // Limite menor para callback
        const toDisplay = regularParticipants.slice(0, maxDisplay);
        
        toDisplay.forEach((participant, index) => {
          const name = participant.userName || 'Sem nome';
          message += `   ${index + 1}. <a href="tg://user?id=${participant.fkIdUser}">${name}</a>\n`;
        });

        if (regularParticipants.length > maxDisplay) {
          message += `\n   ... e mais ${regularParticipants.length - maxDisplay} participantes\n`;
        }
      }

      // Responder callback e enviar mensagem
      await ctx.answerCbQuery();
      await ctx.reply(message, { parse_mode: 'HTML' });

    } catch (error) {
      console.error('[PARTICIPANTES] Erro no callback ver_participantes:', error);
      await ctx.answerCbQuery('❌ Erro ao buscar participantes.', { show_alert: true });
    }
  });
}

module.exports = { setupParticipantesCommand };
