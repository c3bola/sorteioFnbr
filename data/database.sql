-- =====================================================
-- Script SQL Otimizado - Bot Sorteios FNBR
-- Baseado no diagrama ER criado pelo usuário
-- Versão melhorada com tipos corretos e estrutura otimizada
-- =====================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- =====================================================
-- Criar Database
-- =====================================================
CREATE DATABASE IF NOT EXISTS `fnbr_sorteios` 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `fnbr_sorteios`;

-- =====================================================
-- Tabela: tbPerfilUser (Perfis de Usuário)
-- Tipos: owner, admin, moderator, user
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbPerfilUser` (
  `idPerfilUser` INT NOT NULL AUTO_INCREMENT,
  `namePerfilUser` VARCHAR(50) NOT NULL COMMENT 'Nome do perfil: owner, admin, moderator, user',
  `statusPerfilUser` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = ativo, 0 = inativo',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idPerfilUser`),
  UNIQUE INDEX `idx_name_perfil` (`namePerfilUser` ASC)
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Perfis de usuário do sistema';

-- =====================================================
-- Tabela: tbUser (Usuários do Telegram)
-- Apenas ID e perfil - outros dados em tbMetadataUser
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbUser` (
  `idUser` BIGINT NOT NULL COMMENT 'ID do Telegram (pode ser muito grande)',
  `fkIdPerfilUser` INT NOT NULL DEFAULT 4 COMMENT 'FK para tbPerfilUser (padrão: user)',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Quando entrou no sistema',
  PRIMARY KEY (`idUser`),
  INDEX `idx_perfil` (`fkIdPerfilUser` ASC),
  INDEX `idx_created` (`createdAt` ASC),
  CONSTRAINT `fk_user_perfil`
    FOREIGN KEY (`fkIdPerfilUser`)
    REFERENCES `tbPerfilUser` (`idPerfilUser`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Usuários do sistema - dados pessoais em tbMetadataUser';

-- =====================================================
-- Tabela: tbMetadata (Definição de Metadados UNIFICADA)
-- Define quais metadados podem ser armazenados para TODAS as entidades
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbMetadata` (
  `idMetadata` INT NOT NULL AUTO_INCREMENT,
  `nameMetadata` VARCHAR(100) NOT NULL COMMENT 'Nome do metadado: language, loyalty_points, raffle_title, etc',
  `entityType` ENUM('user', 'raffle', 'group', 'subscription', 'general') NOT NULL DEFAULT 'user' COMMENT 'Tipo de entidade: user, raffle, group, etc',
  `typeMetadata` ENUM('string', 'number', 'boolean', 'json', 'date') NOT NULL DEFAULT 'string' COMMENT 'Tipo do dado',
  `descriptionMetadata` VARCHAR(255) NULL COMMENT 'Descrição do metadado',
  `statusMetadata` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = ativo, 0 = inativo',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idMetadata`),
  UNIQUE INDEX `idx_name_metadata` (`nameMetadata` ASC),
  INDEX `idx_entity_type` (`entityType` ASC)
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Definições de metadados UNIFICADAS para todas as entidades';

-- =====================================================
-- Tabela: tbMetadataUser (Valores dos Metadados por Usuário)
-- Armazena os valores dos metadados para cada usuário
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbMetadataUser` (
  `fkIdUser` BIGINT NOT NULL,
  `fkIdMetadata` INT NOT NULL,
  `valueMetadata` TEXT NOT NULL COMMENT 'Valor do metadado (armazenado como texto)',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`fkIdUser`, `fkIdMetadata`),
  INDEX `idx_metadata` (`fkIdMetadata` ASC),
  INDEX `idx_user` (`fkIdUser` ASC),
  CONSTRAINT `fk_metadata_user`
    FOREIGN KEY (`fkIdUser`)
    REFERENCES `tbUser` (`idUser`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_metadata_definition`
    FOREIGN KEY (`fkIdMetadata`)
    REFERENCES `tbMetadata` (`idMetadata`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Valores dos metadados por usuário';

-- =====================================================
-- Tabela: tbMetadataRaffle (Valores dos Metadados por Sorteio)
-- Armazena os valores dos metadados para cada sorteio
-- Usa a mesma tbMetadata unificada (entityType = 'raffle')
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbMetadataRaffle` (
  `idMetadataRaffle` INT NOT NULL AUTO_INCREMENT,
  `fkIdRafflesDetails` VARCHAR(50) NOT NULL COMMENT 'ID do sorteio',
  `fkIdMetadata` INT NOT NULL COMMENT 'ID do metadado',
  `valueMetadata` TEXT NULL COMMENT 'Valor do metadado',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idMetadataRaffle`),
  UNIQUE INDEX `idx_unique_raffle_metadata` (`fkIdRafflesDetails` ASC, `fkIdMetadata` ASC),
  INDEX `idx_raffle` (`fkIdRafflesDetails` ASC),
  INDEX `idx_metadata` (`fkIdMetadata` ASC),
  CONSTRAINT `fk_metadata_raffle_raffle`
    FOREIGN KEY (`fkIdRafflesDetails`)
    REFERENCES `tbRafflesDetails` (`idRafflesDetails`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_metadata_raffle_definition`
    FOREIGN KEY (`fkIdMetadata`)
    REFERENCES `tbMetadata` (`idMetadata`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Valores dos metadados por sorteio - usa tbMetadata unificada';

-- =====================================================
-- Tabela: tbGroup (Grupos do Telegram)
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbGroup` (
  `idGroup` BIGINT NOT NULL COMMENT 'ID do grupo no Telegram',
  `nameGroup` VARCHAR(255) NOT NULL COMMENT 'Nome do grupo',
  `requiresSubscription` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = requer assinatura, 0 = gratuito',
  `statusGroup` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = ativo, 0 = inativo',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idGroup`),
  INDEX `idx_requires_subscription` (`requiresSubscription` ASC)
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Grupos do Telegram onde o bot opera';

-- =====================================================
-- Tabela: tbRafflesDetails (Detalhes do Sorteio)
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbRafflesDetails` (
  `idRafflesDetails` VARCHAR(50) NOT NULL COMMENT 'ID único do sorteio (ex: raffle_123456)',
  `fkIdGroup` BIGINT NOT NULL COMMENT 'Grupo onde o sorteio ocorreu',
  `numWinners` INT NOT NULL DEFAULT 1 COMMENT 'Número de vencedores',
  `participantCount` INT NOT NULL DEFAULT 0 COMMENT 'Total de participantes',
  `statusRaffles` ENUM('open', 'closed', 'drawn', 'cancelled') NOT NULL DEFAULT 'open' COMMENT 'Status do sorteio',
  `prizeDescription` TEXT NULL COMMENT 'Descrição do prêmio',
  `fileIdRaffles` VARCHAR(255) NULL COMMENT 'ID do arquivo/imagem do sorteio no Telegram',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Quando o sorteio foi criado',
  `performedAt` TIMESTAMP NULL COMMENT 'Quando o sorteio foi realizado',
  PRIMARY KEY (`idRafflesDetails`),
  INDEX `idx_group` (`fkIdGroup` ASC),
  INDEX `idx_status` (`statusRaffles` ASC),
  INDEX `idx_created` (`createdAt` ASC),
  CONSTRAINT `fk_raffles_group`
    FOREIGN KEY (`fkIdGroup`)
    REFERENCES `tbGroup` (`idGroup`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Detalhes dos sorteios realizados';

-- =====================================================
-- Tabela: tbRaffles (Participações em Sorteios)
-- Relaciona usuários com sorteios
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbRaffles` (
  `idRaffles` INT NOT NULL AUTO_INCREMENT COMMENT 'ID único da participação',
  `fkIdUser` BIGINT NOT NULL,
  `fkIdRafflesDetails` VARCHAR(50) NOT NULL,
  `isWinner` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = vencedor, 0 = participante',
  `winPosition` INT NULL COMMENT 'Posição do vencedor (1º, 2º, 3º, etc)',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`idRaffles`),
  UNIQUE INDEX `idx_unique_participation` (`fkIdUser` ASC, `fkIdRafflesDetails` ASC) COMMENT 'Usuário só pode participar uma vez por sorteio',
  INDEX `idx_raffles_details` (`fkIdRafflesDetails` ASC),
  INDEX `idx_user` (`fkIdUser` ASC),
  INDEX `idx_winner` (`isWinner` ASC),
  CONSTRAINT `fk_raffles_user`
    FOREIGN KEY (`fkIdUser`)
    REFERENCES `tbUser` (`idUser`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_raffles_details`
    FOREIGN KEY (`fkIdRafflesDetails`)
    REFERENCES `tbRafflesDetails` (`idRafflesDetails`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Participações dos usuários em sorteios';

-- =====================================================
-- Tabela: tbSubscription (Assinaturas)
-- =====================================================
CREATE TABLE IF NOT EXISTS `tbSubscription` (
  `idSubscription` INT NOT NULL AUTO_INCREMENT,
  `fkIdUser` BIGINT NOT NULL,
  `fkIdGroup` BIGINT NOT NULL COMMENT 'Grupo da assinatura',
  `startDate` DATE NOT NULL COMMENT 'Data de início',
  `endDate` DATE NOT NULL COMMENT 'Data de expiração',
  `statusSubscription` ENUM('active', 'expired', 'cancelled') NOT NULL DEFAULT 'active',
  `amountPaid` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Valor pago em reais',
  `paymentMethod` VARCHAR(100) NULL COMMENT 'Método de pagamento (PIX, transferência, etc)',
  `fileIdSubscription` VARCHAR(255) NULL COMMENT 'ID do arquivo de comprovante no Telegram',
  `notesSubscription` TEXT NULL COMMENT 'Observações',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`idSubscription`),
  INDEX `idx_user` (`fkIdUser` ASC),
  INDEX `idx_group` (`fkIdGroup` ASC),
  INDEX `idx_status` (`statusSubscription` ASC),
  INDEX `idx_end_date` (`endDate` ASC),
  INDEX `idx_active_expiring` (`statusSubscription` ASC, `endDate` ASC),
  CONSTRAINT `fk_subscription_user`
    FOREIGN KEY (`fkIdUser`)
    REFERENCES `tbUser` (`idUser`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_subscription_group`
    FOREIGN KEY (`fkIdGroup`)
    REFERENCES `tbGroup` (`idGroup`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci
COMMENT = 'Assinaturas dos usuários em grupos premium';

-- =====================================================
-- DADOS INICIAIS
-- =====================================================

-- Inserir perfis de usuário
INSERT INTO `tbPerfilUser` (`namePerfilUser`, `statusPerfilUser`) VALUES
('owner', 1),
('admin', 1),
('moderator', 1),
('user', 1);

-- Inserir grupos
INSERT INTO `tbGroup` (`idGroup`, `nameGroup`, `requiresSubscription`, `statusGroup`) VALUES
(-1001801600131, 'Clubinho FNBR', 1, 1),
(-1001183030542, 'FORTNITE BRASIL 🇧🇷', 0, 1);

-- Inserir metadados disponíveis
INSERT INTO `tbMetadata` (`nameMetadata`, `typeMetadata`, `descriptionMetadata`, `statusMetadata`) VALUES
('name', 'string', 'Nome do usuário (first_name + last_name)', 1),
('username', 'string', 'Username do Telegram (@username)', 1),
('last_seen', 'date', 'Última vez que o usuário foi visto', 1),
('language', 'string', 'Idioma preferido do usuário', 1),
('loyalty_points', 'number', 'Pontos de fidelidade', 1),
('level', 'number', 'Nível do usuário', 1),
('xp', 'number', 'Experiência do usuário', 1),
('accepted_terms', 'boolean', 'Aceitou os termos de uso', 1),
('preferences', 'json', 'Preferências do usuário (JSON)', 1),
('badges', 'json', 'Badges conquistadas (array JSON)', 1),
('participation_streak', 'number', 'Sequência de participações consecutivas', 1),
('best_streak', 'number', 'Melhor sequência de participações', 1),
('last_participation_date', 'date', 'Data da última participação', 1),
('total_participations', 'number', 'Total de participações em sorteios', 1),
('total_wins', 'number', 'Total de vitórias em sorteios', 1);

-- Inserir administradores
-- Admin Owner (121823278) - C3bola
INSERT INTO `tbUser` (`idUser`, `fkIdPerfilUser`, `createdAt`) VALUES
(121823278, 1, NOW());

-- Admin 2 (1076700588) - HonorioPSY
INSERT INTO `tbUser` (`idUser`, `fkIdPerfilUser`, `createdAt`) VALUES
(1076700588, 2, NOW());

-- Admin 3 (134632851) - Luigi
INSERT INTO `tbUser` (`idUser`, `fkIdPerfilUser`, `createdAt`) VALUES
(134632851, 2, NOW());

-- Inserir metadados dos administradores
INSERT INTO `tbMetadataUser` (`fkIdUser`, `fkIdMetadata`, `valueMetadata`) VALUES
-- C3bola
(121823278, (SELECT idMetadata FROM tbMetadata WHERE nameMetadata = 'name'), 'C3bola'),
(121823278, (SELECT idMetadata FROM tbMetadata WHERE nameMetadata = 'last_seen'), NOW()),
-- HonorioPSY
(1076700588, (SELECT idMetadata FROM tbMetadata WHERE nameMetadata = 'name'), 'HonorioPSY'),
(1076700588, (SELECT idMetadata FROM tbMetadata WHERE nameMetadata = 'last_seen'), NOW()),
-- Luigi
(134632851, (SELECT idMetadata FROM tbMetadata WHERE nameMetadata = 'name'), 'Luigi'),
(134632851, (SELECT idMetadata FROM tbMetadata WHERE nameMetadata = 'last_seen'), NOW());

-- =====================================================
-- VIEWS
-- =====================================================

-- View: Listagem de usuários com seus perfis
CREATE OR REPLACE VIEW vw_users_with_profiles AS
SELECT 
  u.idUser,
  (SELECT mu.valueMetadata FROM tbMetadataUser mu 
   JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
   WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'name' LIMIT 1) AS nameUser,
  (SELECT mu.valueMetadata FROM tbMetadataUser mu 
   JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
   WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'username' LIMIT 1) AS usernameUser,
  p.namePerfilUser AS profileName,
  u.createdAt,
  (SELECT mu.valueMetadata FROM tbMetadataUser mu 
   JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
   WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'last_seen' LIMIT 1) AS lastSeen,
  TIMESTAMPDIFF(DAY, u.createdAt, NOW()) AS daysActive
FROM tbUser u
INNER JOIN tbPerfilUser p ON u.fkIdPerfilUser = p.idPerfilUser
ORDER BY u.createdAt DESC;

-- View: Estatísticas de sorteios por usuário
CREATE OR REPLACE VIEW vw_user_raffle_stats AS
SELECT 
  u.idUser,
  (SELECT mu.valueMetadata FROM tbMetadataUser mu 
   JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
   WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'name' LIMIT 1) AS nameUser,
  (SELECT mu.valueMetadata FROM tbMetadataUser mu 
   JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
   WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'username' LIMIT 1) AS usernameUser,
  COUNT(DISTINCT r.fkIdRafflesDetails) AS totalParticipations,
  SUM(r.isWinner) AS totalWins,
  CASE 
    WHEN COUNT(DISTINCT r.fkIdRafflesDetails) > 0 
    THEN ROUND((SUM(r.isWinner) / COUNT(DISTINCT r.fkIdRafflesDetails)) * 100, 2)
    ELSE 0 
  END AS winRate
FROM tbUser u
LEFT JOIN tbRaffles r ON u.idUser = r.fkIdUser
GROUP BY u.idUser
ORDER BY totalWins DESC, totalParticipations DESC;

-- =====================================================
-- View: Última assinatura de cada usuário (BASE para outras views)
-- Remove duplicatas, mostrando apenas a assinatura mais recente por status
-- =====================================================
CREATE OR REPLACE VIEW vw_latest_subscriptions AS
SELECT 
  s.idSubscription,
  s.fkIdUser,
  s.fkIdGroup,
  u.idUser,
  (SELECT mu.valueMetadata FROM tbMetadataUser mu 
   JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
   WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'name' LIMIT 1) AS nameUser,
  (SELECT mu.valueMetadata FROM tbMetadataUser mu 
   JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
   WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'username' LIMIT 1) AS usernameUser,
  g.nameGroup,
  s.startDate,
  s.endDate,
  s.statusSubscription,
  s.amountPaid,
  s.paymentMethod,
  DATEDIFF(s.endDate, CURDATE()) AS daysRemaining,
  s.createdAt,
  s.updatedAt
FROM tbSubscription s
INNER JOIN tbUser u ON s.fkIdUser = u.idUser
INNER JOIN tbGroup g ON s.fkIdGroup = g.idGroup
INNER JOIN (
  -- Subquery que pega apenas a assinatura mais recente de cada usuário/grupo/status
  SELECT 
    fkIdUser, 
    fkIdGroup, 
    statusSubscription,
    MAX(endDate) as maxEndDate,
    MAX(idSubscription) as maxId
  FROM tbSubscription
  GROUP BY fkIdUser, fkIdGroup, statusSubscription
) latest ON s.fkIdUser = latest.fkIdUser 
        AND s.fkIdGroup = latest.fkIdGroup 
        AND s.statusSubscription = latest.statusSubscription
        AND s.endDate = latest.maxEndDate
        AND s.idSubscription = latest.maxId;

-- View: Assinaturas ativas (sem duplicatas)
CREATE OR REPLACE VIEW vw_active_subscriptions AS
SELECT 
  idSubscription,
  fkIdUser,
  fkIdGroup,
  idUser,
  nameUser,
  usernameUser,
  nameGroup,
  startDate,
  endDate,
  amountPaid,
  paymentMethod,
  daysRemaining,
  createdAt,
  updatedAt
FROM vw_latest_subscriptions
WHERE statusSubscription = 'active'
  AND endDate >= CURDATE()
ORDER BY endDate ASC;

-- View: Assinaturas expiradas (sem duplicatas)
CREATE OR REPLACE VIEW vw_expired_subscriptions AS
SELECT 
  idSubscription,
  fkIdUser,
  fkIdGroup,
  idUser,
  nameUser,
  usernameUser,
  nameGroup,
  startDate,
  endDate,
  amountPaid,
  paymentMethod,
  daysRemaining,
  createdAt,
  updatedAt
FROM vw_latest_subscriptions
WHERE statusSubscription = 'expired'
ORDER BY endDate DESC;

-- View: Assinaturas canceladas (sem duplicatas)
CREATE OR REPLACE VIEW vw_cancelled_subscriptions AS
SELECT 
  idSubscription,
  fkIdUser,
  fkIdGroup,
  idUser,
  nameUser,
  usernameUser,
  nameGroup,
  startDate,
  endDate,
  amountPaid,
  paymentMethod,
  daysRemaining,
  createdAt,
  updatedAt
FROM vw_latest_subscriptions
WHERE statusSubscription = 'cancelled'
ORDER BY endDate DESC;

-- View: Assinaturas expirando em breve (próximos 7 dias)
CREATE OR REPLACE VIEW vw_expiring_subscriptions AS
SELECT 
  idSubscription,
  fkIdUser,
  fkIdGroup,
  idUser,
  nameUser,
  usernameUser,
  nameGroup,
  endDate,
  daysRemaining,
  amountPaid
FROM vw_active_subscriptions
WHERE daysRemaining <= 7
  AND daysRemaining >= 0
ORDER BY endDate ASC;

-- View: Resumo de sorteios
CREATE OR REPLACE VIEW vw_raffle_summary AS
SELECT 
  rd.idRafflesDetails,
  g.nameGroup,
  rd.prizeDescription,
  rd.numWinners,
  rd.participantCount,
  rd.statusRaffles,
  rd.createdAt,
  rd.performedAt,
  COUNT(r.idRaffles) AS actualParticipants,
  SUM(r.isWinner) AS winnersRegistered
FROM tbRafflesDetails rd
INNER JOIN tbGroup g ON rd.fkIdGroup = g.idGroup
LEFT JOIN tbRaffles r ON rd.idRafflesDetails = r.fkIdRafflesDetails
GROUP BY rd.idRafflesDetails, g.nameGroup, rd.prizeDescription, rd.numWinners, 
         rd.participantCount, rd.statusRaffles, rd.createdAt, rd.performedAt
ORDER BY rd.createdAt DESC;

-- View: Metadados dos usuários (formato legível)
CREATE OR REPLACE VIEW vw_user_metadata AS
SELECT 
  u.idUser,
  m.nameMetadata,
  mu.valueMetadata,
  m.typeMetadata,
  mu.updatedAt
FROM tbMetadataUser mu
INNER JOIN tbUser u ON mu.fkIdUser = u.idUser
INNER JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata
WHERE m.statusMetadata = 1
ORDER BY u.idUser, m.nameMetadata;

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- =====================================================
-- SEÇÃO 1: PROCEDURES DE METADADOS
-- =====================================================

-- =====================================================
-- PROCEDURE: sp_set_user_meta
-- Define ou atualiza um metadado do usuário
-- Adaptado para usar tbMetadataUser e tbMetadata
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_set_user_meta //

CREATE PROCEDURE sp_set_user_meta(
  IN p_user_id BIGINT,
  IN p_meta_key VARCHAR(100),
  IN p_meta_value TEXT
)
BEGIN
  DECLARE v_metadata_id INT;
  
  -- Buscar ID do metadado pelo nome
  SELECT idMetadata INTO v_metadata_id
  FROM tbMetadata
  WHERE nameMetadata = p_meta_key AND statusMetadata = 1;
  
  -- Se o metadado não existe, sinalizar erro
  IF v_metadata_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Metadado não encontrado ou inativo';
  END IF;
  
  -- Inserir ou atualizar valor do metadado
  INSERT INTO tbMetadataUser (fkIdUser, fkIdMetadata, valueMetadata)
  VALUES (p_user_id, v_metadata_id, p_meta_value)
  ON DUPLICATE KEY UPDATE 
    valueMetadata = p_meta_value,
    updatedAt = CURRENT_TIMESTAMP;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_get_user_meta
-- Obtém um metadado específico do usuário
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_get_user_meta //

CREATE PROCEDURE sp_get_user_meta(
  IN p_user_id BIGINT,
  IN p_meta_key VARCHAR(100)
)
BEGIN
  SELECT 
    m.nameMetadata,
    mu.valueMetadata,
    m.typeMetadata,
    mu.updatedAt
  FROM tbMetadataUser mu
  JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata
  WHERE mu.fkIdUser = p_user_id 
    AND m.nameMetadata = p_meta_key
    AND m.statusMetadata = 1;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_get_all_user_meta
-- Obtém todos os metadados de um usuário
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_get_all_user_meta //

CREATE PROCEDURE sp_get_all_user_meta(
  IN p_user_id BIGINT
)
BEGIN
  SELECT 
    m.nameMetadata AS meta_key,
    mu.valueMetadata AS meta_value,
    m.typeMetadata AS meta_type,
    mu.createdAt,
    mu.updatedAt
  FROM tbMetadataUser mu
  JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata
  WHERE mu.fkIdUser = p_user_id
    AND m.statusMetadata = 1
  ORDER BY m.nameMetadata;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_delete_user_meta
-- Deleta um metadado específico do usuário
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_delete_user_meta //

CREATE PROCEDURE sp_delete_user_meta(
  IN p_user_id BIGINT,
  IN p_meta_key VARCHAR(100)
)
BEGIN
  DECLARE v_metadata_id INT;
  
  -- Buscar ID do metadado
  SELECT idMetadata INTO v_metadata_id
  FROM tbMetadata
  WHERE nameMetadata = p_meta_key;
  
  -- Deletar
  DELETE FROM tbMetadataUser
  WHERE fkIdUser = p_user_id AND fkIdMetadata = v_metadata_id;
END //

DELIMITER ;

-- =====================================================
-- SEÇÃO 2: PROCEDURES DE PARTICIPAÇÃO EM SORTEIOS
-- =====================================================

-- =====================================================
-- PROCEDURE: sp_register_participation
-- Registra a participação de um usuário em um sorteio
-- COM VERIFICAÇÃO DE ASSINATURA ATIVA
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_register_participation //

CREATE PROCEDURE sp_register_participation(
  IN p_raffle_id VARCHAR(50),
  IN p_user_id BIGINT,
  IN p_user_name VARCHAR(255),
  IN p_group_id BIGINT
)
BEGIN
  DECLARE v_can_participate BOOLEAN DEFAULT TRUE;
  DECLARE v_requires_subscription TINYINT(1);
  DECLARE v_subscription_active TINYINT(1);
  DECLARE v_days_remaining INT DEFAULT 0;
  
  -- Verificar se o grupo requer assinatura
  SELECT requiresSubscription INTO v_requires_subscription
  FROM tbGroup
  WHERE idGroup = p_group_id;
  
  -- Se requer assinatura, verificar se está ativa
  IF v_requires_subscription = 1 THEN
    SELECT 
      CASE 
        WHEN s.endDate >= CURDATE() AND s.statusSubscription = 'active' THEN 1
        ELSE 0
      END,
      DATEDIFF(s.endDate, CURDATE())
    INTO v_subscription_active, v_days_remaining
    FROM tbSubscription s
    WHERE s.fkIdUser = p_user_id AND s.fkIdGroup = p_group_id
    ORDER BY s.endDate DESC
    LIMIT 1;
    
    -- Se não tem assinatura ativa, retornar erro
    IF v_subscription_active IS NULL OR v_subscription_active = 0 THEN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = '❌ Assinatura inválida ou vencida. Por favor, renove sua assinatura para participar.';
    END IF;
  END IF;
  
  -- Inserir ou atualizar usuário
  INSERT INTO tbUser (idUser, fkIdPerfilUser, createdAt)
  VALUES (p_user_id, 4, CURRENT_TIMESTAMP)
  ON DUPLICATE KEY UPDATE idUser = p_user_id;
  
  -- Atualizar metadados do usuário
  CALL sp_set_user_meta(p_user_id, 'name', p_user_name);
  CALL sp_set_user_meta(p_user_id, 'last_seen', NOW());
  
  -- Registrar participação no sorteio
  INSERT INTO tbRaffles (fkIdRafflesDetails, fkIdUser)
  VALUES (p_raffle_id, p_user_id);
  
  -- Atualizar contador de participantes no sorteio
  UPDATE tbRafflesDetails 
  SET participantCount = (
    SELECT COUNT(*) FROM tbRaffles WHERE fkIdRafflesDetails = p_raffle_id
  )
  WHERE idRafflesDetails = p_raffle_id;
  
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_register_winner
-- Registra o vencedor de um sorteio e atualiza estatísticas
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_register_winner //

CREATE PROCEDURE sp_register_winner(
  IN p_raffle_id VARCHAR(50),
  IN p_user_id BIGINT,
  IN p_win_position INT,
  IN p_group_id BIGINT
)
BEGIN
  -- Inserir ou atualizar como vencedor
  INSERT INTO tbRaffles (fkIdRafflesDetails, fkIdUser, isWinner, winPosition, createdAt)
  VALUES (p_raffle_id, p_user_id, 1, p_win_position, CURRENT_TIMESTAMP)
  ON DUPLICATE KEY UPDATE
    isWinner = 1,
    winPosition = p_win_position;
  
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_get_eligible_participants
-- Retorna participantes elegíveis para sorteio
-- Ordena por número de vitórias (menor primeiro = mais chance)
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_get_eligible_participants //

CREATE PROCEDURE sp_get_eligible_participants(
  IN p_raffle_id VARCHAR(50),
  IN p_group_id BIGINT
)
BEGIN
  SELECT 
    r.fkIdUser AS user_id,
    (SELECT mu.valueMetadata FROM tbMetadataUser mu 
     JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
     WHERE mu.fkIdUser = r.fkIdUser AND m.nameMetadata = 'name' LIMIT 1) AS name,
    (SELECT mu.valueMetadata FROM tbMetadataUser mu 
     JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
     WHERE mu.fkIdUser = r.fkIdUser AND m.nameMetadata = 'username' LIMIT 1) AS username,
    r.createdAt AS participated_at,
    -- Contar vitórias anteriores do usuário
    (SELECT COUNT(*) 
     FROM tbRaffles r2 
     INNER JOIN tbRafflesDetails rd2 ON r2.fkIdRafflesDetails = rd2.idRafflesDetails
     WHERE r2.fkIdUser = r.fkIdUser 
       AND rd2.fkIdGroup = p_group_id
       AND r2.isWinner = 1
    ) AS wins_count,
    -- Calcular modificador de sorte (menos vitórias = mais chance)
    -- Fórmula: 1 / (1 + (wins_count * 0.3))
    (1.0 / (1.0 + (
      (SELECT COUNT(*) 
       FROM tbRaffles r3 
       INNER JOIN tbRafflesDetails rd3 ON r3.fkIdRafflesDetails = rd3.idRafflesDetails
       WHERE r3.fkIdUser = r.fkIdUser 
         AND rd3.fkIdGroup = p_group_id
         AND r3.isWinner = 1) * 0.3
    ))) AS luck_modifier
  FROM tbRaffles r
  JOIN tbUser u ON r.fkIdUser = u.idUser
  WHERE r.fkIdRafflesDetails = p_raffle_id
    AND r.isWinner = 0  -- Apenas não-vencedores
  ORDER BY wins_count ASC, r.createdAt ASC;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_close_raffle
-- Fecha um sorteio e atualiza o status
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_close_raffle //

CREATE PROCEDURE sp_close_raffle(
  IN p_raffle_id VARCHAR(50)
)
BEGIN
  UPDATE tbRafflesDetails 
  SET 
    statusRaffles = 'drawn',
    performedAt = CURRENT_TIMESTAMP
  WHERE idRafflesDetails = p_raffle_id;
END //

DELIMITER ;

-- =====================================================
-- SEÇÃO 3: PROCEDURES DE ADMINISTRAÇÃO
-- =====================================================

-- =====================================================
-- PROCEDURE: sp_check_admin_permission
-- Verifica se um usuário é admin
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_check_admin_permission //

CREATE PROCEDURE sp_check_admin_permission(
  IN p_user_id BIGINT,
  IN p_group_id BIGINT
)
BEGIN
  SELECT 
    u.idUser,
    (SELECT mu.valueMetadata FROM tbMetadataUser mu 
     JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
     WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'name' LIMIT 1) AS name,
    (SELECT mu.valueMetadata FROM tbMetadataUser mu 
     JOIN tbMetadata m ON mu.fkIdMetadata = m.idMetadata 
     WHERE mu.fkIdUser = u.idUser AND m.nameMetadata = 'username' LIMIT 1) AS username,
    p.namePerfilUser AS permission_level,
    p.idPerfilUser,
    CASE 
      WHEN p.namePerfilUser IN ('owner', 'admin') THEN TRUE
      ELSE FALSE
    END AS is_admin
  FROM tbUser u
  JOIN tbPerfilUser p ON u.fkIdPerfilUser = p.idPerfilUser
  WHERE u.idUser = p_user_id
    AND p.statusPerfilUser = 1
    AND p.namePerfilUser IN ('owner', 'admin', 'moderator')
  LIMIT 1;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_grant_admin
-- Concede permissão de admin para um usuário
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_grant_admin //

CREATE PROCEDURE sp_grant_admin(
  IN p_user_id BIGINT,
  IN p_user_name VARCHAR(255),
  IN p_permission_level VARCHAR(50)  -- 'owner', 'admin', 'moderator'
)
BEGIN
  DECLARE v_perfil_id INT;
  
  -- Buscar ID do perfil
  SELECT idPerfilUser INTO v_perfil_id
  FROM tbPerfilUser
  WHERE namePerfilUser = p_permission_level AND statusPerfilUser = 1;
  
  IF v_perfil_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Perfil não encontrado';
  END IF;
  
  -- Garantir que o usuário existe
  INSERT INTO tbUser (idUser, fkIdPerfilUser, createdAt)
  VALUES (p_user_id, v_perfil_id, CURRENT_TIMESTAMP)
  ON DUPLICATE KEY UPDATE fkIdPerfilUser = v_perfil_id;
  
  -- Atualizar metadados do usuário
  CALL sp_set_user_meta(p_user_id, 'name', p_user_name);
  CALL sp_set_user_meta(p_user_id, 'last_seen', NOW());
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_revoke_admin
-- Remove permissão de admin de um usuário
-- Define como perfil 'user' (padrão)
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_revoke_admin //

CREATE PROCEDURE sp_revoke_admin(
  IN p_user_id BIGINT
)
BEGIN
  DECLARE v_user_perfil_id INT;
  
  -- Buscar ID do perfil 'user'
  SELECT idPerfilUser INTO v_user_perfil_id
  FROM tbPerfilUser
  WHERE namePerfilUser = 'user';
  
  -- Atualizar usuário para perfil normal
  UPDATE tbUser
  SET fkIdPerfilUser = v_user_perfil_id
  WHERE idUser = p_user_id;
END //

DELIMITER ;

-- =====================================================
-- SEÇÃO 4: PROCEDURES DE ASSINATURAS
-- =====================================================

-- =====================================================
-- PROCEDURE: sp_check_subscription
-- Verifica se o usuário tem assinatura ativa
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_check_subscription //

CREATE PROCEDURE sp_check_subscription(
  IN p_user_id BIGINT,
  IN p_group_id BIGINT
)
BEGIN
  SELECT 
    s.idSubscription AS id,
    s.fkIdUser AS user_id,
    s.fkIdGroup AS group_id,
    s.startDate AS start_date,
    s.endDate AS end_date,
    s.statusSubscription AS status,
    DATEDIFF(s.endDate, CURDATE()) AS days_remaining,
    s.amountPaid AS amount_paid,
    CASE 
      WHEN s.endDate < CURDATE() THEN 0
      WHEN s.statusSubscription != 'active' THEN 0
      ELSE 1
    END AS can_participate,
    CASE 
      WHEN s.endDate < CURDATE() THEN '❌ Assinatura vencida'
      WHEN DATEDIFF(s.endDate, CURDATE()) = 0 THEN '⚠️ Assinatura vence hoje'
      WHEN DATEDIFF(s.endDate, CURDATE()) <= 3 THEN CONCAT('⚠️ Assinatura vence em ', DATEDIFF(s.endDate, CURDATE()), ' dias')
      WHEN DATEDIFF(s.endDate, CURDATE()) <= 7 THEN CONCAT('ℹ️ Assinatura vence em ', DATEDIFF(s.endDate, CURDATE()), ' dias')
      ELSE '✅ Assinatura ativa'
    END AS status_message
  FROM tbSubscription s
  WHERE s.fkIdUser = p_user_id AND s.fkIdGroup = p_group_id
  ORDER BY s.endDate DESC
  LIMIT 1;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_create_subscription
-- Cria uma nova assinatura para um usuário
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_create_subscription //

CREATE PROCEDURE sp_create_subscription(
  IN p_user_id BIGINT,
  IN p_group_id BIGINT,
  IN p_months INT,
  IN p_amount DECIMAL(10,2),
  IN p_payment_method VARCHAR(100)
)
BEGIN
  DECLARE v_start_date DATE;
  DECLARE v_end_date DATE;
  
  SET v_start_date = CURDATE();
  SET v_end_date = DATE_ADD(v_start_date, INTERVAL p_months MONTH);
  
  -- Inserir nova assinatura
  INSERT INTO tbSubscription (
    fkIdUser, 
    fkIdGroup, 
    startDate, 
    endDate, 
    statusSubscription,
    amountPaid,
    paymentMethod
  ) VALUES (
    p_user_id, 
    p_group_id, 
    v_start_date, 
    v_end_date, 
    'active',
    p_amount,
    p_payment_method
  );
  
  -- Retornar informações da assinatura criada
  SELECT 
    LAST_INSERT_ID() AS id,
    p_user_id AS user_id,
    p_group_id AS group_id,
    v_start_date AS start_date,
    v_end_date AS end_date,
    DATEDIFF(v_end_date, CURDATE()) AS days_remaining;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_extend_subscription
-- Estende uma assinatura existente
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_extend_subscription //

CREATE PROCEDURE sp_extend_subscription(
  IN p_user_id BIGINT,
  IN p_group_id BIGINT,
  IN p_months INT,
  IN p_amount DECIMAL(10,2)
)
BEGIN
  DECLARE v_current_end_date DATE;
  DECLARE v_new_end_date DATE;
  DECLARE v_subscription_id INT;
  
  -- Buscar assinatura atual
  SELECT idSubscription, endDate 
  INTO v_subscription_id, v_current_end_date
  FROM tbSubscription
  WHERE fkIdUser = p_user_id AND fkIdGroup = p_group_id
  ORDER BY endDate DESC
  LIMIT 1;
  
  -- Se não existe assinatura, criar uma nova
  IF v_subscription_id IS NULL THEN
    CALL sp_create_subscription(p_user_id, p_group_id, p_months, p_amount, 'renewal');
  ELSE
    -- Se a assinatura está vencida, usar data atual como base
    IF v_current_end_date < CURDATE() THEN
      SET v_new_end_date = DATE_ADD(CURDATE(), INTERVAL p_months MONTH);
    ELSE
      -- Caso contrário, estender a partir da data atual de vencimento
      SET v_new_end_date = DATE_ADD(v_current_end_date, INTERVAL p_months MONTH);
    END IF;
    
    -- Atualizar assinatura
    UPDATE tbSubscription
    SET 
      endDate = v_new_end_date,
      statusSubscription = 'active',
      amountPaid = amountPaid + p_amount
    WHERE idSubscription = v_subscription_id;
    
    -- Retornar informações
    SELECT 
      v_subscription_id AS id,
      p_user_id AS user_id,
      p_group_id AS group_id,
      v_new_end_date AS end_date,
      DATEDIFF(v_new_end_date, CURDATE()) AS days_remaining;
  END IF;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_cancel_subscription
-- Cancela uma assinatura
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_cancel_subscription //

CREATE PROCEDURE sp_cancel_subscription(
  IN p_user_id BIGINT,
  IN p_group_id BIGINT
)
BEGIN
  UPDATE tbSubscription
  SET statusSubscription = 'cancelled'
  WHERE fkIdUser = p_user_id 
    AND fkIdGroup = p_group_id
    AND statusSubscription = 'active';
END //

DELIMITER ;

-- =====================================================
-- SEÇÃO 5: PROCEDURES DE SORTEIOS
-- =====================================================

-- =====================================================
-- PROCEDURE: sp_create_raffle
-- Cria um novo sorteio
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_create_raffle //

CREATE PROCEDURE sp_create_raffle(
  IN p_raffle_id VARCHAR(50),
  IN p_group_id BIGINT,
  IN p_num_winners INT,
  IN p_prize_description TEXT
)
BEGIN
  -- Inserir detalhes do sorteio
  INSERT INTO tbRafflesDetails (
    idRafflesDetails,
    fkIdGroup,
    numWinners,
    prizeDescription,
    statusRaffles,
    createdAt
  ) VALUES (
    p_raffle_id,
    p_group_id,
    p_num_winners,
    p_prize_description,
    'open',
    CURRENT_TIMESTAMP
  );
  
  -- Retornar informações do sorteio criado
  SELECT 
    idRafflesDetails AS raffle_id,
    fkIdGroup AS group_id,
    numWinners AS num_winners,
    statusRaffles AS status,
    createdAt
  FROM tbRafflesDetails
  WHERE idRafflesDetails = p_raffle_id;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_draw_raffle
-- Realiza o sorteio (fecha para novas participações)
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_draw_raffle //

CREATE PROCEDURE sp_draw_raffle(
  IN p_raffle_id VARCHAR(50)
)
BEGIN
  -- Atualizar status do sorteio
  UPDATE tbRafflesDetails 
  SET 
    statusRaffles = 'drawn',
    performedAt = CURRENT_TIMESTAMP
  WHERE idRafflesDetails = p_raffle_id;
  
  -- Retornar total de participantes
  SELECT 
    p_raffle_id AS raffle_id,
    COUNT(*) AS total_participants,
    CURRENT_TIMESTAMP AS drawn_at
  FROM tbRaffles
  WHERE fkIdRafflesDetails = p_raffle_id;
END //

DELIMITER ;

-- =====================================================
-- SEÇÃO: METADADOS DE SORTEIOS (Sistema Unificado)
-- Usa tbMetadata unificada (entityType = 'raffle')
-- =====================================================

-- =====================================================
-- Inserir metadados de sorteio em tbMetadata unificada
-- =====================================================
INSERT IGNORE INTO `tbMetadata` 
  (`nameMetadata`, `entityType`, `typeMetadata`, `descriptionMetadata`, `statusMetadata`) 
VALUES
  ('raffle_title', 'raffle', 'string', 'Título do sorteio extraído da legenda', 1),
  ('raffle_date', 'raffle', 'string', 'Data programada do sorteio (formato: DD/MM/YYYY)', 1),
  ('raffle_type', 'raffle', 'string', 'Tipo do sorteio (Exclusivo, Teste, etc)', 1),
  ('prize_description', 'raffle', 'string', 'Descrição detalhada do prêmio', 1),
  ('prize_items', 'raffle', 'json', 'Lista de itens do prêmio em formato JSON', 1),
  ('file_id', 'raffle', 'string', 'ID do arquivo/imagem do sorteio no Telegram', 1),
  ('winner_announcement_date', 'raffle', 'date', 'Data de anúncio dos vencedores', 1),
  ('minimum_participants', 'raffle', 'number', 'Número mínimo de participantes para realizar o sorteio', 1),
  ('requires_photo', 'raffle', 'boolean', 'Se requer foto do recibo de pagamento', 1);

-- =====================================================
-- VIEW: vw_raffle_full
-- Facilita consulta de sorteios com seus metadados
-- =====================================================
CREATE OR REPLACE VIEW `vw_raffle_full` AS
SELECT 
  rd.idRafflesDetails,
  rd.fkIdGroup,
  rd.numWinners,
  rd.participantCount,
  rd.statusRaffles,
  rd.prizeDescription,
  rd.fileIdRaffles,
  rd.createdAt,
  rd.performedAt,
  g.nameGroup,
  -- Metadados principais via tbMetadataRaffle
  (SELECT mr.valueMetadata FROM tbMetadataRaffle mr 
   JOIN tbMetadata m ON mr.fkIdMetadata = m.idMetadata 
   WHERE mr.fkIdRafflesDetails = rd.idRafflesDetails 
   AND m.nameMetadata = 'raffle_title' AND m.entityType = 'raffle' LIMIT 1) AS raffle_title,
  (SELECT mr.valueMetadata FROM tbMetadataRaffle mr 
   JOIN tbMetadata m ON mr.fkIdMetadata = m.idMetadata 
   WHERE mr.fkIdRafflesDetails = rd.idRafflesDetails 
   AND m.nameMetadata = 'raffle_date' AND m.entityType = 'raffle' LIMIT 1) AS raffle_date,
  (SELECT mr.valueMetadata FROM tbMetadataRaffle mr 
   JOIN tbMetadata m ON mr.fkIdMetadata = m.idMetadata 
   WHERE mr.fkIdRafflesDetails = rd.idRafflesDetails 
   AND m.nameMetadata = 'raffle_type' AND m.entityType = 'raffle' LIMIT 1) AS raffle_type
FROM tbRafflesDetails rd
INNER JOIN tbGroup g ON rd.fkIdGroup = g.idGroup;

-- =====================================================
-- STORED PROCEDURES DE METADATA DE SORTEIOS
-- =====================================================

-- =====================================================
-- PROCEDURE: sp_set_raffle_meta
-- Define ou atualiza um metadado de sorteio
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_set_raffle_meta //

CREATE PROCEDURE sp_set_raffle_meta(
  IN p_raffle_id VARCHAR(50),
  IN p_meta_key VARCHAR(100),
  IN p_meta_value TEXT
)
BEGIN
  DECLARE v_metadata_id INT;
  
  -- Buscar ID do metadado pelo nome (apenas raffle)
  SELECT idMetadata INTO v_metadata_id
  FROM tbMetadata
  WHERE nameMetadata = p_meta_key 
    AND entityType = 'raffle' 
    AND statusMetadata = 1;
  
  IF v_metadata_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Metadado de raffle não encontrado ou inativo';
  END IF;
  
  -- Inserir ou atualizar
  INSERT INTO tbMetadataRaffle (fkIdRafflesDetails, fkIdMetadata, valueMetadata)
  VALUES (p_raffle_id, v_metadata_id, p_meta_value)
  ON DUPLICATE KEY UPDATE 
    valueMetadata = p_meta_value,
    updatedAt = CURRENT_TIMESTAMP;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_get_raffle_meta
-- Obtém um metadado específico do sorteio
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_get_raffle_meta //

CREATE PROCEDURE sp_get_raffle_meta(
  IN p_raffle_id VARCHAR(50),
  IN p_meta_key VARCHAR(100)
)
BEGIN
  SELECT 
    m.nameMetadata,
    mr.valueMetadata,
    m.typeMetadata,
    mr.updatedAt
  FROM tbMetadataRaffle mr
  JOIN tbMetadata m ON mr.fkIdMetadata = m.idMetadata
  WHERE mr.fkIdRafflesDetails = p_raffle_id 
    AND m.nameMetadata = p_meta_key
    AND m.entityType = 'raffle'
    AND m.statusMetadata = 1;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_get_all_raffle_meta
-- Obtém todos os metadados de um sorteio
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_get_all_raffle_meta //

CREATE PROCEDURE sp_get_all_raffle_meta(
  IN p_raffle_id VARCHAR(50)
)
BEGIN
  SELECT 
    m.nameMetadata AS meta_key,
    mr.valueMetadata AS meta_value,
    m.typeMetadata AS meta_type,
    m.descriptionMetadata AS meta_description,
    mr.createdAt,
    mr.updatedAt
  FROM tbMetadataRaffle mr
  JOIN tbMetadata m ON mr.fkIdMetadata = m.idMetadata
  WHERE mr.fkIdRafflesDetails = p_raffle_id
    AND m.entityType = 'raffle'
    AND m.statusMetadata = 1
  ORDER BY m.nameMetadata;
END //

DELIMITER ;

-- =====================================================
-- PROCEDURE: sp_delete_raffle_meta
-- Deleta um metadado específico do sorteio
-- =====================================================
DELIMITER //

DROP PROCEDURE IF EXISTS sp_delete_raffle_meta //

CREATE PROCEDURE sp_delete_raffle_meta(
  IN p_raffle_id VARCHAR(50),
  IN p_meta_key VARCHAR(100)
)
BEGIN
  DECLARE v_metadata_id INT;
  
  SELECT idMetadata INTO v_metadata_id
  FROM tbMetadata
  WHERE nameMetadata = p_meta_key AND entityType = 'raffle';
  
  DELETE FROM tbMetadataRaffle
  WHERE fkIdRafflesDetails = p_raffle_id AND fkIdMetadata = v_metadata_id;
END //

DELIMITER ;

-- =====================================================
-- FIM DAS STORED PROCEDURES
-- =====================================================

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

-- =====================================================
-- Script concluído com sucesso! ✅
-- =====================================================
-- Próximo passo: Executar databaseNew_procedures.sql
-- =====================================================
SELECT '✅ Script executado com sucesso!' AS status;
