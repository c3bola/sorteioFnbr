const { Markup } = require('telegraf');
const db = require('../data/database');

const CLUBINHO_GROUP_ID = -1001801600131; // ID do grupo Clubinho FNBR

/**
 * Comando /assinaturas - Listar assinaturas (admins veem todos, usuários veem a própria)
 */
function setupAssinaturasCommand(bot) {
  
  // Comando principal /assinaturas
  bot.command('assinaturas', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      // Verificar se está no privado
      if (ctx.chat.type !== 'private') {
        return ctx.reply('❌ Este comando só pode ser usado no privado do bot.');
      }

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

      const isAdmin = adminCheck && adminCheck.length > 0;

      if (isAdmin) {
        // ADMINISTRADOR: Exibir botões para escolher status
        await ctx.reply(
          '📋 <b>Gerenciar Assinaturas</b>\n\n' +
          'Escolha o status das assinaturas que deseja visualizar:',
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('✅ Assinaturas Ativas', 'assinaturas_status_active')],
              [Markup.button.callback('⏰ Assinaturas Expiradas', 'assinaturas_status_expired')],
              [Markup.button.callback('❌ Assinaturas Canceladas', 'assinaturas_status_cancelled')]
            ])
          }
        );
      } else {
        // USUÁRIO COMUM: Exibir própria assinatura
        const subscription = await db.callProcedure('sp_check_subscription', [userId, CLUBINHO_GROUP_ID]);

        if (!subscription || subscription.length === 0 || !subscription[0].can_participate) {
          return ctx.reply(
            '❌ <b>Você não possui assinatura ativa.</b>\n\n' +
            '💡 Entre em contato com um administrador para adquirir.\n' +
            '📱 Envie seu comprovante de pagamento para o admin.',
            { parse_mode: 'HTML' }
          );
        }

        const sub = subscription[0];
        const endDate = new Date(sub.end_date);
        const formattedEndDate = endDate.toLocaleDateString('pt-BR');

        // Buscar dados do usuário (uma query só)
        const userMetaData = await db.query(
          `SELECT m.nameMetadata, mu.valueMetadata
           FROM tbMetadataUser mu
           JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata
           WHERE mu.fkIdUser = ? AND m.nameMetadata IN ('name', 'username')`,
          [userId]
        );

        let userName = ctx.from.first_name;
        let username = ctx.from.username;

        if (userMetaData && userMetaData.length > 0) {
          userMetaData.forEach(meta => {
            if (meta.nameMetadata === 'name') userName = meta.valueMetadata;
            if (meta.nameMetadata === 'username') username = meta.valueMetadata;
          });
        }

        await ctx.reply(
          `📋 <b>Sua Assinatura</b>\n\n` +
          `• ${userName} ${username ? `(@${username})` : ''}\n` +
          `ID: ${userId}\n` +
          `Validade: ${formattedEndDate}\n` +
          `Valor pago: R$ ${parseFloat(sub.amount_paid || 0).toFixed(2)}\n` +
          `Dias restantes: ${sub.days_remaining}\n\n` +
          `✅ <b>Status:</b> ${sub.status === 'active' ? 'Ativa ✓' : 'Inativa ✗'}`,
          { parse_mode: 'HTML' }
        );
      }

    } catch (error) {
      console.error('[ASSINATURAS] Erro no comando /assinaturas:', error);
      await ctx.reply('❌ Erro ao processar comando. Tente novamente.');
    }
  });

  // Handler para os botões de status (apenas admins)
  bot.action(/assinaturas_status_(.+)/, async (ctx) => {
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

      // Buscar assinaturas usando a VIEW apropriada (sem duplicatas)
      const viewName = status === 'active' ? 'vw_active_subscriptions' 
                     : status === 'expired' ? 'vw_expired_subscriptions'
                     : 'vw_cancelled_subscriptions';

      const subscriptions = await db.query(
        `SELECT 
          idSubscription,
          fkIdUser,
          nameUser,
          usernameUser,
          nameGroup,
          startDate,
          endDate,
          amountPaid,
          paymentMethod,
          daysRemaining
        FROM ${viewName}
        ORDER BY endDate DESC
        LIMIT 100`
      );

      if (!subscriptions || subscriptions.length === 0) {
        const statusText = {
          active: 'ativas',
          expired: 'expiradas',
          cancelled: 'canceladas'
        };

        await ctx.answerCbQuery('✅ Consultado!');
        return ctx.reply(
          `📭 <b>Nenhuma assinatura ${statusText[status]}</b>\n\n` +
          'Não há assinaturas com este status no momento.',
          { parse_mode: 'HTML' }
        );
      }

      // A VIEW já retorna os nomes, não precisa buscar separadamente
      // Formatar lista de assinaturas (usar HTML para evitar problemas com caracteres especiais)
      const statusEmoji = {
        active: '✅',
        expired: '⏰',
        cancelled: '❌'
      };

      const statusName = {
        active: 'Ativas',
        expired: 'Expiradas',
        cancelled: 'Canceladas'
      };

      let message = `${statusEmoji[status]} <b>Assinaturas ${statusName[status]}</b>\n\n`;
      message += `📊 Total: ${subscriptions.length} assinatura(s)\n\n`;
      
      subscriptions.forEach((sub, index) => {
        const name = sub.nameUser || 'Sem nome';
        const username = sub.usernameUser;
        const endDate = new Date(sub.endDate).toLocaleDateString('pt-BR');
        const daysRemaining = sub.daysRemaining;
        const amount = parseFloat(sub.amountPaid || 0).toFixed(2);

        message += `• ${name}${username ? ` (@${username})` : ''}\n`;
        message += `ID: ${sub.fkIdUser}\n`;
        message += `Validade: ${endDate}\n`;
        message += `Valor pago: R$ ${amount}\n`;
        
        if (status === 'active') {
          message += `Dias restantes: ${daysRemaining}\n`;
        }
        
        message += '\n';
      });

      await ctx.answerCbQuery('✅ Consultado!');

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
            i === 0 ? parts[i] : `📋 <b>(continuação ${i + 1}/${parts.length})</b>\n\n${parts[i]}`,
            { parse_mode: 'HTML' }
          );
        }
      } else {
        await ctx.reply(message, { parse_mode: 'HTML' });
      }

    } catch (error) {
      console.error('[ASSINATURAS] Erro ao buscar assinaturas:', error);
      await ctx.answerCbQuery('❌ Erro ao buscar assinaturas.', { show_alert: true });
    }
  });
}

module.exports = { setupAssinaturasCommand };
