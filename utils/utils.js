/**
 * Utilidades do Bot - Atualizado para nova estrutura de banco
 * Usa tbUser e tbPerfilUser ao invés de JSON
 */

const db = require('../data/database');

/**
 * Verifica se um usuário é admin (owner, admin ou moderator)
 * @param {Object} ctx - Contexto do Telegraf
 * @returns {Promise<boolean>}
 */
async function isAdmin(ctx) {
  try {
    const userId = ctx.from.id;
    
    // Consultar banco de dados usando a nova estrutura
    const result = await db.query(
      `SELECT u.idUser, p.namePerfilUser 
       FROM tbUser u
       JOIN tbPerfilUser p ON u.fkIdPerfilUser = p.idPerfilUser
       WHERE u.idUser = ? 
         AND p.statusPerfilUser = 1
         AND p.namePerfilUser IN ('owner', 'admin', 'moderator')`,
      [userId]
    );
    
    return result && result.length > 0;
  } catch (error) {
    console.error('❌ Erro ao verificar admin:', error);
    return false;
  }
}

/**
 * Verifica se um usuário tem permissão de owner
 * @param {Object} ctx - Contexto do Telegraf
 * @returns {Promise<boolean>}
 */
async function isOwner(ctx) {
  try {
    const userId = ctx.from.id;
    
    const result = await db.query(
      `SELECT u.idUser 
       FROM tbUser u
       JOIN tbPerfilUser p ON u.fkIdPerfilUser = p.idPerfilUser
       WHERE u.idUser = ? 
         AND p.namePerfilUser = 'owner'
         AND p.statusPerfilUser = 1`,
      [userId]
    );
    
    return result && result.length > 0;
  } catch (error) {
    console.error('❌ Erro ao verificar owner:', error);
    return false;
  }
}

/**
 * Obtém o perfil de um usuário
 * @param {number} userId - ID do usuário
 * @returns {Promise<string|null>} - Nome do perfil ou null
 */
async function getUserProfile(userId) {
  try {
    const result = await db.query(
      `SELECT p.namePerfilUser 
       FROM tbUser u
       JOIN tbPerfilUser p ON u.fkIdPerfilUser = p.idPerfilUser
       WHERE u.idUser = ?`,
      [userId]
    );
    
    return result && result.length > 0 ? result[0].namePerfilUser : null;
  } catch (error) {
    console.error('❌ Erro ao obter perfil:', error);
    return null;
  }
}

/**
 * Escapa caracteres especiais para MarkdownV2
 * @param {string} text - Texto para escapar
 * @returns {string} - Texto escapado
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString().replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

module.exports = {
  isAdmin,
  isOwner,
  getUserProfile,
  escapeMarkdown
};
