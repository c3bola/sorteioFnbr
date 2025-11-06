const db = require('../data/database');
const Logger = require('./logger');

/**
 * Sistema de Notificações de Vencimento de Assinaturas
 * Executa diariamente às 06:00 (horário de Brasília - UTC-3)
 */

class SubscriptionNotifier {
  constructor(bot) {
    this.bot = bot;
    this.logger = new Logger(bot);
    this.isRunning = false;
  }

  /**
   * Inicia o agendamento de notificações
   * Executa às 06:00 horário de Brasília (09:00 UTC)
   */
  start() {
    console.log('📅 [NOTIFIER] Sistema de notificações iniciado');
    
    // Executar imediatamente ao iniciar (para teste)
    // this.checkExpiringSubscriptions();
    
    // Calcular próxima execução (06:00 Brasília = 09:00 UTC)
    this.scheduleNextRun();
  }

  /**
   * Agenda a próxima execução para 06:00 Brasília (09:00 UTC)
   */
  scheduleNextRun() {
    const now = new Date();
    const next = new Date();
    
    // Horário de Brasília: 06:00 = UTC 09:00
    next.setUTCHours(9, 0, 0, 0);
    
    // Se já passou das 09:00 UTC hoje, agendar para amanhã
    if (now.getTime() >= next.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    
    const timeUntilNext = next.getTime() - now.getTime();
    const hours = Math.floor(timeUntilNext / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log(`📅 [NOTIFIER] Próxima verificação em ${hours}h ${minutes}min (${next.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})`);
    
    setTimeout(() => {
      this.checkExpiringSubscriptions();
      // Agendar próxima execução (24h depois)
      setInterval(() => {
        this.checkExpiringSubscriptions();
      }, 24 * 60 * 60 * 1000); // 24 horas
    }, timeUntilNext);
  }

  /**
   * Verifica assinaturas que estão próximas do vencimento
   * Notifica usuários 2 dias antes até o dia do vencimento
   */
  async checkExpiringSubscriptions() {
    if (this.isRunning) {
      console.log('⚠️ [NOTIFIER] Verificação já em execução, pulando...');
      return;
    }

    this.isRunning = true;
    const now = new Date();
    const brasiliaTime = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    console.log(`📅 [NOTIFIER] Iniciando verificação de assinaturas - ${brasiliaTime}`);

    try {
      // Buscar assinaturas que vencem nos próximos 2 dias (incluindo hoje)
      const expiringSubscriptions = await db.query(
        `SELECT 
          s.idSubscription,
          s.fkIdUser,
          s.fkIdGroup,
          s.endDate,
          s.amountPaid,
          DATEDIFF(s.endDate, CURDATE()) AS days_remaining,
          (SELECT mu.valueMetadata FROM tbMetadataUser mu 
           JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
           WHERE mu.fkIdUser = s.fkIdUser AND m.nameMetadata = 'name' LIMIT 1) AS user_name,
          g.nameGroup AS group_name
         FROM tbSubscription s
         JOIN tbGroup g ON s.fkIdGroup = g.idGroup
         WHERE s.statusSubscription = 'active'
           AND DATEDIFF(s.endDate, CURDATE()) >= 0
           AND DATEDIFF(s.endDate, CURDATE()) <= 2
         ORDER BY s.endDate ASC`
      );

      if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
        console.log('✅ [NOTIFIER] Nenhuma assinatura próxima do vencimento');
        this.isRunning = false;
        return;
      }

      console.log(`📬 [NOTIFIER] ${expiringSubscriptions.length} assinatura(s) próxima(s) do vencimento`);

      let notified = 0;
      let failed = 0;

      for (const subscription of expiringSubscriptions) {
        try {
          const daysRemaining = subscription.days_remaining;
          const endDate = new Date(subscription.endDate).toLocaleDateString('pt-BR');
          const userName = subscription.user_name || 'Usuário';
          const groupName = subscription.group_name || 'Grupo';

          let message = '';
          let emoji = '';

          if (daysRemaining === 0) {
            // Vence hoje
            emoji = '⚠️';
            message = 
              `${emoji} *ÚLTIMO DIA DE ASSINATURA*\n\n` +
              `Olá ${userName}!\n\n` +
              `Sua assinatura do *${groupName}* vence *HOJE* (${endDate}).\n\n` +
              `💰 *Valor pago:* R$ ${subscription.amountPaid.toFixed(2)}\n\n` +
              `❗ Renove agora para não perder o acesso aos sorteios!\n\n` +
              `📱 Entre em contato com um administrador para renovar.`;
          } else if (daysRemaining === 1) {
            // Vence amanhã
            emoji = '⏰';
            message = 
              `${emoji} *ASSINATURA VENCENDO EM BREVE*\n\n` +
              `Olá ${userName}!\n\n` +
              `Sua assinatura do *${groupName}* vence *amanhã* (${endDate}).\n\n` +
              `💰 *Valor pago:* R$ ${subscription.amountPaid.toFixed(2)}\n` +
              `⏰ *Falta apenas:* 1 dia\n\n` +
              `📱 Entre em contato com um administrador para renovar.`;
          } else {
            // Vence em 2 dias
            emoji = '📅';
            message = 
              `${emoji} *LEMBRETE DE ASSINATURA*\n\n` +
              `Olá ${userName}!\n\n` +
              `Sua assinatura do *${groupName}* vence em *${daysRemaining} dias* (${endDate}).\n\n` +
              `💰 *Valor pago:* R$ ${subscription.amountPaid.toFixed(2)}\n\n` +
              `💡 Não se esqueça de renovar para continuar participando dos sorteios!\n\n` +
              `📱 Entre em contato com um administrador.`;
          }

          // Enviar notificação
          await this.bot.telegram.sendMessage(
            subscription.fkIdUser,
            message,
            { parse_mode: 'Markdown' }
          );

          console.log(`✅ [NOTIFIER] Notificado: ${userName} (${subscription.fkIdUser}) - ${daysRemaining} dia(s) restante(s)`);
          notified++;

          // Aguardar 100ms entre mensagens para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`❌ [NOTIFIER] Erro ao notificar usuário ${subscription.fkIdUser}:`, error.message);
          failed++;
        }
      }

      // Log de resumo
      console.log(`📊 [NOTIFIER] Resumo: ${notified} notificados, ${failed} falhas`);

      // Enviar log para o canal de logs
      await this.logger.logSubscription(
        `📬 **Notificações de Vencimento Enviadas**\n\n` +
        `✅ **Notificados:** ${notified}\n` +
        `❌ **Falhas:** ${failed}\n` +
        `📅 **Total verificado:** ${expiringSubscriptions.length}\n` +
        `⏰ **Horário:** ${brasiliaTime}\n\n` +
        `**Detalhes:**\n` +
        expiringSubscriptions.map(s => 
          `• ${s.user_name} - ${s.days_remaining} dia(s) - ${s.group_name}`
        ).join('\n')
      );

    } catch (error) {
      console.error('❌ [NOTIFIER] Erro na verificação de assinaturas:', error);
      
      await this.logger.logError(
        `❌ **Erro no Sistema de Notificações**\n\n` +
        `🐛 **Erro:** ${error.message}\n` +
        `📅 **Data:** ${brasiliaTime}`
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Para o sistema de notificações (útil para testes)
   */
  stop() {
    console.log('🛑 [NOTIFIER] Sistema de notificações parado');
  }

  /**
   * Execução manual para testes
   */
  async testNotification() {
    console.log('🧪 [NOTIFIER] Executando teste manual...');
    await this.checkExpiringSubscriptions();
  }
}

module.exports = SubscriptionNotifier;
