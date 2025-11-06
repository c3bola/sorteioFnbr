require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./data/database');
const { setupNovosorteioCommand } = require('./commands/novosorteio');
const { setupNewadmCommand } = require('./commands/newadm');
const { setupAdminsCommand } = require('./commands/admins');
const { setupAdduserCommand } = require('./commands/adduser');
const { setupRegisterCommand } = require('./commands/register');
const { setupStartCommand } = require('./commands/start');
const { setupHelpCommand } = require('./commands/help');
const { setupSubscriptionCommand } = require('./commands/subscription');
const setupLogCommand = require('./commands/log');
const { setupActionHandlers } = require('./handlers/actions');
const SubscriptionNotifier = require('./utils/subscriptionNotifier');

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN não está definido no arquivo .env');
  process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Configurar comandos
setupStartCommand(bot);
setupHelpCommand(bot);
setupNovosorteioCommand(bot);
setupNewadmCommand(bot);
setupAdminsCommand(bot);
setupAdduserCommand(bot);
setupRegisterCommand(bot);
setupSubscriptionCommand(bot);
setupLogCommand(bot);
setupActionHandlers(bot);

// Testar conexão com banco de dados ao iniciar
bot.launch().then(async () => {
  console.log('🤖 Bot iniciado com sucesso!');
  
  // Testar conexão com MySQL
  const dbConnected = await db.testConnection();
  if (!dbConnected) {
    console.error('⚠️  Aviso: Falha na conexão com o banco de dados!');
  } else {
    // Iniciar sistema de notificações de assinaturas
    const notifier = new SubscriptionNotifier(bot);
    notifier.start();
    console.log('✅ Sistema de notificações de assinaturas ativado');
  }
}).catch((error) => {
  console.error('❌ Erro ao iniciar bot:', error);
  process.exit(1);
});


