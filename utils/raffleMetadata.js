const db = require('../data/database');

/**
 * Classe para gerenciar metadados de sorteios
 * Padrão similar ao userMetadata.js
 */
class RaffleMetadata {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Define um metadado para um sorteio
   * @param {string} raffleId - ID do sorteio
   * @param {string} key - Nome do metadado
   * @param {any} value - Valor do metadado
   */
  async set(raffleId, key, value) {
    try {
      // Converter valor para string se necessário
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      await db.callProcedure('sp_set_raffle_meta', [raffleId, key, stringValue]);
      
      // Atualizar cache
      const cacheKey = `${raffleId}:${key}`;
      this.cache.set(cacheKey, value);
      
      return true;
    } catch (error) {
      console.error(`Erro ao definir metadata ${key} para sorteio ${raffleId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém um metadado específico de um sorteio
   * @param {string} raffleId - ID do sorteio
   * @param {string} key - Nome do metadado
   * @returns {any} Valor do metadado ou null
   */
  async get(raffleId, key) {
    try {
      // Verificar cache
      const cacheKey = `${raffleId}:${key}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      const result = await db.callProcedure('sp_get_raffle_meta', [raffleId, key]);
      
      if (result && result[0] && result[0].length > 0) {
        const row = result[0][0];
        let value = row.valueMetadata;
        
        // Tentar parsear JSON se o tipo for json
        if (row.typeMetadata === 'json' && value) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Se falhar, retornar como string
          }
        }
        
        // Atualizar cache
        this.cache.set(cacheKey, value);
        return value;
      }
      
      return null;
    } catch (error) {
      console.error(`Erro ao obter metadata ${key} do sorteio ${raffleId}:`, error);
      return null;
    }
  }

  /**
   * Obtém todos os metadados de um sorteio
   * @param {string} raffleId - ID do sorteio
   * @returns {Object} Objeto com todos os metadados
   */
  async getAll(raffleId) {
    try {
      const result = await db.callProcedure('sp_get_all_raffle_meta', [raffleId]);
      
      if (!result || !result[0] || result[0].length === 0) {
        return {};
      }

      const metadata = {};
      
      for (const row of result[0]) {
        let value = row.meta_value;
        
        // Parsear JSON se necessário
        if (row.meta_type === 'json' && value) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Se falhar, manter como string
          }
        }
        
        metadata[row.meta_key] = value;
        
        // Atualizar cache
        const cacheKey = `${raffleId}:${row.meta_key}`;
        this.cache.set(cacheKey, value);
      }
      
      return metadata;
    } catch (error) {
      console.error(`Erro ao obter todos os metadados do sorteio ${raffleId}:`, error);
      return {};
    }
  }

  /**
   * Define múltiplos metadados de uma vez
   * @param {string} raffleId - ID do sorteio
   * @param {Object} metadata - Objeto com pares chave-valor
   */
  async setMultiple(raffleId, metadata) {
    try {
      const promises = [];
      
      for (const [key, value] of Object.entries(metadata)) {
        if (value !== null && value !== undefined) {
          promises.push(this.set(raffleId, key, value));
        }
      }
      
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error(`Erro ao definir múltiplos metadados para sorteio ${raffleId}:`, error);
      throw error;
    }
  }

  /**
   * Salva informações parseadas da legenda como metadata
   * @param {string} raffleId - ID do sorteio
   * @param {Object} captionInfo - Objeto retornado por parseCaptionInfo()
   */
  async saveCaptionInfo(raffleId, captionInfo) {
    try {
      const metadata = {};
      
      if (captionInfo.title) {
        metadata.raffle_title = captionInfo.title;
      }
      
      if (captionInfo.raffleDate) {
        metadata.raffle_date = captionInfo.raffleDate;
      }
      
      if (captionInfo.raffleType) {
        metadata.raffle_type = captionInfo.raffleType;
      }
      
      if (captionInfo.prizeDescription) {
        metadata.prize_description = captionInfo.prizeDescription;
      }
      
      await this.setMultiple(raffleId, metadata);
      
      console.log(`[RAFFLE METADATA] Informações da legenda salvas para ${raffleId}:`, metadata);
      
      return true;
    } catch (error) {
      console.error(`Erro ao salvar informações da legenda para ${raffleId}:`, error);
      throw error;
    }
  }

  /**
   * Remove um metadado
   * @param {string} raffleId - ID do sorteio
   * @param {string} key - Nome do metadado
   */
  async delete(raffleId, key) {
    try {
      await db.callProcedure('sp_delete_raffle_meta', [raffleId, key]);
      
      // Remover do cache
      const cacheKey = `${raffleId}:${key}`;
      this.cache.delete(cacheKey);
      
      return true;
    } catch (error) {
      console.error(`Erro ao deletar metadata ${key} do sorteio ${raffleId}:`, error);
      throw error;
    }
  }

  /**
   * Limpa o cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Exportar instância singleton
module.exports = new RaffleMetadata();
