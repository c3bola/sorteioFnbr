/**
 * Database Connection Module
 * Gerencia conexões com MySQL usando pool para melhor performance
 * e persistência de dados
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

// Configurações do pool de conexões
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fnbr_sorteios',
  port: parseInt(process.env.DB_PORT || '3306'),
  
  // Pool de conexões
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
  queueLimit: 0, // Sem limite de fila
  
  // Configurações de timeout e reconexão
  connectTimeout: 10000, // 10 segundos
  waitForConnections: true,
  
  // Charset e timezone
  charset: 'utf8mb4',
  timezone: 'Z',
  
  // Manter conexões vivas
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  
  // Suporte a múltiplas queries (necessário para CALL procedures)
  multipleStatements: true
};

// Validar variáveis de ambiente obrigatórias
// if (!process.env.DB_PASSWORD) {
//   console.error('❌ ERRO: DB_PASSWORD não está definido no arquivo .env');
//   process.exit(1);
// }

// Criar o pool de conexões
const pool = mysql.createPool(poolConfig);

/**
 * Testa a conexão com o banco de dados
 * @returns {Promise<boolean>}
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexão com MySQL estabelecida com sucesso!');
    console.log(`📊 Database: ${poolConfig.database}`);
    console.log(`🔌 Host: ${poolConfig.host}:${poolConfig.port}`);
    console.log(`🏊 Pool Size: ${poolConfig.connectionLimit} conexões`);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar com MySQL:', error.message);
    return false;
  }
}

/**
 * Executa uma query simples
 * @param {string} sql - Query SQL
 * @param {Array} params - Parâmetros da query
 * @returns {Promise<Array>}
 */
async function query(sql, params = []) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(sql, params);
    connection.release();
    return rows;
  } catch (error) {
    if (connection) connection.release();
    console.error('❌ Erro na query:', error.message);
    throw error;
  }
}

/**
 * Executa múltiplas queries em uma transação
 * Garante atomicidade das operações (todas executam ou nenhuma)
 * @param {Function} callback - Função que recebe a conexão e executa as queries
 * @returns {Promise<any>}
 */
async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    connection.release();
    return result;
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('❌ Erro na transação:', error.message);
    throw error;
  }
}

/**
 * Executa uma stored procedure
 * @param {string} procedureName - Nome da procedure
 * @param {Array} params - Parâmetros da procedure
 * @returns {Promise<Array>}
 */
async function callProcedure(procedureName, params = []) {
  const placeholders = params.map(() => '?').join(', ');
  const sql = `CALL ${procedureName}(${placeholders})`;
  
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query(sql, params);
    connection.release();
    
    // Retornar o primeiro resultado set (a maioria das procedures retorna um)
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : [];
  } catch (error) {
    console.error(`❌ Erro ao executar procedure ${procedureName}:`, error.message);
    throw error;
  }
}

/**
 * Fecha o pool de conexões
 * Deve ser chamado antes de encerrar a aplicação
 */
async function close() {
  try {
    await pool.end();
    console.log('🔌 Pool de conexões MySQL fechado');
  } catch (error) {
    console.error('❌ Erro ao fechar pool:', error.message);
  }
}

/**
 * Obtém estatísticas do pool de conexões
 * @returns {Object}
 */
function getPoolStats() {
  return {
    totalConnections: pool.pool._allConnections.length,
    freeConnections: pool.pool._freeConnections.length,
    queueLength: pool.pool._connectionQueue.length
  };
}

// Event listeners para monitoramento
pool.on('acquire', (connection) => {
  console.log('🔗 Conexão %d adquirida', connection.threadId);
});

pool.on('release', (connection) => {
  console.log('🔓 Conexão %d liberada', connection.threadId);
});

pool.on('enqueue', () => {
  console.log('⏳ Aguardando conexão disponível no pool');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Encerrando aplicação...');
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Encerrando aplicação...');
  await close();
  process.exit(0);
});

// Exportar funcionalidades
module.exports = {
  pool,
  query,
  transaction,
  callProcedure,
  testConnection,
  close,
  getPoolStats
};
