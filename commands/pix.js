/**
 * Comando /pix - Informações de pagamento via PIX
 */
function setupPixCommand(bot) {
  bot.command('pix', async (ctx) => {
    const userId = ctx.from.id;
    const chatType = ctx.chat.type;

    try {
      // Verificar se o comando foi usado no privado
      if (chatType !== 'private') {
        return ctx.reply(
          '💰 Use /pix no privado para receber as informações de pagamento!',
          { reply_to_message_id: ctx.message.message_id }
        );
      }

      const pixMessage = 
        `💰 <b>Pagamento via PIX - Clubinho FNBR</b>\n\n` +
        `💵 <b>Valor Mínimo:</b> R$ 3,00/mês\n` +
        `✨ Valores extras são muito bem-vindos e ajudam a manter o clubinho ativo!\n\n` +
        `📅 <b>Pagamento Antecipado:</b>\n` +
        `Você pode pagar quantos meses desejar antecipadamente!\n` +
        `Exemplos:\n` +
        `• 3 meses = R$ 9,00\n` +
        `• 6 meses = R$ 18,00\n` +
        `• 12 meses = R$ 36,00\n\n` +
        `🔑 <b>Chave PIX:</b>\n` +
        `<code>c3bolete@gmail.com</code>\n` +
        `<i>(Toque para copiar)</i>\n\n` +
        `📝 <b>Após o pagamento:</b>\n` +
        `1️⃣ Tire um print do comprovante\n` +
        `2️⃣ Envie para um administrador\n` +
        `3️⃣ Aguarde a confirmação da sua assinatura\n\n` +
        `✅ Use /assinatura para verificar o status da sua assinatura\n` +
        `📋 Use /regulamento para ver o regulamento completo`;

      await ctx.replyWithHTML(pixMessage);
      
      console.log(`[PIX] ✅ Informações enviadas para user: ${userId}`);

    } catch (error) {
      console.error('[PIX] Erro:', error);
      await ctx.reply('❌ Erro ao enviar informações de pagamento. Tente novamente.');
    }
  });
}

module.exports = { setupPixCommand };
