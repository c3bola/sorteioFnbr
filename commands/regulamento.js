/**
 * Comando /regulamento - Envia o regulamento do Clubinho FNBR
 */
function setupRegulamentoCommand(bot) {
  bot.command('regulamento', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const chatType = ctx.chat.type;

    try {
      // Verificar se o comando foi usado no privado
      if (chatType !== 'private') {
        return ctx.reply(
          '📋 Use /regulamento no privado para receber o regulamento completo!',
          { reply_to_message_id: ctx.message.message_id }
        );
      }

      // IDs do canal e mensagem do regulamento
      const CENTRAL_FORTNITE_CHANNEL = '@CentralFortnite';
      const REGULAMENTO_MESSAGE_ID = 49;

      // Tentar copiar a mensagem (mantém formatação e mídia, sem "Encaminhado de")
      try {
        await ctx.telegram.copyMessage(
          chatId,
          CENTRAL_FORTNITE_CHANNEL,
          REGULAMENTO_MESSAGE_ID
        );

        console.log(`[REGULAMENTO] ✅ Copiado e enviado para user: ${userId}`);

      } catch (copyError) {
        console.warn('[REGULAMENTO] ❌ Erro ao copiar:', copyError.message);
        
        // Fallback 1: Tentar encaminhar
        try {
          await ctx.telegram.forwardMessage(
            chatId,
            CENTRAL_FORTNITE_CHANNEL,
            REGULAMENTO_MESSAGE_ID
          );

          console.log(`[REGULAMENTO] ✅ Encaminhado para user: ${userId}`);

        } catch (forwardError) {
          console.warn('[REGULAMENTO] ❌ Erro ao encaminhar:', forwardError.message);
          
          // Fallback 2: Enviar link
          await ctx.replyWithHTML(
            `📋 <b>Regulamento do Clubinho FNBR</b>\n\n` +
            `Para ver o regulamento completo, acesse:\n` +
            `🔗 https://t.me/CentralFortnite/49\n\n` +
            `<i>💡 Certifique-se de estar inscrito no canal @CentralFortnite</i>`
          );
        }
      }

    } catch (error) {
      console.error('[REGULAMENTO] Erro geral:', error);
      await ctx.reply(
        '❌ Erro ao enviar o regulamento. Tente novamente mais tarde ou acesse:\n' +
        'https://t.me/CentralFortnite/49'
      );
    }
  });
}

module.exports = { setupRegulamentoCommand };
