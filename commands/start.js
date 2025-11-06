const db = require('../data/database');
const Logger = require('../utils/logger');

/**
 * Comando /start - Registra o usuário no banco de dados
 * ATUALIZADO para nova estrutura: tbUser, tbSubscription
 */
function setupStartCommand(bot) {
  const logger = new Logger(bot);

  bot.command('start', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const userName = ctx.from.first_name || ctx.from.username || 'Usuário';
      const username = ctx.from.username || null;

      // Verificar se o usuário já existe
      const existingUser = await db.query(
        'SELECT idUser, createdAt FROM tbUser WHERE idUser = ?', 
        [userId]
      );

      if (existingUser && existingUser.length > 0) {
        // Usuário já registrado, atualizar metadados
        await db.callProcedure('sp_set_user_meta', [userId, 'name', userName]);
        if (username) {
          await db.callProcedure('sp_set_user_meta', [userId, 'username', username]);
        }
        await db.callProcedure('sp_set_user_meta', [userId, 'last_seen', new Date().toISOString()]);

        const firstSeen = new Date(existingUser[0].createdAt);
        const formattedDate = firstSeen.toLocaleDateString('pt-BR');

        return ctx.reply(
          `👋 Olá novamente, ${userName}!\n\n` +
            `✅ Você já está registrado desde ${formattedDate}.\n\n` +
            `📋 **Comandos disponíveis:**\n` +
            `• /assinatura - Verificar sua assinatura\n` +
            `• /renovar - Renovar assinatura\n` +
            `• /help - Ver todos os comandos\n\n` +
            `🎉 Boa sorte nos sorteios!`,
          { parse_mode: 'Markdown' }
        );
      }

      // Registrar novo usuário (perfil padrão = user, que é id 4)
      await db.query(
        'INSERT INTO tbUser (idUser, fkIdPerfilUser, createdAt) VALUES (?, 4, CURRENT_TIMESTAMP)',
        [userId]
      );

      // Salvar metadados do usuário
      await db.callProcedure('sp_set_user_meta', [userId, 'name', userName]);
      if (username) {
        await db.callProcedure('sp_set_user_meta', [userId, 'username', username]);
      }
      await db.callProcedure('sp_set_user_meta', [userId, 'last_seen', new Date().toISOString()]);

      // Enviar log de novo registro
      await logger.logBasic(
        `👤 **Novo usuário registrado**\n\n` +
        `🆔 ID: \`${userId}\`\n` +
        `📝 Nome: ${userName}\n` +
        `${username ? `📱 Username: @${username}\n` : ''}` +
        `📅 Data: ${new Date().toLocaleString('pt-BR')}`
      );

      // Mensagem de boas-vindas
      await ctx.reply(
        `🎉 **Bem-vindo(a), ${userName}!**\n\n` +
          `✅ Você foi registrado com sucesso no sistema!\n\n` +
          `📋 **O que você pode fazer:**\n` +
          `• Participar dos sorteios em grupos\n` +
          `• Verificar sua assinatura (/assinatura)\n` +
          `• Ver histórico de participações\n\n` +
          `💡 **Dica:** No grupo Clubinho FNBR, você precisa de uma assinatura ativa para participar dos sorteios.\n\n` +
          `Use /help para ver todos os comandos disponíveis!`,
        { parse_mode: 'Markdown' }
      );

      // Se estiver em um grupo, verificar se precisa de assinatura
      if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
        const groupId = ctx.chat.id;

        // Verificar se é o Clubinho FNBR (grupo que requer assinatura)
        if (groupId === -1001801600131) {
          // Verificar se já tem assinatura usando a procedure
          const subscription = await db.callProcedure('sp_check_subscription', [userId, groupId]);

          if (!subscription || subscription.length === 0 || !subscription[0].can_participate) {
            await ctx.reply(
              `⚠️ **Atenção!**\n\n` +
                `Este grupo requer assinatura mensal para participar dos sorteios.\n\n` +
                `💳 **Valor:** R$ 3,00/mês\n` +
                `📱 Use /renovar para ver como assinar!`,
              { parse_mode: 'Markdown' }
            );
          }
        }
      }

      console.log(`✅ Novo usuário registrado: ${userName} (${userId})`);
    } catch (error) {
      console.error('❌ Erro ao registrar usuário:', error);
      ctx.reply(
        '❌ Ocorreu um erro ao registrar suas informações.\n' +
          'Por favor, tente novamente mais tarde ou entre em contato com um administrador.'
      );
    }
  });

  // Também registrar quando o bot for adicionado a um grupo
  bot.on('new_chat_members', async (ctx) => {
    try {
      const botInfo = await ctx.telegram.getMe();

      // Verificar se o bot foi adicionado
      const botAdded = ctx.message.new_chat_members.some((member) => member.id === botInfo.id);

      if (botAdded) {
        const groupId = ctx.chat.id;
        const groupName = ctx.chat.title || 'Grupo';

        // Registrar o grupo na nova estrutura (tbGroup)
        await db.query(
          `INSERT INTO tbGroup (idGroup, nameGroup, requiresSubscription, statusGroup) 
           VALUES (?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE 
             nameGroup = ?, 
             updatedAt = CURRENT_TIMESTAMP`,
          [groupId, groupName, (groupId === -1001801600131 ? 1 : 0), groupName]
        );

        // Mensagem de boas-vindas do bot no grupo
        await ctx.reply(
          `👋 **Olá, ${groupName}!**\n\n` +
            `Obrigado por me adicionar ao grupo! 🎉\n\n` +
            `📋 **O que eu posso fazer:**\n` +
            `• Criar sorteios automáticos\n` +
            `• Gerenciar participações\n` +
            `• Controlar assinaturas (grupos premium)\n` +
            `• Registrar histórico de vencedores\n\n` +
            `🔧 **Comandos para admins:**\n` +
            `/novosorteio - Criar novo sorteio\n` +
            `/register - Registrar vencedores\n` +
            `/caixa - Ver saldo da comunidade\n\n` +
            `👥 **Para participar:**\n` +
            `Use /start para se registrar!\n\n` +
            `💡 Use /help para ver todos os comandos.`,
          { parse_mode: 'Markdown' }
        );

        console.log(`✅ Bot adicionado ao grupo: ${groupName} (${groupId})`);
      } else {
        // Novos membros no grupo - incentivá-los a usar /start
        for (const member of ctx.message.new_chat_members) {
          if (!member.is_bot) {
            await ctx.reply(
              `👋 Bem-vindo(a), ${member.first_name}!\n\n` +
                `Use /start para se registrar e participar dos sorteios! 🎉`
            );
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao processar novos membros:', error);
    }
  });
}

module.exports = {
  setupStartCommand
};
