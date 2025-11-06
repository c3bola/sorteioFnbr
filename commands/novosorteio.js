const { Markup } = require('telegraf');
const { isAdmin } = require('../utils/utils');
const db = require('../data/database');
const Logger = require('../utils/logger');

function setupNovosorteioCommand(bot) {
  const logger = new Logger(bot);

  bot.command('novosorteio', async (ctx) => {
    try {
      if (!isAdmin(ctx)) {
        return ctx.reply('Apenas administradores permitidos podem iniciar um sorteio.');
      }

      const args = ctx.message.text.split(' ');
      const numWinners = args.length > 1 ? parseInt(args[1], 10) : 1;
      const raffleId = `raffle_${Date.now()}`;
      const groupId = ctx.chat.id;
      const groupName = ctx.chat.title;

      if (isNaN(numWinners) || numWinners <= 0) {
        return ctx.reply('Por favor, forneça um número válido de vencedores.');
      }

      // Inserir grupo (se não existir)
      await db.query(
        'INSERT IGNORE INTO tbGroup (idGroup, nameGroup, requiresSubscription, statusGroup) VALUES (?, ?, 0, 1)',
        [groupId, groupName || 'Grupo']
      );

      const chat = await ctx.telegram.getChat(ctx.chat.id);
      if (chat.has_protected_content) {
        ctx.reply('Configuração de tópicos para sorteios iniciada. Por favor, especifique os tópicos para sorteios, vencedores e prêmios.');
      } else {
        ctx.reply(`Sorteio iniciado! Serão ${numWinners} vencedores.`);
      }

      const message = ctx.message.reply_to_message;
      if (message && message.photo) {
        const photo = message.photo[message.photo.length - 1].file_id;
        const caption = message.caption || '';

        // Criar sorteio no banco de dados
        await db.callProcedure('sp_create_raffle', [
          raffleId,
          groupId,
          numWinners,
          caption || 'Sorteio criado via /novosorteio'
        ]);

        const sentMessage = await ctx.replyWithPhoto(photo, {
          caption: caption,
          ...Markup.inlineKeyboard([
            [Markup.button.callback('Participar do sorteio', `participar_${raffleId}`)],
            [Markup.button.callback('Sortear (apenas adm)', `sortear_${raffleId}_${numWinners}`)],
            [Markup.button.callback('❌ Cancelar sorteio', `cancelar_${raffleId}`)]
          ])
        });

        // Fixar a mensagem com os botões do sorteio
        await ctx.telegram.pinChatMessage(ctx.chat.id, sentMessage.message_id);

        // Enviar log de novo sorteio
        await logger.logRaffle(
          `🎲 **Novo sorteio criado**\n\n` +
          `🎯 ID: \`${raffleId}\`\n` +
          `🏆 Vencedores: ${numWinners}\n` +
          `💬 Grupo: ${ctx.chat.title || 'Desconhecido'} (\`${groupId}\`)\n` +
          `${message.caption ? `📝 Descrição: ${message.caption}\n` : ''}` +
          `👮 Criado por: ${ctx.from.first_name || ctx.from.username} (\`${ctx.from.id}\`)\n` +
          `📅 Data: ${new Date().toLocaleString('pt-BR')}`
        );
      } else {
        ctx.reply('Por favor, responda a uma mensagem com uma imagem para iniciar o sorteio.');
      }
    } catch (error) {
      console.error('Error handling novosorteio command:', error);
      
      // Log de erro
      await logger.logError(
        `❌ **Erro ao criar sorteio**\n\n` +
        `👤 Usuário: ${ctx.from.first_name || ctx.from.username} (\`${ctx.from.id}\`)\n` +
        `💬 Grupo: ${ctx.chat.title || 'Desconhecido'} (\`${ctx.chat.id}\`)\n` +
        `🐛 Erro: ${error.message}\n` +
        `📅 Data: ${new Date().toLocaleString('pt-BR')}`
      );
      
      ctx.reply('Ocorreu um erro ao iniciar o sorteio.');
    }
  });

  bot.command('sorteio', async (ctx) => {
    const message = ctx.message;
    const userId = message.from.id;
    const userName = message.from.first_name;
    
    if (message.reply_to_message) {
        const replyMessage = message.reply_to_message;
        const sorteioRef = DATABASE.ref('/sorteios/' + replyMessage.message_id);
        
        try {
            await sorteioRef.update({
                adm: {
                    id: userId,
                    name: userName
                },
                members: 0,
                sorteio: {
                    date: new Date().getTime(),
                    caption: replyMessage.caption
                }
            });
            
            await ctx.replyWithPhoto(replyMessage.photo[0].file_id, {
                caption: replyMessage.caption,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Participar do sorteio', callback_data: replyMessage.message_id + '##' + userId }],
                        [{ text: 'Sortear (apenas ADM)', callback_data: replyMessage.message_id + '##sortear' }]
                    ]
                }
            });
        } catch (error) {
            console.error('Erro ao atualizar dados do firebase', error);
        }
    }
  });
}

module.exports = {
  setupNovosorteioCommand
};
