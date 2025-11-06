const db = require('../data/database');
const Logger = require('../utils/logger');

const CLUBINHO_GROUP_ID = -1001801600131; // ID do grupo Clubinho FNBR
const DEFAULT_AMOUNT = 3.00; // Valor padrão da assinatura

function setupSubscriptionCommand(bot) {
  const logger = new Logger(bot);

  // Comando: /assinatura - Ver própria assinatura (somente PV)
  bot.command('assinatura', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      // Verificar se está no privado
      if (ctx.chat.type !== 'private') {
        return ctx.reply('❌ Este comando só pode ser usado no privado do bot.');
      }

      // Verificar assinatura usando stored procedure
      const result = await db.callProcedure('sp_check_subscription', [userId, CLUBINHO_GROUP_ID]);

      if (!result || result.length === 0 || !result[0].is_active) {
        return ctx.reply(
          '❌ *Você não possui assinatura ativa.*\n\n' +
          '💡 Entre em contato com um administrador para adquirir.\n' +
          '📱 Envie seu comprovante de pagamento para o admin.',
          { parse_mode: 'Markdown' }
        );
      }

      const subscription = result[0];
      const endDate = new Date(subscription.end_date);
      const formattedEndDate = endDate.toLocaleDateString('pt-BR');

      await ctx.reply(
        `📋 *Sua Assinatura*\n\n` +
        `${subscription.status_message}\n\n` +
        `📆 *Válida até:* ${formattedEndDate}\n` +
        `⏰ *Dias restantes:* ${subscription.days_remaining}\n` +
        `✅ *Status:* ${subscription.status === 'active' ? 'Ativa ✓' : 'Inativa ✗'}`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      console.error('[SUBSCRIPTION] Erro ao verificar assinatura:', error);
      await ctx.reply('❌ Erro ao verificar assinatura. Tente novamente.');
    }
  });

  // Comando: /sub - Registrar assinatura (somente ADMIN no PV)
  bot.command('sub', async (ctx) => {
    const adminId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      // Verificar se está no privado
      if (ctx.chat.type !== 'private') {
        return ctx.reply('❌ Este comando só pode ser usado no privado do bot.');
      }

      // Verificar se é admin
      const adminCheck = await db.callProcedure('sp_check_admin_permission', [adminId, CLUBINHO_GROUP_ID]);

      if (!adminCheck || adminCheck.length === 0) {
        return ctx.reply('❌ Apenas administradores podem registrar assinaturas.');
      }

      // Verificar se está respondendo a uma mensagem com imagem ou arquivo
      if (!ctx.message.reply_to_message) {
        return ctx.reply(
          '❌ *Uso incorreto!*\n\n' +
          '📝 *Modo Automático:*\n' +
          'Responda o comprovante com `/sub`\n\n' +
          '📝 *Modo Manual:*\n' +
          'Responda o comprovante com:\n' +
          '`/sub 01/06/2025#30/09/2025#9`\n\n' +
          '💡 *Formato:*\n' +
          '`data_inicio#data_fim#valor`\n\n' +
          '📌 *Padrões automáticos:*\n' +
          '• Valor: R$ 3,00\n' +
          '• Grupo: Clubinho FNBR\n' +
          '• Início: Próximo mês (se dia ≥ 29) ou mês atual\n' +
          '• Duração: 1 mês\n' +
          '• Pagamento: PIX',
          { parse_mode: 'Markdown' }
        );
      }

      const repliedMessage = ctx.message.reply_to_message;

      // Verificar se a mensagem tem forward_from (foi encaminhada)
      if (!repliedMessage.forward_from && !repliedMessage.forward_sender_name) {
        return ctx.reply(
          '❌ A mensagem respondida deve ser encaminhada do usuário.\n\n' +
          '💡 O usuário deve enviar o comprovante para você, e você deve encaminhar para este chat.'
        );
      }

      // Pegar ID do usuário que enviou a mensagem original
      const targetUserId = repliedMessage.forward_from?.id;

      if (!targetUserId) {
        return ctx.reply(
          '❌ Não foi possível identificar o usuário.\n\n' +
          '⚠️ O usuário pode ter configurações de privacidade que impedem o encaminhamento do ID.\n' +
          'Peça para ele usar /start no bot primeiro.'
        );
      }

      // Pegar file_id da imagem ou documento
      let fileId = null;
      let fileType = null;

      if (repliedMessage.photo) {
        fileId = repliedMessage.photo[repliedMessage.photo.length - 1].file_id;
        fileType = 'photo';
      } else if (repliedMessage.document) {
        fileId = repliedMessage.document.file_id;
        fileType = 'document';
      } else {
        return ctx.reply('❌ A mensagem deve conter uma imagem ou arquivo (comprovante).');
      }

      // Verificar se o usuário existe no banco
      const userExists = await db.query('SELECT idUser FROM tbUser WHERE idUser = ?', [targetUserId]);

      if (!userExists || userExists.length === 0) {
        return ctx.reply(
          '❌ Usuário não encontrado no sistema.\n\n' +
          '💡 Peça para ele usar /start no bot primeiro.'
        );
      }

      // Verificar se há parâmetros no comando
      const args = ctx.message.text.split(' ').slice(1).join(' ').trim();
      let startDate, endDate, amount;

      if (args) {
        // Modo manual: /sub 01/06/2025#30/09/2025#9
        const parts = args.split('#');
        
        if (parts.length !== 3) {
          return ctx.reply(
            '❌ *Formato inválido!*\n\n' +
            '📝 *Formato correto:*\n' +
            '`/sub data_inicio#data_fim#valor`\n\n' +
            '📌 *Exemplo:*\n' +
            '`/sub 01/06/2025#30/09/2025#9`\n\n' +
            '💡 *Ou use sem parâmetros para modo automático*',
            { parse_mode: 'Markdown' }
          );
        }

        // Parsear data de início (formato DD/MM/YYYY)
        const startParts = parts[0].trim().split('/');
        if (startParts.length !== 3) {
          return ctx.reply('❌ Data de início inválida! Use o formato DD/MM/YYYY');
        }
        startDate = new Date(startParts[2], startParts[1] - 1, startParts[0]);

        // Parsear data de fim (formato DD/MM/YYYY)
        const endParts = parts[1].trim().split('/');
        if (endParts.length !== 3) {
          return ctx.reply('❌ Data de fim inválida! Use o formato DD/MM/YYYY');
        }
        endDate = new Date(endParts[2], endParts[1] - 1, endParts[0]);

        // Parsear valor
        amount = parseFloat(parts[2].trim().replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
          return ctx.reply('❌ Valor inválido! Use um número maior que 0.');
        }

        // Validar datas
        if (startDate >= endDate) {
          return ctx.reply('❌ A data de início deve ser anterior à data de fim!');
        }

        console.log(`[SUBSCRIPTION] Modo manual - Início: ${startDate.toLocaleDateString('pt-BR')}, Fim: ${endDate.toLocaleDateString('pt-BR')}, Valor: R$ ${amount.toFixed(2)}`);

      } else {
        // Modo automático
        const today = new Date();
        const currentDay = today.getDate();
        startDate = new Date();

        if (currentDay >= 29) {
          // Se dia >= 29, começar no primeiro dia do próximo mês
          startDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        } else {
          // Senão, começar no dia atual
          startDate = today;
        }

        // Calcular data de fim (1 mês depois do início)
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        // Valor padrão
        amount = DEFAULT_AMOUNT;

        console.log(`[SUBSCRIPTION] Modo automático - Início: ${startDate.toLocaleDateString('pt-BR')}, Fim: ${endDate.toLocaleDateString('pt-BR')}, Valor: R$ ${amount.toFixed(2)}`);
      }

      // Formatar datas para MySQL (YYYY-MM-DD)
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Registrar assinatura no banco
      await db.query(
        `INSERT INTO tbSubscription (fkIdUser, fkIdGroup, startDate, endDate, amountPaid, statusSubscription, fileIdSubscription, paymentMethod)
         VALUES (?, ?, ?, ?, ?, 'active', ?, 'PIX')
         ON DUPLICATE KEY UPDATE
           endDate = IF(endDate < CURDATE(), ?, DATE_ADD(endDate, INTERVAL 1 MONTH)),
           amountPaid = amountPaid + ?,
           statusSubscription = 'active',
           fileIdSubscription = ?,
           paymentMethod = 'PIX',
           updatedAt = CURRENT_TIMESTAMP`,
        [targetUserId, CLUBINHO_GROUP_ID, startDateStr, endDateStr, amount, fileId, endDateStr, amount, fileId]
      );

      // Buscar nome do usuário
      const userMeta = await db.callProcedure('sp_get_user_meta', [targetUserId, 'name']);
      const userName = userMeta && userMeta.length > 0 ? userMeta[0].valueMetadata : 'Usuário';

      // Formatar datas para exibição
      const formattedStartDate = startDate.toLocaleDateString('pt-BR');
      const formattedEndDate = endDate.toLocaleDateString('pt-BR');
      const daysRemaining = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24));

      // Responder com sucesso ao admin
      await ctx.reply(
        `✅ *Assinatura registrada com sucesso!*\n\n` +
        `👤 *Usuário:* ${userName}\n` +
        `🆔 *ID:* \`${targetUserId}\`\n` +
        `📅 *Início:* ${formattedStartDate}\n` +
        `📆 *Válida até:* ${formattedEndDate}\n` +
        `⏰ *Dias:* ${daysRemaining}\n` +
        `💰 *Valor:* R$ ${amount.toFixed(2)}\n` +
        `💳 *Pagamento:* PIX\n` +
        `📎 *Comprovante:* Salvo (${fileType})`,
        { parse_mode: 'Markdown' }
      );

      // Enviar log
      await logger.logSubscription(
        `✅ **Nova Assinatura Registrada**\n\n` +
        `👤 **Usuário:** ${userName}\n` +
        `🆔 **ID:** \`${targetUserId}\`\n` +
        `📅 **Início:** ${formattedStartDate}\n` +
        `📆 **Válida até:** ${formattedEndDate}\n` +
        `⏰ **Dias:** ${daysRemaining}\n` +
        `💰 **Valor:** R$ ${amount.toFixed(2)}\n` +
        `💳 **Pagamento:** PIX\n` +
        `📎 **Comprovante:** Salvo\n` +
        `👮 **Registrado por:** ${ctx.from.first_name} (\`${adminId}\`)\n` +
        `📅 **Data:** ${new Date().toLocaleString('pt-BR')}`
      );

      // Notificar o usuário
      try {
        await bot.telegram.sendMessage(
          targetUserId,
          `🎉 *Sua assinatura foi ativada!*\n\n` +
          `📅 *Início:* ${formattedStartDate}\n` +
          `📆 *Válida até:* ${formattedEndDate}\n` +
          `⏰ *Dias restantes:* ${daysRemaining}\n\n` +
          `✨ Agora você pode participar de todos os sorteios do Clubinho FNBR!\n\n` +
          `💡 Use /assinatura para ver o status a qualquer momento.`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.log(`[SUBSCRIPTION] Não foi possível notificar o usuário ${targetUserId}`);
      }

    } catch (error) {
      console.error('[SUBSCRIPTION] Erro ao registrar assinatura:', error);
      await ctx.reply('❌ Erro ao registrar assinatura. Tente novamente.\n\n' + error.message);
      
      await logger.logError(
        `❌ **Erro ao Registrar Assinatura**\n\n` +
        `👮 **Admin:** ${ctx.from.first_name} (\`${adminId}\`)\n` +
        `❌ **Erro:** ${error.message}\n` +
        `📅 **Data:** ${new Date().toLocaleString('pt-BR')}`
      );
    }
  });
}

module.exports = { setupSubscriptionCommand };
