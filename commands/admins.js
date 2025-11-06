const db = require('../data/database');

/**
 * Comando /admins - Lista todos os administradores
 * Apenas admins podem usar este comando
 */
function setupAdminsCommand(bot) {
  bot.command('admins', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      // Verificar se o usuário é admin
      const permission = await db.callProcedure('sp_check_admin_permission', [userId, chatId]);

      if (!permission || permission.length === 0) {
        return ctx.reply('❌ Apenas administradores podem usar este comando!');
      }

      // Buscar todos os admins da nova estrutura (tbUser + tbPerfilUser + metadados)
      const admins = await db.query(
        `SELECT 
          u.idUser AS user_id,
          (SELECT mu.valueMetadata FROM tbMetadataUser mu 
           JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
           WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'name' LIMIT 1) AS name,
          (SELECT mu.valueMetadata FROM tbMetadataUser mu 
           JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
           WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'username' LIMIT 1) AS username,
          p.namePerfilUser AS permission_level,
          p.statusPerfilUser AS is_active,
          u.createdAt AS granted_at
        FROM tbUser u
        JOIN tbPerfilUser p ON u.fkIdPerfilUser = p.idPerfilUser
        WHERE p.namePerfilUser IN ('owner', 'admin', 'moderator')
          AND p.statusPerfilUser = 1
        ORDER BY 
          FIELD(p.namePerfilUser, 'owner', 'admin', 'moderator'),
          u.idUser`
      );

      if (!admins || admins.length === 0) {
        return ctx.reply('📋 Nenhum administrador cadastrado.');
      }

      let message = '👥 **Lista de Administradores**\n\n';

      // Agrupar por tipo
      const owners = admins.filter(a => a.permission_level === 'owner');
      const adminUsers = admins.filter(a => a.permission_level === 'admin');
      const moderators = admins.filter(a => a.permission_level === 'moderator');

      // Owners
      if (owners.length > 0) {
        message += '👑 **Owners:**\n';
        owners.forEach((admin) => {
          message += `• ${admin.name} (${admin.user_id})\n`;
          if (admin.username) message += `  📱 @${admin.username}\n`;
          message += '\n';
        });
      }

      // Admins
      if (adminUsers.length > 0) {
        message += '⭐ **Admins:**\n';
        adminUsers.forEach((admin) => {
          message += `• ${admin.name} (${admin.user_id})\n`;
          if (admin.username) message += `  📱 @${admin.username}\n`;
          message += '\n';
        });
      }

      // Moderators
      if (moderators.length > 0) {
        message += '� **Moderadores:**\n';
        moderators.forEach((admin) => {
          message += `• ${admin.name} (${admin.user_id})\n`;
          if (admin.username) message += `  📱 @${admin.username}\n`;
          message += '\n';
        });
      }

      message += '\n💡 Use `/newadm` para adicionar novos admins';

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('❌ Erro ao listar admins:', error);
      ctx.reply('❌ Erro ao buscar lista de administradores.');
    }
  });
}

module.exports = {
  setupAdminsCommand
};
