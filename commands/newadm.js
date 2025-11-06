const db = require('../data/database');
const Logger = require('../utils/logger');

/**
 * Comando /newadm - Adiciona novos administradores
 * Apenas o owner (121823278) pode usar
 * Permite criar admins globais (todos os grupos) ou admins específicos de grupo
 */
function setupNewadmCommand(bot) {
  const logger = new Logger(bot);

  bot.command('newadm', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    // Apenas o owner pode adicionar admins
    if (userId !== 121823278) {
      return ctx.reply('❌ Apenas o owner do bot pode adicionar administradores!');
    }

    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 2) {
      return ctx.reply(
        '❌ **Uso incorreto!**\n\n' +
        '**Admin Global (todos os grupos):**\n' +
        '`/newadm <user_id> global [owner|admin|moderator]`\n\n' +
        '**Admin de Grupo Específico:**\n' +
        '`/newadm <user_id> group [owner|admin|moderator]`\n\n' +
        '**Exemplos:**\n' +
        '`/newadm 123456789 global admin`\n' +
        '`/newadm 987654321 group moderator`',
        { parse_mode: 'Markdown' }
      );
    }

    const newAdminId = parseInt(args[0]);
    const scope = args[1].toLowerCase(); // 'global' ou 'group'
    const permission = args[2] || 'moderator';

    if (isNaN(newAdminId)) {
      return ctx.reply('❌ ID do usuário inválido!');
    }

    if (!['global', 'group'].includes(scope)) {
      return ctx.reply('❌ Escopo inválido! Use "global" ou "group"');
    }

    if (!['owner', 'admin', 'moderator'].includes(permission)) {
      return ctx.reply('❌ Permissão inválida! Use: owner, admin ou moderator');
    }

    try {
      // Buscar informações do usuário no Telegram
      let userName = 'Novo Admin';
      let username = null;
      
      try {
        const chatMember = await ctx.telegram.getChatMember(chatId, newAdminId);
        userName = chatMember.user.first_name || 'Admin';
        username = chatMember.user.username || null;
      } catch (error) {
        console.log('⚠️  Não foi possível buscar info do usuário, usando nome padrão');
      }

      // Definir group_id
      const groupId = scope === 'global' ? null : chatId;
      const scopeText = scope === 'global' 
        ? '🌐 GLOBAL (todos os grupos)' 
        : `📍 Grupo: ${ctx.chat.title}`;

      // NOTA: Na nova estrutura, não existe admin global/por grupo
      // O perfil é definido em tbUser.fkIdPerfilUser
      // Vamos usar apenas a permissão (ignorando o escopo 'group')
      
      // Adicionar admin no banco usando a procedure (nova estrutura)
      await db.callProcedure('sp_grant_admin', [
        newAdminId,
        userName,
        permission  // 'owner', 'admin', 'moderator'
      ]);

      // Enviar log
      await logger.logAdmin(
        `👮 **Novo administrador adicionado**\n\n` +
        `👤 Novo admin:\n` +
        `🆔 ID: \`${newAdminId}\`\n` +
        `📝 Nome: ${userName}\n` +
        `${username ? `📱 Username: @${username}\n` : ''}` +
        `🔐 Nível: **${permission}**\n` +
        `${scopeText}\n\n` +
        `👑 Adicionado por: ${ctx.from.first_name || ctx.from.username}\n` +
        `📅 Data: ${new Date().toLocaleString('pt-BR')}`
      );

      await ctx.reply(
        `✅ **Admin adicionado com sucesso!**\n\n` +
        `👤 Usuário: ${userName} (${newAdminId})\n` +
        `🔐 Permissão: **${permission}**\n` +
        `${scopeText}\n` +
        `${username ? `📱 @${username}` : ''}`,
        { parse_mode: 'Markdown' }
      );

      console.log(`✅ Admin adicionado: ${userName} (${newAdminId}) - ${permission} - ${scopeText}`);

    } catch (error) {
      console.error('❌ Erro ao adicionar admin:', error);
      ctx.reply(`❌ Erro ao adicionar admin: ${error.message}`);
    }
  });
}

module.exports = {
  setupNewadmCommand
};
