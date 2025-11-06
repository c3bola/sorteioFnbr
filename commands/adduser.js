const db = require('../data/database');
const Logger = require('../utils/logger');

/**
 * Comando /adduser - Registra um usuário no banco de dados
 * Apenas admins podem usar
 * Uso: Responder a uma mensagem do usuário com /adduser
 */
function setupAdduserCommand(bot) {
  const logger = new Logger(bot);

  bot.command('adduser', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      // Verificar se é admin
      const adminCheck = await db.callProcedure('sp_check_admin_permission', [userId, chatId]);

      if (!adminCheck || adminCheck.length === 0) {
        return ctx.reply('❌ Apenas administradores podem usar este comando!');
      }

      // Verificar se é resposta a uma mensagem
      if (!ctx.message.reply_to_message) {
        return ctx.reply(
          '❌ Use este comando respondendo à mensagem de um usuário!\n\n' +
          '📝 **Como usar:**\n' +
          '1. Responda a mensagem de um usuário\n' +
          '2. Digite /adduser\n\n' +
          '**Exemplo:**\n' +
          '• Usuário: "Olá!"\n' +
          '• Você: /adduser (respondendo a mensagem)'
        );
      }

      const repliedMessage = ctx.message.reply_to_message;
      const targetUser = repliedMessage.from;

      // Verificar se não é um bot
      if (targetUser.is_bot) {
        return ctx.reply('❌ Não é possível registrar bots!');
      }

      const targetUserId = targetUser.id;
      const targetUserName = targetUser.first_name || targetUser.username || 'Usuário';
      const targetUsername = targetUser.username || null;

      // Verificar se já existe no banco
      const existingUser = await db.query(
        'SELECT idUser, createdAt FROM tbUser WHERE idUser = ?', 
        [targetUserId]
      );

      if (existingUser && existingUser.length > 0) {
        const firstSeen = new Date(existingUser[0].createdAt);
        const formattedDate = firstSeen.toLocaleDateString('pt-BR');

        // Buscar nome dos metadados
        const nameMetadata = await db.callProcedure('sp_get_user_meta', [targetUserId, 'name']);
        const existingName = nameMetadata && nameMetadata.length > 0 ? nameMetadata[0].valueMetadata : 'Usuário';

        // Escapar caracteres especiais do Markdown
        const escapedExistingName = existingName.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        const escapedUsername = targetUsername ? targetUsername.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1') : null;

        return ctx.reply(
          `⚠️ *Usuário já registrado\\!*\n\n` +
          `👤 Nome: ${escapedExistingName}\n` +
          `🆔 ID: ${targetUserId}\n` +
          `📅 Registrado em: ${formattedDate}\n` +
          `${escapedUsername ? `📱 @${escapedUsername}` : ''}`,
          { parse_mode: 'MarkdownV2' }
        );
      }

      // Registrar novo usuário (perfil padrão = user, id 4)
      await db.query(
        'INSERT INTO tbUser (idUser, fkIdPerfilUser, createdAt) VALUES (?, 4, CURRENT_TIMESTAMP)',
        [targetUserId]
      );

      // Salvar metadados do usuário
      await db.callProcedure('sp_set_user_meta', [targetUserId, 'name', targetUserName]);
      if (targetUsername) {
        await db.callProcedure('sp_set_user_meta', [targetUserId, 'username', targetUsername]);
      }
      await db.callProcedure('sp_set_user_meta', [targetUserId, 'last_seen', new Date().toISOString()]);

      // Registrar grupo se ainda não existe (nova estrutura: tbGroup)
      await db.query(
        `INSERT INTO tbGroup (idGroup, nameGroup, requiresSubscription, statusGroup) 
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           nameGroup = ?, 
           updatedAt = CURRENT_TIMESTAMP`,
        [chatId, ctx.chat.title || 'Grupo', (chatId === -1001801600131 ? 1 : 0), ctx.chat.title || 'Grupo']
      );

      // Enviar log
      await logger.logBasic(
        `➕ **Usuário adicionado por admin**\n\n` +
        `👤 Novo usuário:\n` +
        `🆔 ID: \`${targetUserId}\`\n` +
        `📝 Nome: ${targetUserName}\n` +
        `${targetUsername ? `📱 Username: @${targetUsername}\n` : ''}` +
        `\n👮 Adicionado por:\n` +
        `🆔 ID: \`${userId}\`\n` +
        `📝 Nome: ${ctx.from.first_name || ctx.from.username}\n` +
        `📅 Data: ${new Date().toLocaleString('pt-BR')}`
      );

      // Escapar caracteres especiais do Markdown
      const escapedName = targetUserName.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
      const escapedUsername = targetUsername ? targetUsername.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1') : null;

      // Mensagem de sucesso
      await ctx.reply(
        `✅ *Usuário registrado com sucesso\\!*\n\n` +
        `👤 Nome: ${escapedName}\n` +
        `🆔 ID: ${targetUserId}\n` +
        `${escapedUsername ? `📱 @${escapedUsername}\n` : ''}` +
        `📅 Data: ${new Date().toLocaleDateString('pt-BR')}\n\n` +
        `💡 O usuário agora pode participar dos sorteios\\!`,
        { parse_mode: 'MarkdownV2' }
      );

      console.log(
        `✅ Usuário registrado via comando: ${targetUserName} (${targetUserId}) - Adicionado por: ${ctx.from.first_name} (${userId})`
      );
    } catch (error) {
      console.error('❌ Erro ao registrar usuário:', error);
      ctx.reply(`❌ Erro ao registrar usuário no banco de dados!\nDetalhes: ${error.message}`);
    }
  });
}

module.exports = {
  setupAdduserCommand
};
