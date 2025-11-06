/**
 * Comando /help - Mostra todos os comandos disponíveis
 */
function setupHelpCommand(bot) {
  bot.command('help', async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;

    try {
      // Verificar se é admin (não precisa do db para comandos básicos)
      const isOwner = userId === 121823278;
      
      let helpMessage = `📚 **Comandos Disponíveis**\n\n`;

      // Comandos para todos
      helpMessage += `👥 **Para Todos:**\n`;
      helpMessage += `/start - Registrar-se no sistema\n`;
      helpMessage += `/assinatura - Ver status da sua assinatura\n`;
      helpMessage += `/assinaturas - Ver status da sua assinatura\n`;
      helpMessage += `/renovar - Informações para renovar\n`;
      helpMessage += `/help - Mostrar esta mensagem\n\n`;

      // Comandos de admin (se aplicável)
      if (isOwner) {
        helpMessage += `🔧 **Administração:**\n`;
        helpMessage += `/newadm - Adicionar novo admin\n`;
        helpMessage += `/admins - Listar todos os admins\n`;
        helpMessage += `/adduser - Registrar usuário (responder msg)\n`;
        helpMessage += `/novosorteio - Criar novo sorteio\n`;
        helpMessage += `/register - Registrar vencedores\n`;
        helpMessage += `/log - Configurar logs (owner)\n`;
        helpMessage += `/caixa - Ver saldo da comunidade\n\n`;

        helpMessage += `📊 **Consultas (Privado):**\n`;
        helpMessage += `/sorteios - Ver sorteios por status\n`;
        helpMessage += `/participantes <código> - Ver participantes de um sorteio\n`;
        helpMessage += `/assinaturas - Gerenciar assinaturas (ativas/expiradas/canceladas)\n\n`;

        helpMessage += `📊 **Sistema de Logs:**\n`;
        helpMessage += `Use /log em um tópico para configurar:\n`;
        helpMessage += `• \`settings\` - Alterações de config\n`;
        helpMessage += `• \`basic\` - Ações básicas\n`;
        helpMessage += `• \`raffle\` - Sorteios\n`;
        helpMessage += `• \`subscription\` - Assinaturas\n`;
        helpMessage += `• \`admin\` - Ações admin\n`;
        helpMessage += `• \`error\` - Erros do sistema\n\n`;
      }

      helpMessage += `🎯 **Como Participar:**\n`;
      helpMessage += `1. Use /start para se registrar\n`;
      helpMessage += `2. Clique em "Participar" quando houver sorteio\n`;
      helpMessage += `3. Aguarde o resultado!\n\n`;

      helpMessage += `💡 **Dica:** No Clubinho FNBR é necessário ter assinatura ativa (R$ 3,00/mês)`;

      await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Erro no comando help:', error);
      ctx.reply('Erro ao carregar comandos.');
    }
  });
}

module.exports = {
  setupHelpCommand
};
