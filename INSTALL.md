# 📖 Guia de Instalação Detalhado - Sorteio FNBR Bot

Este guia vai te levar passo a passo pela instalação completa do bot, desde zero até ele rodando perfeitamente no seu servidor.

---

## 📋 Sumário

1. [Instalação do Node.js](#1-instalação-do-nodejs)
2. [Instalação do MySQL](#2-instalação-do-mysql)
3. [Criação do Bot no Telegram](#3-criação-do-bot-no-telegram)
4. [Download e Configuração do Código](#4-download-e-configuração-do-código)
5. [Configuração do Banco de Dados](#5-configuração-do-banco-de-dados)
6. [Configuração das Variáveis de Ambiente](#6-configuração-das-variáveis-de-ambiente)
7. [Instalação das Dependências](#7-instalação-das-dependências)
8. [Primeira Execução](#8-primeira-execução)
9. [Configurações Iniciais no Telegram](#9-configurações-iniciais-no-telegram)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Instalação do Node.js

### Windows

1. **Download do Node.js**
   - Acesse: https://nodejs.org/
   - Baixe a versão LTS (Long Term Support) recomendada
   - Execute o instalador `.msi`

2. **Instalação**
   - Siga o assistente de instalação
   - Marque a opção "Automatically install necessary tools"
   - Clique em "Next" até finalizar

3. **Verificação**
   ```powershell
   node --version
   npm --version
   ```
   Deve mostrar as versões instaladas (ex: v20.10.0)

### Linux (Ubuntu/Debian)

```bash
# Atualizar repositórios
sudo apt update

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalação
node --version
npm --version
```

### MacOS

```bash
# Usando Homebrew
brew install node

# Verificar instalação
node --version
npm --version
```

---

## 2. Instalação do MySQL

### Opção A: XAMPP (Recomendado para Windows)

1. **Download do XAMPP**
   - Acesse: https://www.apachefriends.org/
   - Baixe a versão para seu sistema operacional

2. **Instalação**
   - Execute o instalador
   - Selecione Apache, MySQL e phpMyAdmin
   - Escolha o diretório de instalação (ex: C:\xampp)

3. **Iniciar Serviços**
   - Abra o XAMPP Control Panel
   - Clique em "Start" nos módulos Apache e MySQL
   - Verifique se os status ficaram verdes

4. **Acessar phpMyAdmin**
   - Abra navegador em: http://localhost/phpmyadmin
   - Login padrão: usuário `root`, sem senha

5. **Configurar Senha (Opcional mas Recomendado)**
   - No phpMyAdmin, vá em "Contas de usuário"
   - Clique em "Editar privilégios" do usuário `root`
   - Em "Mudar senha", defina uma senha forte
   - Salve as alterações

### Opção B: MySQL Standalone

#### Windows

1. **Download**
   - Acesse: https://dev.mysql.com/downloads/mysql/
   - Baixe o MySQL Installer

2. **Instalação**
   - Execute o instalador
   - Escolha "Developer Default"
   - Defina senha para o usuário root
   - Configure como serviço do Windows

3. **Verificação**
   ```powershell
   mysql --version
   ```

#### Linux (Ubuntu/Debian)

```bash
# Instalar MySQL Server
sudo apt update
sudo apt install mysql-server

# Configurar segurança
sudo mysql_secure_installation

# Criar usuário e senha
sudo mysql
CREATE USER 'root'@'localhost' IDENTIFIED BY 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EXIT;
```

---

## 3. Criação do Bot no Telegram

1. **Abrir o BotFather**
   - No Telegram, busque por: @BotFather
   - Inicie conversa com `/start`

2. **Criar Novo Bot**
   ```
   /newbot
   ```
   - Digite o nome do bot (ex: Sorteio FNBR Bot)
   - Digite o username (deve terminar em 'bot', ex: SorteioFNBRBot)

3. **Salvar o Token**
   - O BotFather enviará um token assim:
     ```
     123456789:ABCdefGHIjklMNOpqrsTUVwxyz
     ```
   - **GUARDE ESTE TOKEN COM SEGURANÇA!**

4. **Configurações Opcionais**
   ```
   /setdescription - Descrição do bot
   /setabouttext - Texto "Sobre"
   /setuserpic - Foto de perfil
   /setcommands - Lista de comandos
   ```

5. **Comandos Sugeridos** (use `/setcommands`)
   ```
   start - Registrar no sistema
   help - Menu de ajuda
   assinatura - Verificar assinatura
   novosorteio - Criar novo sorteio (Admin)
   sub - Registrar assinatura (Admin)
   admins - Listar administradores (Admin)
   log - Configurar logs (Admin)
   ```

---

## 4. Download e Configuração do Código

### Opção A: Via Git (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/c3bola/sorteio-fnbr-bot.git

# Entre na pasta
cd sorteio-fnbr-bot
```

### Opção B: Download ZIP

1. Acesse: https://github.com/c3bola/sorteio-fnbr-bot
2. Clique em "Code" > "Download ZIP"
3. Extraia o arquivo para uma pasta (ex: C:\bots\sorteio-fnbr-bot)
4. Abra terminal na pasta extraída

---

## 5. Configuração do Banco de Dados

### Opção A: Via phpMyAdmin (Mais Fácil)

1. **Acessar phpMyAdmin**
   - Abra: http://localhost/phpmyadmin
   - Login com usuário `root` e sua senha

2. **Criar Database**
   - Clique em "Novo" no menu lateral
   - Nome: `fnbr_sorteios`
   - Collation: `utf8mb4_unicode_ci`
   - Clique em "Criar"

3. **Importar SQL**
   - Selecione o database `fnbr_sorteios` no menu lateral
   - Clique na aba "Importar"
   - Clique em "Escolher arquivo"
   - Selecione o arquivo `data/database.sql` do projeto
   - Role até o final e clique em "Executar"
   - Aguarde a mensagem de sucesso

4. **Verificar Importação**
   - No menu lateral, expanda `fnbr_sorteios`
   - Deve mostrar 8 tabelas:
     - tbPerfilUser
     - tbUser
     - tbMetadata
     - tbMetadataUser
     - tbGroup
     - tbRafflesDetails
     - tbRaffles
     - tbSubscription
   - E 6 views (vw_*)

### Opção B: Via Linha de Comando

#### Windows (PowerShell)

```powershell
# Navegar até a pasta xampp\mysql\bin
cd C:\xampp\mysql\bin

# Criar database
.\mysql.exe -u root -p -e "CREATE DATABASE fnbr_sorteios CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Importar SQL
.\mysql.exe -u root -p fnbr_sorteios < "C:\caminho\para\sorteio-fnbr-bot\data\database.sql"
```

#### Linux/Mac

```bash
# Criar database
mysql -u root -p -e "CREATE DATABASE fnbr_sorteios CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Importar SQL
mysql -u root -p fnbr_sorteios < data/database.sql
```

---

## 6. Configuração das Variáveis de Ambiente

1. **Copiar Arquivo de Exemplo**
   ```bash
   # Windows (PowerShell)
   Copy-Item .env.example .env

   # Linux/Mac
   cp .env.example .env
   ```

2. **Editar Arquivo .env**
   Abra o arquivo `.env` com editor de texto e configure:

   ```env
   # Token do Bot (obtido do BotFather)
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz

   # Configuração do MySQL
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=sua_senha_mysql_aqui
   DB_NAME=fnbr_sorteios
   DB_PORT=3306
   DB_CONNECTION_LIMIT=10
   ```

3. **Valores Importantes**
   - `TELEGRAM_BOT_TOKEN`: Token recebido do BotFather
   - `DB_PASSWORD`: Senha do MySQL (se configurou no XAMPP)
   - `DB_NAME`: Deve ser `fnbr_sorteios` (igual ao database criado)

---

## 7. Instalação das Dependências

No terminal, dentro da pasta do projeto:

```bash
# Instalar todas as dependências
npm install
```

Isso instalará:
- `telegraf` (framework do bot)
- `mysql2` (driver MySQL)
- `dotenv` (variáveis de ambiente)

**Aguarde a instalação concluir** (pode levar alguns minutos na primeira vez)

---

## 8. Primeira Execução

### Iniciar o Bot

```bash
# Iniciar bot
npm start

# OU
node sorteiofnbr.js
```

### O Que Esperar

Se tudo estiver correto, você verá:

```
🤖 Bot iniciado com sucesso!
✅ Conexão com MySQL estabelecida!
📅 [NOTIFIER] Sistema de notificações iniciado
📅 [NOTIFIER] Próxima verificação em 12h 34min (06/11/2024 06:00:00)
```

### Se Houver Erro

#### Erro: "TELEGRAM_BOT_TOKEN não está definido"
- Verifique se o arquivo `.env` existe
- Verifique se o token está correto no `.env`

#### Erro: "Access denied for user 'root'"
- Senha do MySQL incorreta no `.env`
- Verifique `DB_PASSWORD` no arquivo `.env`

#### Erro: "Unknown database 'fnbr_sorteios'"
- Database não foi criado
- Volte ao passo [5. Configuração do Banco de Dados](#5-configuração-do-banco-de-dados)

#### Erro: "ECONNREFUSED"
- MySQL não está rodando
- Inicie o MySQL no XAMPP Control Panel
- Ou execute: `sudo service mysql start` (Linux)

---

## 9. Configurações Iniciais no Telegram

### 1. Adicionar Primeiro Admin

No MySQL (phpMyAdmin ou terminal), execute:

```sql
-- Seu userId do Telegram (descubra com @userinfobot)
INSERT INTO tbUser (idUser, fkIdPerfilUser, createdAt)
VALUES (SEU_USER_ID_AQUI, 1, NOW())
ON DUPLICATE KEY UPDATE fkIdPerfilUser = 1;

-- Exemplo:
INSERT INTO tbUser (idUser, fkIdPerfilUser, createdAt)
VALUES (123456789, 1, NOW())
ON DUPLICATE KEY UPDATE fkIdPerfilUser = 1;
```

**Como descobrir seu userId:**
1. No Telegram, busque: @userinfobot
2. Envie qualquer mensagem
3. Copie o número do "Id"

### 2. Adicionar Bot a um Grupo

1. Crie um grupo no Telegram (ou use existente)
2. Adicione o bot ao grupo
3. Promova o bot a Administrador (permissões de gerenciar mensagens)

### 3. Registrar Grupo no Banco

No grupo, envie:
```
/start
```

O bot deve responder e registrar o grupo automaticamente.

### 4. Configurar Tópicos de Log (Opcional)

Se o grupo tiver tópicos habilitados:

1. Crie tópicos no grupo:
   - 📝 Logs Comandos
   - ❌ Logs Erros
   - 💳 Logs Assinaturas
   - 🎁 Logs Sorteios
   - 👥 Logs Participação
   - ⚙️ Logs Sistema

2. Em cada tópico, copie o ID do tópico (número na URL ou via bot)

3. Configure com `/log`:
   ```
   /log comando 12345
   /log erro 12346
   /log assinatura 12347
   /log sorteio 12348
   /log participacao 12349
   /log sistema 12350
   ```

---

## 10. Troubleshooting

### Bot Não Responde no Telegram

1. **Verificar se bot está rodando**
   - Verifique terminal/console
   - Deve mostrar "Bot iniciado com sucesso!"

2. **Verificar token**
   - Token correto no `.env`?
   - Teste enviar `/start` para o bot no privado

3. **Permissões do Grupo**
   - Bot é administrador do grupo?
   - Tem permissão de "gerenciar mensagens"?

### Erros de Banco de Dados

1. **"Table doesn't exist"**
   ```bash
   # Reimportar database.sql
   mysql -u root -p fnbr_sorteios < data/database.sql
   ```

2. **"Connection timeout"**
   - MySQL está rodando?
   - Firewall bloqueando porta 3306?

3. **"Too many connections"**
   - Aumentar `DB_CONNECTION_LIMIT` no `.env`
   - Reiniciar bot

### Notificações Não Funcionam

1. **Verificar horário do sistema**
   ```bash
   # Windows
   date

   # Linux
   date
   timedatectl
   ```

2. **Forçar execução manual (teste)**
   - Edite `sorteiofnbr.js`
   - Descomente linha: `// this.checkExpiringSubscriptions();`
   - Reinicie bot

### Performance Issues

1. **Bot lento**
   - Aumentar `DB_CONNECTION_LIMIT` para 20
   - Verificar RAM disponível

2. **MySQL lento**
   - No XAMPP, aumentar memória do MySQL
   - Editar `C:\xampp\mysql\bin\my.ini`
   - Aumentar `innodb_buffer_pool_size`

---

## 🎉 Instalação Concluída!

Se chegou até aqui, parabéns! Seu bot está funcionando.

### Próximos Passos

1. **Teste os comandos**:
   - `/start` no privado
   - `/help` para ver comandos
   - `/novosorteio` em um grupo

2. **Configure assinaturas**:
   - Defina valor padrão em `commands/subscription.js`
   - Configure CLUBINHO_GROUP_ID

3. **Personalize mensagens**:
   - Edite textos em cada comando
   - Adicione emojis personalizados

4. **Monitore logs**:
   - Configure tópicos de log
   - Acompanhe atividade do bot

---

## 📞 Precisa de Ajuda?

- 📧 Email: fnc3bola@gmail.com
- 💬 Telegram: @c3bola
- 🐛 Issues: [GitHub Issues](https://github.com/c3bola/sorteio-fnbr-bot/issues)

---

## 📚 Documentação Adicional

- [README.md](README.md) - Documentação completa
- [data/database.sql](data/database.sql) - Schema do banco
- [.env.example](.env.example) - Template de configuração

---

<div align="center">

**Boa sorte com seu bot! 🚀**

[⬆ Voltar ao topo](#-guia-de-instalação-detalhado---sorteio-fnbr-bot)

</div>
