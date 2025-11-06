# 🎁 Sorteio FNBR Bot - Sistema de Sorteios para Telegram

![Node.js](https://img.shields.io/badge/Node.js-16%2B-green)
![Telegraf](https://img.shields.io/badge/Telegraf-4.16.3-blue)
![MySQL](https://img.shields.io/badge/MySQL-8.0%2B-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

Bot profissional de sorteios para comunidades Fortnite Brasil no Telegram, com sistema avançado de assinaturas, metadata, logging e notificações automáticas.

---

## 📋 Índice

- [Sobre o Projeto](#-sobre-o-projeto)
- [Técnicas Implementadas](#-técnicas-implementadas)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Funcionalidades](#-funcionalidades)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Configuração](#️-configuração)
- [Uso](#-uso)
- [Comandos Disponíveis](#-comandos-disponíveis)
- [Sistema de Assinaturas](#-sistema-de-assinaturas)
- [Arquitetura do Banco de Dados](#-arquitetura-do-banco-de-dados)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)
- [Autor](#-autor)

---

## 🎯 Sobre o Projeto

O **Sorteio FNBR Bot** nasceu da necessidade de gerenciar sorteios de forma profissional em grupos da comunidade Fortnite Brasil no Telegram. Ao invés de sorteios manuais e desorganizados, o bot automatiza todo o processo com:

- ✅ **Sistema de participação intuitivo** com botões inline
- ✅ **Sorteio justo** com modificadores de sorte baseados em assinaturas
- ✅ **Gestão de assinaturas** com pagamento via PIX
- ✅ **Notificações automáticas** de vencimentos próximos
- ✅ **Logging estruturado** em tópicos do Telegram
- ✅ **Banco de dados robusto** com stored procedures
- ✅ **Segurança** com verificação de permissões por grupo

### Por que esse bot existe?

Gerenciar sorteios manualmente é trabalhoso e propenso a erros. O Sorteio FNBR Bot resolve isso:

1. **Automatização Total** - De participação até notificação de vencedores
2. **Monetização Justa** - Sistema de assinaturas com vantagens reais
3. **Transparência** - Todos os logs registrados e histórico completo
4. **Escalabilidade** - Funciona em múltiplos grupos simultaneamente
5. **Profissionalismo** - Código limpo, documentado e versionado

### O que tem de especial?

- **Arquitetura Metadata** - Sistema flexível de dados de usuários sem migrations
- **Stored Procedures** - Lógica de negócio centralizada no banco de dados
- **Cron Jobs** - Notificações diárias automáticas às 6h (horário de Brasília)
- **Pool de Conexões** - Performance otimizada com mysql2/promise
- **Sistema de Logs** - 6 tipos de logs organizados em tópicos configuráveis
- **Admin Granular** - Permissões específicas por grupo
- **Notificações Privadas** - Vencedores recebem mensagem automática

---

## 🛠️ Técnicas Implementadas

### 1. **Arquitetura Metadata Pattern**

Sistema escalável de armazenamento de dados de usuários sem necessidade de migrations:

```javascript
// tbUser armazena apenas: idUser, fkIdPerfilUser, createdAt
// Dados adicionais vão para tbMetadataUser (chave-valor)
await db.query('CALL sp_set_user_meta(?, ?, ?)', [userId, 'username', '@johndoe']);
```

**Benefícios:**
- Adicionar novos campos sem alterar estrutura de tabelas
- Versionamento de dados históricos
- Queries otimizadas com stored procedures

### 2. **Stored Procedures MySQL**

17 stored procedures inline para lógica de negócio centralizada:

- `sp_register_user` - Cadastro automático de usuários
- `sp_check_admin_permission` - Verificação de permissão por grupo
- `sp_register_participation` - Registro de participação com validações
- `sp_register_winner` - Registro de vencedores com posição
- `sp_close_raffle` - Fechamento de sorteio com timestamp
- `sp_check_subscription` - Verificação de assinatura ativa

### 3. **Sistema de Logging Estruturado**

Logger com 6 tipos de logs enviados para tópicos configuráveis no Telegram:

```javascript
const logger = new Logger(bot);
await logger.logCommand('Comando /novosorteio executado');
await logger.logError('Erro ao sortear: ' + error.message);
await logger.logSubscription('Assinatura criada para usuário 123456');
```

### 4. **Cron Jobs com Timezone**

Notificações automáticas diárias às 6h (Brasília/UTC-3):

```javascript
const notifier = new SubscriptionNotifier(bot);
notifier.start(); // Agenda execução diária às 09:00 UTC (06:00 Brasília)
```

### 5. **Pool de Conexões MySQL**

Otimização de performance com conexões persistentes:

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  connectionLimit: 10, // Pool com 10 conexões
  waitForConnections: true
});
```

### 6. **Sistema de Assinaturas com PIX**

Gestão completa de assinaturas mensais:

- Cálculo automático de datas (início/fim)
- Armazenamento de comprovante (file_id)
- Status (active/expired/cancelled)
- Modificadores de sorte (3x mais chances)

### 7. **Admin Granular por Grupo**

Verificação de permissão específica para cada grupo:

```javascript
// Verifica se userId é admin do groupId específico
const isAdmin = await db.query(
  'CALL sp_check_admin_permission(?, ?)', 
  [userId, groupId]
);
```

---

## 📁 Estrutura do Projeto

```
sorteio-fnbr-bot/
├── commands/                    # Comandos do bot
│   ├── adduser.js              # Adicionar usuários manualmente
│   ├── admins.js               # Listar administradores
│   ├── help.js                 # Sistema de ajuda
│   ├── log.js                  # Configurar tópicos de log
│   ├── newadm.js               # Adicionar administradores
│   ├── novosorteio.js          # Criar novos sorteios
│   ├── register.js             # Registrar usuários do JSON
│   ├── start.js                # Comando inicial
│   └── subscription.js         # Sistema de assinaturas (/assinatura, /sub)
│
├── data/                        # Dados e banco
│   ├── database.js             # Pool de conexões MySQL
│   ├── database.sql            # Schema completo com stored procedures
│   ├── participants.js         # Funções de participantes (legacy)
│   └── json/                   # Arquivos JSON (histórico)
│       ├── logconfig.json      # Configuração de tópicos de log
│       └── participants.json   # Histórico de participantes
│
├── handlers/                    # Manipuladores de ações
│   └── actions.js              # Handlers de botões (participar, sortear, cancelar)
│
├── utils/                       # Utilitários
│   ├── logger.js               # Sistema de logging estruturado
│   ├── subscriptionNotifier.js # Notificações de vencimento (cron)
│   ├── userMetadata.js         # Helpers de metadata (legacy)
│   └── utils.js                # Funções auxiliares
│
├── .env                         # Variáveis de ambiente (NÃO VERSIONAR)
├── .env.example                # Template de variáveis
├── .gitignore                  # Arquivos ignorados pelo Git
├── .gitattributes              # Configurações Git
├── INSTALL.md                  # Guia de instalação detalhado
├── LICENSE                     # Licença MIT
├── package.json                # Dependências e scripts
├── package-lock.json           # Lock de versões
├── README.md                   # Este arquivo
└── sorteiofnbr.js              # Arquivo principal do bot
```

### 🎯 Benefícios da Estrutura

#### 1. **Separação de Responsabilidades**
- `commands/` - Cada comando isolado, fácil manutenção
- `handlers/` - Lógica de ações (botões) separada
- `utils/` - Funções reutilizáveis centralizadas
- `data/` - Camada de dados isolada

#### 2. **Escalabilidade**
- Adicionar comando: criar arquivo em `commands/`
- Adicionar handler: registrar em `handlers/actions.js`
- Adicionar utilidade: criar em `utils/`

#### 3. **Manutenibilidade**
- Bugs fáceis de localizar
- Código modular permite testes isolados
- Documentação inline em cada arquivo

---

## ⚡ Funcionalidades

### 👥 Comandos para Usuários

**🎁 Participar de Sorteios**
Clique no botão "Participar do sorteio" nas mensagens de sorteio. Assinantes têm 3x mais chances de ganhar!

**📊 Verificar Assinatura** (`/assinatura`)
Consulte status da sua assinatura, data de vencimento e grupo vinculado. Comando funciona apenas no privado.

**❓ Ajuda** (`/help`)
Menu completo com todos os comandos disponíveis e instruções de uso.

### 👑 Comandos para Administradores

**🎁 Criar Sorteio** (`/novosorteio`)
Inicia novo sorteio com botões de participação, sorteio e cancelamento.
```
/novosorteio
```

**👨‍💼 Gerenciar Admins** (`/newadm`, `/admins`)
Adiciona novos administradores e lista admins existentes.
```
/newadm 123456789 2    # userId + perfilId (2=admin)
/admins                # Lista todos os admins
```

**💳 Gerenciar Assinaturas** (`/sub`)
Registra assinaturas de usuários via PIX (apenas no privado).
```
# Modo automático (calcula datas)
/sub (encaminhe mensagem do usuário com comprovante)

# Modo manual
/sub 01/12/2024#01/01/2025#3.00
```

**📝 Configurar Logs** (`/log`)
Define tópicos do Telegram para cada tipo de log.
```
/log comando 123456    # Logs de comandos para tópico 123456
/log erro 789          # Logs de erro para tópico 789
```

**📋 Registrar Usuários** (`/register`)
Importa usuários do participants.json para o banco de dados.

**➕ Adicionar Usuário** (`/adduser`)
Cadastra usuário manualmente no sistema.

### 🔘 Ações via Botões

**✅ Participar**
Registra participação no sorteio. Verifica duplicatas e assinaturas automaticamente.

**🎲 Sortear** (apenas admins)
Realiza sorteio justo com pesos. Notifica vencedores no privado com detalhes completos.

**❌ Cancelar** (apenas admins)
Cancela sorteio e remove botões. Mostra quem cancelou e quando.

---

## 📦 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js 16+** - [Download](https://nodejs.org/)
- **MySQL 8.0+** ou **MariaDB 10.5+** - [MySQL](https://dev.mysql.com/downloads/) | [MariaDB](https://mariadb.org/download/)
- **XAMPP** (opcional, facilita instalação do MySQL) - [Download](https://www.apachefriends.org/)
- **Git** - [Download](https://git-scm.com/)
- **Telegram Bot Token** - Obtenha com [@BotFather](https://t.me/BotFather)

---

## 📥 Instalação

Para guia detalhado passo a passo, consulte [INSTALL.md](INSTALL.md)

### Instalação Rápida

```bash
# Clone o repositório
git clone https://github.com/c3bola/sorteio-fnbr-bot.git
cd sorteio-fnbr-bot

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Execute o script SQL no MySQL
mysql -u root -p fnbr_sorteios < data/database.sql
# OU use phpMyAdmin (recomendado)

# Inicie o bot
npm start
```

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente

Edite o arquivo `.env`:

```env
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_mysql
DB_NAME=fnbr_sorteios
DB_PORT=3306
DB_CONNECTION_LIMIT=10
```

### 2. Banco de Dados

Execute o arquivo `data/database.sql` via:

**Opção 1: phpMyAdmin (Recomendado)**
1. Acesse http://localhost/phpmyadmin
2. Crie database `fnbr_sorteios`
3. Importe `data/database.sql`

**Opção 2: Linha de comando**
```bash
mysql -u root -p -e "CREATE DATABASE fnbr_sorteios CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p fnbr_sorteios < data/database.sql
```

### 3. Configurar Tópicos de Log

No Telegram, use `/log` para configurar onde cada tipo de log será enviado:

```
/log comando 123456    # ID do tópico para logs de comandos
/log erro 789012       # ID do tópico para logs de erro
/log assinatura 456    # ID do tópico para logs de assinatura
/log sorteio 789       # ID do tópico para logs de sorteio
/log participacao 321  # ID do tópico para logs de participação
/log sistema 654       # ID do tópico para logs de sistema
```

---

## 🚀 Uso

### Iniciar o Bot

```bash
npm start
```

### Comandos no Telegram

#### Para Usuários Comuns

```
/start - Registra-se no sistema
/help - Menu de ajuda completo
/assinatura - Verifica status da assinatura (apenas PV)
```

#### Para Administradores

```
/novosorteio - Cria novo sorteio
/newadm <userId> <perfilId> - Adiciona admin
/admins - Lista administradores
/sub - Registra assinatura (apenas PV)
/log <tipo> <topicoId> - Configura logs
/register - Importa usuários do JSON
/adduser <userId> <username> <name> <perfilId> - Adiciona usuário
```

---

## 📊 Comandos Disponíveis

### Comandos de Usuário

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `/start` | Registra usuário no sistema automaticamente | `/start` |
| `/help` | Mostra menu de ajuda com todos os comandos | `/help` |
| `/assinatura` | Verifica status da assinatura (data, grupo, valor) | `/assinatura` (apenas no privado) |

### Comandos de Admin

| Comando | Descrição | Permissão | Uso |
|---------|-----------|-----------|-----|
| `/novosorteio` | Cria novo sorteio com botões interativos | Admin do grupo | `/novosorteio` |
| `/newadm` | Adiciona novo administrador ao sistema | Owner/Admin | `/newadm 123456789 2` |
| `/admins` | Lista todos os administradores cadastrados | Qualquer Admin | `/admins` |
| `/sub` | Registra assinatura de usuário (PIX) | Admin (PV) | `/sub` (encaminhar msg) |
| `/log` | Configura tópico para tipo de log | Owner/Admin | `/log erro 123456` |
| `/register` | Importa usuários do participants.json | Admin | `/register` |
| `/adduser` | Adiciona usuário manualmente | Admin | `/adduser 123 @user Nome 4` |

### Ações via Botões

| Botão | Descrição | Permissão |
|-------|-----------|-----------|
| **Participar do sorteio** | Registra participação no sorteio atual | Todos |
| **Sortear** | Realiza sorteio e notifica vencedores | Admin do grupo |
| **❌ Cancelar sorteio** | Cancela sorteio e registra cancelamento | Admin do grupo |

---

## 💳 Sistema de Assinaturas

### Como Funciona

1. **Usuário envia comprovante PIX** para admin no privado
2. **Admin encaminha mensagem** para o bot com `/sub`
3. **Bot calcula datas automaticamente**:
   - Se dia < 29: Inicia no mês atual
   - Se dia >= 29: Inicia no próximo mês
   - Duração: 1 mês
4. **Assinatura ativada** com modificador de sorte 3x
5. **Notificações automáticas** 2 dias antes do vencimento

### Modo Manual

Para controle total sobre datas e valores:

```
/sub DD/MM/YYYY#DD/MM/YYYY#valor
/sub 01/12/2024#01/01/2025#5.00
```

### Vantagens para Assinantes

- ✅ **3x mais chances** de ganhar em sorteios (luck_modifier)
- ✅ **Notificações automáticas** de vencimento
- ✅ **Histórico completo** de pagamentos
- ✅ **Badge de assinante** (futuro)

### Notificações Automáticas

O bot verifica diariamente às **06:00 (horário de Brasília)** e envia notificações:

- **2 dias antes**: 📅 Lembrete de vencimento
- **1 dia antes**: ⏰ Vence amanhã
- **Dia do vencimento**: ⚠️ ÚLTIMO DIA

---

## 🗄️ Arquitetura do Banco de Dados

### Tabelas Principais

#### `tbUser`
Armazena apenas dados essenciais:
```sql
idUser (PK) | fkIdPerfilUser | createdAt
```

#### `tbMetadataUser`
Sistema chave-valor para dados flexíveis:
```sql
idMetadataUser (PK) | fkIdUser | fkIdMetadata | valueMetadata | createdAt
```

#### `tbRafflesDetails`
Detalhes dos sorteios:
```sql
idRafflesDetails (PK) | fkIdGroup | messageId | captionRaffles | 
numWinners | participantCount | statusRaffles | createdAt | closedAt
```

#### `tbRaffles`
Participações e vencedores:
```sql
idRaffles (PK) | fkIdUser | fkIdRafflesDetails | isWinner | 
winPosition | luck_modifier | createdAt
```

#### `tbSubscription`
Assinaturas ativas:
```sql
idSubscription (PK) | fkIdUser | fkIdGroup | startDate | endDate |
amountPaid | statusSubscription | fileIdSubscription | paymentMethod | createdAt
```

### Stored Procedures

17 procedures inline para lógica de negócio:

- **Usuários**: `sp_register_user`, `sp_set_user_meta`, `sp_get_user_meta`
- **Permissões**: `sp_check_admin_permission`, `sp_get_user_permission`
- **Sorteios**: `sp_register_participation`, `sp_register_winner`, `sp_close_raffle`
- **Assinaturas**: `sp_check_subscription`, `sp_create_subscription`

### Views

6 views para consultas otimizadas:

- `vw_users_full` - Usuários com metadata
- `vw_raffles_with_participants` - Sorteios com contagem
- `vw_active_subscriptions` - Assinaturas ativas
- `vw_raffle_winners` - Vencedores de sorteios

---

## 🤝 Contribuindo

Contribuições são muito bem-vindas! Siga estes passos:

1. **Fork** o projeto
2. **Crie uma branch** para sua feature (`git checkout -b feature/MinhaFeature`)
3. **Commit** suas mudanças (`git commit -m 'feat: Adiciona nova feature'`)
4. **Push** para a branch (`git push origin feature/MinhaFeature`)
5. **Abra um Pull Request**

### Convenções de Commit

Seguimos o padrão [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: nova funcionalidade
fix: correção de bug
docs: apenas documentação
style: formatação de código
refactor: refatoração sem mudança de comportamento
test: adição de testes
chore: tarefas de manutenção
```

### Regras

- ✅ Mantenha a estrutura modular
- ✅ Comente código complexo
- ✅ Teste antes de commitar
- ✅ Atualize a documentação
- ✅ Siga o padrão de código existente

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

**Resumo da Licença:**
- ✅ Uso comercial permitido
- ✅ Modificação permitida
- ✅ Distribuição permitida
- ✅ Uso privado permitido
- ⚠️ Sem garantias
- ⚠️ Manter créditos do autor

---

## 👨‍💻 Autor

**C3bola** - Desenvolvedor e criador do bot

- 🌐 GitHub: [@c3bola](https://github.com/c3bola)
- 📧 Email: fnc3bola@gmail.com
- 💬 Telegram: @c3bola

---

## 🙏 Agradecimentos

- **Comunidade Fortnite Brasil** - Inspiração e feedback constante
- **[Telegraf](https://telegraf.js.org/)** - Framework incrível para bots Telegram
- **[MySQL](https://www.mysql.com/)** - Banco de dados robusto e confiável
- **[Node.js](https://nodejs.org/)** - Plataforma JavaScript server-side

---

## 📈 Roadmap

Funcionalidades planejadas para versões futuras:

- [ ] Dashboard web para administração
- [ ] Relatórios estatísticos de sorteios
- [ ] Sistema de níveis e recompensas
- [ ] Integração com outras moedas (crypto)
- [ ] API REST para integrações
- [ ] Bot para Discord
- [ ] Sistema de afiliados
- [ ] Sorteios agendados

---

## 🐛 Reportar Bugs

Encontrou um bug? [Abra uma issue](https://github.com/c3bola/sorteio-fnbr-bot/issues) com:

- Descrição clara do problema
- Passos para reproduzir
- Comportamento esperado vs atual
- Screenshots (se aplicável)
- Logs de erro

---

## 💬 Suporte

Precisa de ajuda? Entre em contato:

- 📧 Email: fnc3bola@gmail.com
- 💬 Telegram: @c3bola
- 🐛 Issues: [GitHub Issues](https://github.com/c3bola/sorteio-fnbr-bot/issues)

---

## ⭐ Gostou do Projeto?

Se este bot foi útil para você:

- ⭐ Dê uma estrela no GitHub
- 🔄 Compartilhe com sua comunidade
- 🐛 Reporte bugs
- 💡 Sugira melhorias
- 🤝 Contribua com código

---

<div align="center">

**Desenvolvido com ❤️ por C3bola para a comunidade Fortnite Brasil**

[⬆ Voltar ao topo](#-sorteio-fnbr-bot---sistema-de-sorteios-para-telegram)

</div>

