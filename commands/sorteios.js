const { Markup } = require('telegraf');
const db = require('../data/database');

/**
 * Comando /sorteios - Listar sorteios por status (apenas admins no privado)
 */
function setupSorteiosCommand(bot) {
  
  // Comando principal /sorteios
  bot.command('sorteios', async (ctx) => {
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

      // Exibir botões com os status
      await ctx.reply(
        '📊 *Consultar Sorteios*\n\n' +
        'Escolha o status dos sorteios que deseja visualizar:',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🟢 Abertos', 'sorteios_status_open')],
            [Markup.button.callback('✅ Finalizados', 'sorteios_status_drawn')],
            [Markup.button.callback('❌ Cancelados', 'sorteios_status_cancelled')]
          ])
        }
      );

    } catch (error) {
      console.error('[SORTEIOS] Erro no comando /sorteios:', error);
      await ctx.reply('❌ Erro ao processar comando. Tente novamente.');
    }
  });

  // Handler para os botões de status
  bot.action(/sorteios_status_(.+)/, async (ctx) => {
    const userId = ctx.from.id;
    const status = ctx.match[1];

    try {
      // Verificar se é admin
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
        return ctx.answerCbQuery('❌ Apenas administradores podem usar esta função.', { show_alert: true });
      }

      // Buscar sorteios com o status selecionado
      const raffles = await db.query(
        `SELECT 
          rd.idRafflesDetails,
          rd.prizeDescription,
          rd.participantCount,
          rd.numWinners,
          rd.createdAt,
          rd.performedAt,
          g.nameGroup
        FROM tbRafflesDetails rd
        INNER JOIN tbGroup g ON rd.fkIdGroup = g.idGroup
        WHERE rd.statusRaffles = ?
        ORDER BY rd.createdAt DESC
        LIMIT 50`,
        [status]
      );

      if (!raffles || raffles.length === 0) {
        const statusText = {
          open: 'abertos',
          drawn: 'finalizados',
          cancelled: 'cancelados'
        };

        await ctx.answerCbQuery('✅ Consultado!');
        return ctx.reply(
          `📭 *Nenhum sorteio ${statusText[status]}*\n\n` +
          'Não há sorteios com este status no momento.',
          { parse_mode: 'Markdown' }
        );
      }

      // Formatar lista de sorteios
      const statusEmoji = {
        open: '🟢',
        drawn: '✅',
        cancelled: '❌'
      };

      const statusName = {
        open: 'Abertos',
        drawn: 'Finalizados',
        cancelled: 'Cancelados'
      };

      let message = `${statusEmoji[status]} *Sorteios ${statusName[status]}*\n\n`;
      
      raffles.forEach((raffle, index) => {
        const createdDate = new Date(raffle.createdAt).toLocaleString('pt-BR');
        const performedDate = raffle.performedAt ? new Date(raffle.performedAt).toLocaleString('pt-BR') : '-';
        
        message += `*${index + 1}.* \`${raffle.idRafflesDetails}\`\n`;
        message += `   📱 Grupo: ${raffle.nameGroup}\n`;
        message += `   👥 Participantes: ${raffle.participantCount}\n`;
        message += `   🏆 Vencedores: ${raffle.numWinners}\n`;
        message += `   📅 Criado: ${createdDate}\n`;
        
        if (status === 'drawn') {
          message += `   ✅ Realizado: ${performedDate}\n`;
        }
        
        if (raffle.prizeDescription) {
          const shortDesc = raffle.prizeDescription.length > 50 
            ? raffle.prizeDescription.substring(0, 50) + '...' 
            : raffle.prizeDescription;
          message += `   🎁 Prêmio: ${shortDesc}\n`;
        }
        
        message += '\n';
      });

      message += `💡 *Dica:* Use \`/participantes <código>\` para ver os participantes de um sorteio.`;

      await ctx.answerCbQuery('✅ Consultado!');
      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('[SORTEIOS] Erro ao buscar sorteios:', error);
      await ctx.answerCbQuery('❌ Erro ao buscar sorteios.', { show_alert: true });
    }
  });
}

module.exports = { setupSorteiosCommand };
