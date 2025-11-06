const db = require('../data/database');

/**
 * Gerenciador de Metadados de Usuário
 * Permite armazenar dados dinâmicos sem alterar a estrutura do banco
 * 
 * @example
 * // Definir idioma
 * await UserMetadata.set(userId, 'language', 'pt-BR');
 * 
 * // Definir pontos
 * await UserMetadata.set(userId, 'loyalty_points', 100, 'number');
 * 
 * // Definir configurações complexas
 * await UserMetadata.set(userId, 'preferences', {
 *   notifications: true,
 *   theme: 'dark'
 * }, 'json');
 * 
 * // Obter valor
 * const language = await UserMetadata.get(userId, 'language');
 * 
 * // Obter todos metadados
 * const allMeta = await UserMetadata.getAll(userId);
 */
class UserMetadata {
  /**
   * Define um metadado para o usuário
   * @param {number} userId - ID do usuário
   * @param {string} key - Chave do metadado
   * @param {*} value - Valor do metadado
   * @param {string} type - Tipo: 'string', 'number', 'boolean', 'json', 'date'
   */
  static async set(userId, key, value, type = 'string') {
    let metaValue = value;

    // Converter valor para string conforme o tipo
    if (type === 'json') {
      metaValue = JSON.stringify(value);
    } else if (type === 'boolean') {
      metaValue = value ? 'true' : 'false';
    } else if (type === 'date') {
      if (value instanceof Date) {
        metaValue = value.toISOString();
      } else {
        metaValue = String(value);
      }
    } else {
      metaValue = String(value);
    }

    await db.callProcedure('sp_set_user_meta', [userId, key, metaValue, type]);
  }

  /**
   * Obtém um metadado do usuário
   * @param {number} userId - ID do usuário
   * @param {string} key - Chave do metadado
   * @returns {Promise<*>} - Valor do metadado (null se não existir)
   */
  static async get(userId, key) {
    const result = await db.callProcedure('sp_get_user_meta', [userId, key]);
    
    if (!result || result.length === 0) {
      return null;
    }

    const { meta_value, meta_type } = result[0];

    // Converter tipo automaticamente
    switch (meta_type) {
      case 'number':
        return parseFloat(meta_value);
      case 'boolean':
        return meta_value === 'true';
      case 'json':
        try {
          return JSON.parse(meta_value);
        } catch (e) {
          console.error(`Erro ao parsear JSON para ${key}:`, e);
          return meta_value;
        }
      case 'date':
        return new Date(meta_value);
      default:
        return meta_value;
    }
  }

  /**
   * Obtém todos os metadados do usuário
   * @param {number} userId - ID do usuário
   * @returns {Promise<Object>} - Objeto com todos os metadados
   */
  static async getAll(userId) {
    const result = await db.callProcedure('sp_get_all_user_meta', [userId]);
    const metadata = {};

    if (!result || result.length === 0) {
      return metadata;
    }

    for (const row of result) {
      const { meta_key, meta_value, meta_type } = row;

      switch (meta_type) {
        case 'number':
          metadata[meta_key] = parseFloat(meta_value);
          break;
        case 'boolean':
          metadata[meta_key] = meta_value === 'true';
          break;
        case 'json':
          try {
            metadata[meta_key] = JSON.parse(meta_value);
          } catch (e) {
            console.error(`Erro ao parsear JSON para ${meta_key}:`, e);
            metadata[meta_key] = meta_value;
          }
          break;
        case 'date':
          metadata[meta_key] = new Date(meta_value);
          break;
        default:
          metadata[meta_key] = meta_value;
      }
    }

    return metadata;
  }

  /**
   * Deleta um metadado
   * @param {number} userId - ID do usuário
   * @param {string} key - Chave do metadado
   */
  static async delete(userId, key) {
    await db.callProcedure('sp_delete_user_meta', [userId, key]);
  }

  /**
   * Incrementa um valor numérico
   * @param {number} userId - ID do usuário
   * @param {string} key - Chave do metadado
   * @param {number} amount - Quantidade a incrementar (padrão: 1)
   */
  static async increment(userId, key, amount = 1) {
    const current = (await this.get(userId, key)) || 0;
    await this.set(userId, key, current + amount, 'number');
  }

  /**
   * Decrementa um valor numérico
   * @param {number} userId - ID do usuário
   * @param {string} key - Chave do metadado
   * @param {number} amount - Quantidade a decrementar (padrão: 1)
   */
  static async decrement(userId, key, amount = 1) {
    const current = (await this.get(userId, key)) || 0;
    await this.set(userId, key, Math.max(0, current - amount), 'number');
  }

  /**
   * Verifica se um metadado existe
   * @param {number} userId - ID do usuário
   * @param {string} key - Chave do metadado
   * @returns {Promise<boolean>}
   */
  static async exists(userId, key) {
    const value = await this.get(userId, key);
    return value !== null;
  }

  /**
   * Define múltiplos metadados de uma vez
   * @param {number} userId - ID do usuário
   * @param {Object} metadata - Objeto com os metadados {key: {value, type}}
   * 
   * @example
   * await UserMetadata.setMultiple(userId, {
   *   language: { value: 'pt-BR', type: 'string' },
   *   notifications: { value: true, type: 'boolean' },
   *   points: { value: 100, type: 'number' }
   * });
   */
  static async setMultiple(userId, metadata) {
    const promises = [];

    for (const [key, data] of Object.entries(metadata)) {
      const { value, type = 'string' } = data;
      promises.push(this.set(userId, key, value, type));
    }

    await Promise.all(promises);
  }
}

module.exports = UserMetadata;
