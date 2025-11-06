const db = require('../data/database');
const Logger = require('../utils/logger');
const { loadRaffleParticipants } = require('../data/participants');

/**
 * Comando /register - Registra vencedores de sorteios (ADMIN ONLY)
 * Deve ser usado como resposta a uma mensagem de sorteio finalizado
 */
function setupRegisterCommand(bot) {
  const logger = new Logger(bot);

  bot.command('register', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const chatId = ctx.chat.id;

      // Verificar se é admin
      const adminCheck = await db.callProcedure('sp_check_admin_permission', [userId, chatId]);

      if (!adminCheck || adminCheck.length === 0) {
        return ctx.reply('❌ Apenas administradores podem usar este comando!');
      }

      // Verificar se é resposta a uma mensagem
      if (!ctx.message.reply_to_message) {
        return ctx.reply(
          '❌ Use este comando respondendo à mensagem do sorteio finalizado!\n\n' +
          '📝 **Como usar:**\n' +
          '1. Vá até a mensagem do sorteio com os vencedores\n' +
          '2. Responda a mensagem com /register\n\n' +
          '**Formato esperado da mensagem:**\n' +
          '🤩SORTEIO SEMANAL🚨\n' +
          'Participantes: 16\n' +
          'O vencedor é:\n' +
          '[nome do vencedor]\n' +
          'Sorteio realizado em: 12/09/2025, 00:34:30'
        );
      }

      const repliedMessage = ctx.message.reply_to_message;
      const messageText = repliedMessage.text || repliedMessage.caption || '';

      // Verificar se a mensagem contém dados de sorteio
      if (!messageText.includes('O vencedor') && !messageText.includes('Os vencedores')) {
        return ctx.reply(
          '❌ Esta mensagem não parece ser um sorteio finalizado!\n' +
          'Certifique-se de que a mensagem contém "O vencedor é:" ou "Os vencedores são:"'
        );
      }

      // Enviar mensagem de processamento
      const processingMsg = await ctx.reply('⏳ Processando sorteio...');

      // Extrair entidades (mentions) da mensagem
      const entities = repliedMessage.entities || [];
      const mentionedUsers = [];
      
      // Percorrer entidades para encontrar mentions de usuários
      for (const entity of entities) {
        if (entity.type === 'text_mention' && entity.user) {
          // Mention direto com objeto user
          mentionedUsers.push({
            id: entity.user.id,
            name: entity.user.first_name || entity.user.username || 'Vencedor',
            username: entity.user.username || null
          });
        }
      }

      // Extrair dados da mensagem
      const raffleData = parseRaffleMessage(messageText);
      raffleData.mentionedUsers = mentionedUsers;

      if (!raffleData.winners || raffleData.winners.length === 0) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          null,
          '❌ Não foi possível identificar os vencedores na mensagem!'
        );
        return;
      }

      // Tentar extrair o raffleId dos botões inline da mensagem
      let raffleId = null;
      const replyMarkup = repliedMessage.reply_markup;
      
      if (replyMarkup && replyMarkup.inline_keyboard) {
        // Procurar nos botões inline
        for (const row of replyMarkup.inline_keyboard) {
          for (const button of row) {
            if (button.callback_data) {
              // Formato: participar_raffle_TIMESTAMP ou sortear_raffle_TIMESTAMP_numWinners
              const match = button.callback_data.match(/(?:participar|sortear)_(raffle_\d+)/);
              if (match) {
                raffleId = match[1];
                console.log(`[REGISTER] RaffleId extraído dos botões: ${raffleId}`);
                break;
              }
            }
          }
          if (raffleId) break;
        }
      }
      
      // Fallback: usar message_id se não encontrar nos botões
      if (!raffleId) {
        raffleId = `raffle_${repliedMessage.message_id}`;
        console.log(`[REGISTER] RaffleId não encontrado nos botões, usando message_id: ${raffleId}`);
      }

      // Verificar se já foi registrado
      const existing = await db.query('SELECT idRafflesDetails FROM tbRafflesDetails WHERE idRafflesDetails = ?', [raffleId]);

      if (existing && existing.length > 0) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          null,
          '⚠️ Este sorteio já foi registrado no banco de dados!'
        );
        return;
      }

      // Inserir grupo (se não existir)
      await db.query(
        'INSERT IGNORE INTO tbGroup (idGroup, nameGroup, requiresSubscription, statusGroup) VALUES (?, ?, 0, 1)',
        [chatId, ctx.chat.title || 'Grupo']
      );

      // Buscar participantes do arquivo JSON
      const groupIdStr = chatId.toString();
      const participantsFromFile = loadRaffleParticipants(groupIdStr, raffleId);
      const participantCount = raffleData.participants || participantsFromFile.length || 0;

      // Log de debug
      console.log(`[REGISTER] Buscando participantes para grupo ${groupIdStr}, sorteio ${raffleId}`);
      console.log(`[REGISTER] Participantes encontrados no JSON: ${participantsFromFile.length}`);
      console.log(`[REGISTER] Contagem final de participantes: ${participantCount}`);

      // Criar sorteio
      await db.callProcedure('sp_create_raffle', [
        raffleId,
        chatId,
        raffleData.winners.length,
        raffleData.prizeDescription || 'Sorteio registrado via comando'
      ]);

      // Atualizar número de participantes
      await db.query(
        'UPDATE tbRafflesDetails SET participantCount = ? WHERE idRafflesDetails = ?',
        [participantCount, raffleId]
      );

      // Atualizar data e status se disponível
      if (raffleData.date) {
        await db.query('UPDATE tbRafflesDetails SET performedAt = ?, statusRaffles = ? WHERE idRafflesDetails = ?', [
          raffleData.date,
          'drawn',
          raffleId
        ]);
      } else {
        // Se não tem data, marcar como drawn com timestamp atual
        await db.query('UPDATE tbRafflesDetails SET statusRaffles = ?, performedAt = NOW() WHERE idRafflesDetails = ?', [
          'drawn',
          raffleId
        ]);
      }

      // Registrar vencedores
      let winnersRegistered = 0;
      let winnersNotFound = [];

      // Priorizar usuários mencionados (mentions)
      if (raffleData.mentionedUsers && raffleData.mentionedUsers.length > 0) {
        for (let i = 0; i < raffleData.mentionedUsers.length; i++) {
          const mentionedUser = raffleData.mentionedUsers[i];
          const winnerId = mentionedUser.id;

          // Registrar ou atualizar o usuário no banco
          await db.query(
            'INSERT INTO tbUser (idUser, fkIdPerfilUser, createdAt) ' +
            'VALUES (?, 4, CURRENT_TIMESTAMP) ' +
            'ON DUPLICATE KEY UPDATE idUser = idUser',
            [winnerId]
          );

          // Salvar metadados do usuário
          await db.callProcedure('sp_set_user_meta', [winnerId, 'name', mentionedUser.name]);
          await db.callProcedure('sp_set_user_meta', [winnerId, 'last_seen', new Date().toISOString()]);
          if (mentionedUser.username) {
            await db.callProcedure('sp_set_user_meta', [winnerId, 'username', mentionedUser.username]);
          }

          // Registrar como vencedor
          await db.callProcedure('sp_register_winner', [raffleId, winnerId, i + 1, chatId]);

          winnersRegistered++;
        }
      } else {
        // Fallback: buscar por nome (método antigo - procurar nos metadados)
        for (let i = 0; i < raffleData.winners.length; i++) {
          const winnerName = raffleData.winners[i];

          // Tentar encontrar o ID do usuário pelo nome nos metadados
          const userResult = await db.query(
            `SELECT u.idUser 
             FROM tbUser u
             JOIN tbMetadataUser mu ON u.idUser = mu.fkIdUser
             JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata
             WHERE m.nameMetadata = 'name' AND mu.valueMetadata = ?
             LIMIT 1`,
            [winnerName]
          );

          if (userResult && userResult.length > 0) {
            const winnerId = userResult[0].idUser;

            // Registrar como vencedor
            await db.callProcedure('sp_register_winner', [raffleId, winnerId, i + 1, chatId]);

            winnersRegistered++;
          } else {
            winnersNotFound.push(winnerName);
          }
        }
      }

      // Registrar participantes do arquivo JSON no banco de dados
      console.log(`[REGISTER] Iniciando registro de ${participantsFromFile.length} participantes no banco`);
      
      if (participantsFromFile && participantsFromFile.length > 0) {
        let registeredCount = 0;
        for (const participant of participantsFromFile) {
          try {
            // Inserir usuário se não existir
            await db.query(
              'INSERT INTO tbUser (idUser, fkIdPerfilUser, createdAt) ' +
              'VALUES (?, 4, CURRENT_TIMESTAMP) ' +
              'ON DUPLICATE KEY UPDATE idUser = idUser',
              [participant.id]
            );

            // Salvar metadados
            await db.callProcedure('sp_set_user_meta', [participant.id, 'name', participant.name]);
            
            // Verificar se é vencedor (tanto por mentions quanto por nome)
            const isWinnerByMention = raffleData.mentionedUsers 
              ? raffleData.mentionedUsers.some(w => w.id === participant.id)
              : false;
            
            const isWinnerByName = raffleData.winners
              ? raffleData.winners.some(w => w === participant.name)
              : false;
            
            const isWinner = isWinnerByMention || isWinnerByName;

            // Converter data ISO para formato MySQL TIMESTAMP
            const participationDate = participant.date 
              ? new Date(participant.date).toISOString().slice(0, 19).replace('T', ' ')
              : new Date().toISOString().slice(0, 19).replace('T', ' ');
            
            // Registrar participação (vencedor ou não)
            await db.query(
              'INSERT INTO tbRaffles (fkIdRafflesDetails, fkIdUser, isWinner, createdAt) ' +
              'VALUES (?, ?, ?, ?) ' +
              'ON DUPLICATE KEY UPDATE isWinner = VALUES(isWinner), createdAt = VALUES(createdAt)',
              [raffleId, participant.id, isWinner ? 1 : 0, participationDate]
            );
            
            registeredCount++;
          } catch (error) {
            console.error(`[REGISTER] Erro ao registrar participante ${participant.id} (${participant.name}):`, error.message);
          }
        }
        
        console.log(`[REGISTER] Total de participantes registrados com sucesso: ${registeredCount}/${participantsFromFile.length}`);
      } else {
        console.log(`[REGISTER] Nenhum participante encontrado no arquivo JSON para este sorteio`);
      }

      // Mensagem de sucesso
      const usedMentions = raffleData.mentionedUsers && raffleData.mentionedUsers.length > 0;
      const totalWinners = usedMentions ? raffleData.mentionedUsers.length : raffleData.winners.length;
      const totalParticipantsRegistered = participantsFromFile ? participantsFromFile.length : 0;

      let resultMessage =
        `✅ Sorteio registrado com sucesso!\n\n` +
        `🎯 **ID:** ${raffleId}\n` +
        `👥 **Participantes totais:** ${participantCount}\n` +
        `📝 **Registrados no banco:** ${totalParticipantsRegistered}\n` +
        `🏆 **Vencedores registrados:** ${winnersRegistered}/${totalWinners}\n`;

      if (usedMentions) {
        resultMessage += `📱 **Método:** Mentions detectadas (IDs extraídos)\n`;
        raffleData.mentionedUsers.forEach((user, idx) => {
          resultMessage += `   ${idx + 1}. ${user.name} (ID: ${user.id})\n`;
        });
      }

      if (raffleData.date) {
        resultMessage += `📅 **Data:** ${raffleData.date}\n`;
      }

      if (raffleData.prizeDescription) {
        resultMessage += `🎁 **Prêmio:** ${raffleData.prizeDescription}\n`;
      }

      if (winnersNotFound.length > 0) {
        resultMessage +=
          `\n⚠️ **Vencedores não encontrados no banco:**\n` +
          winnersNotFound.map((name) => `• ${name}`).join('\n') +
          `\n\n💡 Esses usuários precisam usar /start primeiro!`;
      }

      // Enviar log do sorteio registrado
      await logger.logRaffle(
        `🎉 **Sorteio registrado no banco**\n\n` +
        `🎯 ID: \`${raffleId}\`\n` +
        `👥 Participantes: ${participantCount}\n` +
        `🏆 Vencedores: ${winnersRegistered}\n` +
        `${raffleData.prizeDescription ? `🎁 Prêmio: ${raffleData.prizeDescription}\n` : ''}` +
        `💬 Grupo: ${ctx.chat.title || 'Desconhecido'} (\`${chatId}\`)\n` +
        `${winnersNotFound.length > 0 ? `⚠️ Não encontrados: ${winnersNotFound.length}\n` : ''}` +
        `👮 Registrado por: ${ctx.from.first_name || ctx.from.username}\n` +
        `📅 Data: ${new Date().toLocaleString('pt-BR')}`
      );

      await ctx.telegram.editMessageText(ctx.chat.id, processingMsg.message_id, null, resultMessage);
    } catch (error) {
      // Log de erro
      await logger.logError(
        `❌ **Erro ao registrar sorteio**\n\n` +
        `👤 Usuário: ${ctx.from.first_name || ctx.from.username} (\`${ctx.from.id}\`)\n` +
        `💬 Grupo: ${ctx.chat.title || 'Desconhecido'} (\`${ctx.chat.id}\`)\n` +
        `🐛 Erro: ${error.message}\n` +
        `📅 Data: ${new Date().toLocaleString('pt-BR')}`
      );
      console.error('Erro ao registrar sorteio:', error);
      ctx.reply(`❌ Erro ao registrar sorteio no banco de dados!\nDetalhes: ${error.message}`);
    }
  });
}

/**
 * Extrai informações do sorteio da mensagem
 */
function parseRaffleMessage(messageText) {
  const data = {
    participants: null,
    winners: [],
    date: null,
    prizeDescription: null
  };

  // Extrair número de participantes
  const participantsMatch = messageText.match(/Participantes:\s*(\d+)/i);
  if (participantsMatch) {
    data.participants = parseInt(participantsMatch[1]);
  }

  // Extrair descrição do prêmio
  const prizeMatch = messageText.match(/🤩SORTEIO SEMANAL🚨\s*-?\s*(.+?)(?:\n|Para participar)/i);
  if (prizeMatch) {
    data.prizeDescription = prizeMatch[1].trim();
  }

  // Extrair vencedores (linha(s) após "O vencedor é:" ou "Os vencedores são:")
  const winnerSection = messageText.split(/O[s]?\s+vencedor(?:es)?\s+(?:é|são):/i)[1];
  if (winnerSection) {
    const beforeDate = winnerSection.split(/Sorteio realizado em:/i)[0];
    const winnerLines = beforeDate
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        // Filtrar linhas vazias e linhas que parecem ser parte do template
        return (
          line &&
          !line.startsWith('-') &&
          !line.includes('V-Bucks') &&
          !line.includes('Para participar') &&
          !line.includes('Adicione os adms') &&
          !line.match(/^\d+$/) // Ignorar apenas números
        );
      });

    data.winners = winnerLines;
  }

  // Extrair data do sorteio
  const dateMatch = messageText.match(/Sorteio realizado em:\s*(.+?)$/m);
  if (dateMatch) {
    const dateStr = dateMatch[1].trim();
    try {
      // Converter "12/09/2025, 00:34:30" para formato MySQL "2025-09-12 00:34:30"
      const [datePart, timePart] = dateStr.split(', ');
      const [day, month, year] = datePart.split('/');
      data.date = `${year}-${month}-${day} ${timePart}`;
    } catch (e) {
      console.error('Erro ao parsear data:', e);
    }
  }

  return data;
}

module.exports = {
  setupRegisterCommand
};
