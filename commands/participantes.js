const db = require('../data/database');

/**
 * Comando /participantes - Listar participantes de um sorteio (apenas admins no privado)
 */
function setupParticipantesCommand(bot) {
  
  bot.command('participantes', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      // Verificar se está no privado
      if (ctx.chat.type !== 'private') {
        return ctx.reply('❌ Este comando só pode ser usado no privado do bot.');
      }

      // Verificar se é admin (qualquer grupo)
      const adminCheck = await db.query(
        `SELECT u.idUser 
         FROM tbUser u
         JOIN tbPerfilUser p ON u.fkIdPerfilUser = p.idPerfilUser
         WHERE u.idUser = ? 
           AND p.statusPerfilUser = 1
           AND p.namePerfilUser IN ('owner', 'admin', 'moderator')`,
        [userId]
      );

      if (!adminCheck || adminCheck.length === 0) {
        return ctx.reply('❌ Apenas administradores podem usar este comando.');
      }

      // Pegar o código do sorteio
      const args = ctx.message.text.split(' ').slice(1).join(' ').trim();

      if (!args) {
        return ctx.reply(
          '❌ <b>Uso incorreto!</b>\n\n' +
          '📝 <b>Formato correto:</b>\n' +
          '<code>/participantes código_do_sorteio</code>\n\n' +
          '📌 <b>Exemplo:</b>\n' +
          '<code>/participantes raffle_1730923456789</code>\n\n' +
          '💡 <b>Dica:</b> Use <code>/sorteios</code> para ver os códigos disponíveis.',
          { parse_mode: 'HTML' }
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
}

module.exports = { setupParticipantesCommand };
