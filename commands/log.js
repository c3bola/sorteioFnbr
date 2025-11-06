const db = require('../data/database');
const Logger = require('../utils/logger');

/**
 * Comando /log - Configura tópicos de log
 * Uso: /log <tipo> - onde tipo pode ser: settings, basic, raffle, subscription, admin, error
 * Deve ser usado dentro de um tópico do grupo de logs
 * Apenas owners podem configurar
 */
function setupLogCommand(bot) {
  const logger = new Logger(bot);

  bot.command('log', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const messageThreadId = ctx.message.message_thread_id;

    try {
      // Verificar se é um owner
      const permission = await db.callProcedure('sp_check_admin_permission', [userId, chatId]);
      
      if (!permission || permission.length === 0 || permission[0].permission_level !== 'owner') {
        return ctx.reply('❌ Apenas o owner pode configurar logs!');
      }

      // Verificar se está em um grupo
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return ctx.reply('❌ Este comando só pode ser usado em grupos!');
      }

      // Verificar se está em um tópico
      if (!messageThreadId) {
        return ctx.reply(
          '❌ Este comando deve ser usado dentro de um tópico!\n\n' +
          '📋 **Como configurar:**\n' +
          '1. Crie tópicos no grupo de logs\n' +
          '2. Entre em cada tópico\n' +
          '3. Use /log <tipo>\n\n' +
          '**Tipos disponíveis:**\n' +
          '• `settings` - Alterações de configurações\n' +
          '• `basic` - Ações básicas (registro, etc)\n' +
          '• `raffle` - Sorteios e participações\n' +
          '• `subscription` - Assinaturas\n' +
          '• `admin` - Ações administrativas\n' +
          '• `error` - Erros do sistema',
          { parse_mode: 'Markdown' }
        );
      }

      // Pegar argumentos
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length === 0) {
        // Mostrar status atual
        const status = logger.getStatus();
        
        let message = '📊 **Status das Configurações de Log**\n\n';
        
        if (status.configured) {
          message += `✅ Grupo de logs: \`${status.groupId}\`\n\n`;
          message += '**Tópicos configurados:**\n';
          
          for (const [type, info] of Object.entries(status.topics)) {
            const emoji = info.configured ? '✅' : '❌';
            const topicInfo = info.configured ? `\`${info.topicId}\`` : 'Não configurado';
            message += `${emoji} ${type}: ${topicInfo}\n`;
          }
        } else {
          message += '❌ Nenhum log configurado\n\n';
        }
        
        message += '\n💡 **Para configurar:**\n';
        message += 'Entre em um tópico e use `/log <tipo>`\n\n';
        message += '**Tipos:** settings, basic, raffle, subscription, admin, error';
        
        return ctx.reply(message, { parse_mode: 'Markdown' });
      }

      const logType = args[0].toLowerCase();
      const validTypes = ['settings', 'basic', 'raffle', 'subscription', 'admin', 'error'];

      if (!validTypes.includes(logType)) {
        return ctx.reply(
          `❌ Tipo de log inválido: \`${logType}\`\n\n` +
          '**Tipos válidos:**\n' +
          validTypes.map(t => `• \`${t}\``).join('\n'),
          { parse_mode: 'Markdown' }
        );
      }

      // Configurar o tópico
      const result = logger.setLogTopic(logType, chatId, messageThreadId);

      if (result.success) {
        await ctx.reply(
          `✅ **Log configurado com sucesso!**\n\n` +
          `📝 Tipo: \`${logType}\`\n` +
          `🏷️ Tópico: \`${messageThreadId}\`\n` +
          `💬 Grupo: \`${chatId}\`\n\n` +
          `📨 Todos os logs de *${logType}* serão enviados para este tópico!`,
          { parse_mode: 'Markdown' }
        );

        // Enviar log de teste
        await logger.sendLog(
          logType,
          `🎉 **Log ${logType} configurado!**\n\n` +
          `👤 Configurado por: ${ctx.from.first_name || ctx.from.username}\n` +
          `📍 Tópico ID: \`${messageThreadId}\`\n\n` +
          `✅ Logs de ${logType} serão enviados aqui.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        await ctx.reply(
          `❌ Erro ao configurar log:\n\n${result.message}`,
          { parse_mode: 'Markdown' }
        );
      }

    } catch (error) {
      console.error('Erro no comando /log:', error);
      await ctx.reply(
        '❌ Erro ao processar comando de log.\n\n' +
        `Detalhes: ${error.message}`
      );
    }
  });
}

module.exports = setupLogCommand;
