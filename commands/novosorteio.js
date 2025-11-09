const { Markup } = require('telegraf');
const { isAdmin } = require('../utils/utils');
const db = require('../data/database');
const Logger = require('../utils/logger');
const { parseCaptionInfo, formatCaptionInfo } = require('../utils/captionParser');
const raffleMetadata = require('../utils/raffleMetadata');

/**
 * Notifica usuários com assinatura ativa sobre novo sorteio
 * Respeita limites da API: max 30 msgs/segundo
 */
async function notifySubscribers(bot, raffleId, groupId, groupName, captionInfo) {
  try {
    console.log(`[NOTIFICAÇÃO] Iniciando notificação de novo sorteio - Raffle: ${raffleId}, Grupo: ${groupId}`);
    
    // Buscar usuários com assinatura ativa neste grupo
    const subscribers = await db.query(
      `SELECT DISTINCT
        s.fkIdUser,
        (SELECT mu.valueMetadata FROM tbMetadataUser mu 
         JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
         WHERE mu.fkIdUser = s.fkIdUser AND m.nameMetadata = 'name' LIMIT 1) AS user_name
       FROM tbSubscription s
       WHERE s.fkIdGroup = ?
         AND s.statusSubscription = 'active'
         AND s.endDate >= CURDATE()`,
      [groupId]
    );

    if (!subscribers || subscribers.length === 0) {
      console.log(`[NOTIFICAÇÃO] Nenhum assinante ativo no grupo ${groupId}`);
      return;
    }

    console.log(`[NOTIFICAÇÃO] ${subscribers.length} assinante(s) serão notificados`);

    const title = captionInfo.title || 'Novo Sorteio';
    const date = captionInfo.raffleDate || 'A definir';
    const type = captionInfo.raffleType || '';

    let notified = 0;
    let failed = 0;

    // Respeitar limite da API: 30 mensagens/segundo
    // Enviar em lotes com delay
    for (let i = 0; i < subscribers.length; i++) {
      const subscriber = subscribers[i];
      
      try {
        await bot.telegram.sendMessage(
          subscriber.fkIdUser,
          `🎉 *Novo Sorteio Disponível!*\n\n` +
          `🎯 *${title}*\n` +
          `📅 *Data:* ${date}\n` +
          `${type ? `🏷️ *Tipo:* ${type}\n` : ''}` +
          `💬 *Grupo:* ${groupName}\n\n` +
          `✨ Participe agora para concorrer!`,
          { parse_mode: 'Markdown' }
        );
        notified++;
        console.log(`[NOTIFICAÇÃO] ✅ ${subscriber.fkIdUser} (${subscriber.user_name})`);
      } catch (error) {
        failed++;
        console.log(`[NOTIFICAÇÃO] ❌ ${subscriber.fkIdUser}: ${error.message}`);
      }

      // Delay a cada 25 mensagens (folga de 5 mensagens)
      if ((i + 1) % 25 === 0 && i < subscribers.length - 1) {
        console.log(`[NOTIFICAÇÃO] Aguardando 1s (enviadas ${i + 1}/${subscribers.length})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[NOTIFICAÇÃO] Concluído - Sucesso: ${notified}, Falhas: ${failed}`);
  } catch (error) {
    console.error('[NOTIFICAÇÃO] Erro ao notificar assinantes:', error);
  }
}

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

        // Extrair informações da legenda
        const captionInfo = parseCaptionInfo(caption);
        console.log('[NOVO SORTEIO] Informações extraídas:', captionInfo);

        // Usar título como descrição do prêmio, ou a legenda completa se não houver título
        const prizeDesc = captionInfo.title || caption || 'Sorteio criado via /novosorteio';

        // Criar sorteio no banco de dados (versão antiga da procedure com 4 parâmetros)
        await db.callProcedure('sp_create_raffle', [
          raffleId,
          groupId,
          numWinners,
          prizeDesc
        ]);

        // Salvar informações estruturadas como metadata
        await raffleMetadata.saveCaptionInfo(raffleId, captionInfo);

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

        // Notificar assinantes sobre o novo sorteio (assíncrono, não bloqueia)
        notifySubscribers(bot, raffleId, groupId, groupName, captionInfo).catch(err => {
          console.error('[NOVO SORTEIO] Erro ao notificar assinantes:', err);
        });

        // Enviar log de novo sorteio
        const formattedInfo = formatCaptionInfo(captionInfo);
        await logger.logRaffle(
          `🎲 **Novo sorteio criado**\n\n` +
          `🎯 ID: \`${raffleId}\`\n` +
          `🏆 Vencedores: ${numWinners}\n` +
          `💬 Grupo: ${ctx.chat.title || 'Desconhecido'} (\`${groupId}\`)\n` +
          `${formattedInfo ? `${formattedInfo}\n` : ''}` +
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
