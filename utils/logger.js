const fs = require('fs');
const path = require('path');

const LOG_CONFIG_PATH = path.join(__dirname, '../data/json/logconfig.json');

/**
 * Logger centralizado do bot
 * Gerencia envio de logs para tópicos específicos do grupo de logs
 */
class Logger {
  constructor(bot) {
    this.bot = bot;
    this.config = this.loadConfig();
  }

  /**
   * Carrega configuração de logs do arquivo JSON
   */
  loadConfig() {
    try {
      if (!fs.existsSync(LOG_CONFIG_PATH)) {
        const defaultConfig = {
          logGroup: null,
          topics: {
            settings: null,
            basic: null,
            raffle: null,
            subscription: null,
            admin: null,
            error: null
          }
        };
        fs.writeFileSync(LOG_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
        return defaultConfig;
      }
      
      const data = fs.readFileSync(LOG_CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Erro ao carregar configuração de logs:', error);
      return {
        logGroup: null,
        topics: {
          settings: null,
          basic: null,
          raffle: null,
          subscription: null,
          admin: null,
          error: null
        }
      };
    }
  }

  /**
   * Salva configuração de logs no arquivo JSON
   */
  saveConfig() {
    try {
      fs.writeFileSync(LOG_CONFIG_PATH, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('Erro ao salvar configuração de logs:', error);
      return false;
    }
  }

  /**
   * Configura um tópico de log
   * @param {string} logType - Tipo de log (settings, basic, raffle, subscription, admin, error)
   * @param {number} groupId - ID do grupo
   * @param {number} topicId - ID do tópico (message_thread_id)
   */
  setLogTopic(logType, groupId, topicId) {
    if (!this.config.topics.hasOwnProperty(logType)) {
      return { success: false, message: `Tipo de log inválido: ${logType}` };
    }

    this.config.logGroup = groupId;
    this.config.topics[logType] = topicId;
    
    if (this.saveConfig()) {
      return { success: true, message: `Tópico ${logType} configurado com sucesso!` };
    } else {
      return { success: false, message: 'Erro ao salvar configuração' };
    }
  }

  /**
   * Envia log para o tópico apropriado
   * @param {string} logType - Tipo de log (settings, basic, raffle, subscription, admin, error)
   * @param {string} message - Mensagem do log
   * @param {object} options - Opções adicionais (parse_mode, etc)
   */
  async sendLog(logType, message, options = {}) {
    try {
      // Verificar se o tipo de log é válido
      if (!this.config.topics.hasOwnProperty(logType)) {
        console.error(`Tipo de log inválido: ${logType}`);
        return false;
      }

      // Verificar se o grupo e tópico estão configurados
      if (!this.config.logGroup || !this.config.topics[logType]) {
        console.warn(`Log ${logType} não configurado. Mensagem: ${message}`);
        return false;
      }

      // Preparar opções de envio
      const sendOptions = {
        parse_mode: options.parse_mode || 'Markdown',
        message_thread_id: this.config.topics[logType],
        ...options
      };

      // Adicionar timestamp ao log
      const timestamp = new Date().toLocaleString('pt-BR', { 
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'medium'
      });
      const logMessage = `🕐 ${timestamp}\n\n${message}`;

      // Enviar mensagem para o grupo
      await this.bot.telegram.sendMessage(
        this.config.logGroup,
        logMessage,
        sendOptions
      );

      return true;
    } catch (error) {
      console.error(`Erro ao enviar log ${logType}:`, error);
      
      // Tentar enviar erro para tópico de erro (se configurado e diferente)
      if (logType !== 'error' && this.config.topics.error) {
        try {
          await this.bot.telegram.sendMessage(
            this.config.logGroup,
            `❌ Erro ao enviar log ${logType}:\n\n${error.message}`,
            { 
              parse_mode: 'Markdown',
              message_thread_id: this.config.topics.error 
            }
          );
        } catch (err) {
          console.error('Erro ao enviar log de erro:', err);
        }
      }
      
      return false;
    }
  }

  /**
   * Atalhos para tipos específicos de log
   */
  async logSettings(message, options) {
    return await this.sendLog('settings', message, options);
  }

  async logBasic(message, options) {
    return await this.sendLog('basic', message, options);
  }

  async logRaffle(message, options) {
    return await this.sendLog('raffle', message, options);
  }

  async logSubscription(message, options) {
    return await this.sendLog('subscription', message, options);
  }

  async logAdmin(message, options) {
    return await this.sendLog('admin', message, options);
  }

  async logError(message, options) {
    return await this.sendLog('error', message, options);
  }

  /**
   * Retorna status de configuração dos logs
   */
  getStatus() {
    const status = {
      configured: this.config.logGroup !== null,
      groupId: this.config.logGroup,
      topics: {}
    };

    for (const [type, topicId] of Object.entries(this.config.topics)) {
      status.topics[type] = {
        configured: topicId !== null,
        topicId: topicId
      };
    }

    return status;
  }
}

module.exports = Logger;
