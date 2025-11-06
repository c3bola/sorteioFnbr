# 📋 Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não lançado] - 2025-11-06

### ✨ Novos Recursos

#### Comandos Administrativos no Privado

Agora os administradores têm acesso a três novos comandos poderosos para gerenciar sorteios e assinaturas diretamente no chat privado com o bot:

##### 📊 `/sorteios` - Gestão de Sorteios
Permite que admins visualizem rapidamente todos os sorteios organizados por status. Com uma interface intuitiva de botões, você pode:
- Ver sorteios **abertos** (em andamento)
- Consultar sorteios **finalizados** (já realizados)
- Revisar sorteios **cancelados**

Cada sorteio mostra informações essenciais como código único, grupo onde aconteceu, número de participantes e data de criação. Perfeito para ter uma visão geral rápida de tudo que está acontecendo!

##### 👥 `/participantes <código>` - Detalhes do Sorteio
Quer saber exatamente quem está participando de um sorteio específico? Este comando é para você! Ao informar o código do sorteio, você recebe:
- **Informações completas**: grupo, status atual, descrição do prêmio
- **Lista de vencedores**: destacada no topo (quando o sorteio já foi realizado)
- **Todos os participantes**: com nome e horário exato de entrada
- **Divisão automática**: se a lista for muito grande, o bot divide em várias mensagens

Ideal para fazer auditorias, conferir participações e manter tudo transparente.

##### 🎫 `/assinaturas` - Gerenciamento Inteligente
Este comando foi completamente reformulado e agora funciona de forma diferente para usuários e administradores:

**Para usuários comuns:**
- Consulta simples e direta da sua própria assinatura
- Veja sua validade, dias restantes e valor pago
- Notificação clara se sua assinatura está ativa ou vencida

**Para administradores:**
- Interface com botões para filtrar assinaturas por status
- Visualize assinaturas **ativas**, **expiradas** ou **canceladas**
- Cada assinatura mostra: nome completo, ID do usuário, data de validade, valor pago e dias restantes
- Perfeito para controle financeiro e renovações

### 🔧 Melhorias Técnicas

#### Eliminação de Duplicatas
Resolvemos um problema crítico onde assinaturas apareciam duplicadas nas listagens. A solução foi implementar views SQL inteligentes que:
- Filtram automaticamente apenas a assinatura mais recente de cada usuário
- Mantêm o histórico completo no banco (para relatórios futuros)
- Melhoram a performance das consultas

**Views criadas:**
- `vw_latest_subscriptions` - Base que garante dados únicos
- `vw_active_subscriptions` - Assinaturas ativas sem duplicatas
- `vw_expired_subscriptions` - Assinaturas vencidas
- `vw_cancelled_subscriptions` - Assinaturas canceladas

#### Otimização de Performance
Reduzimos drasticamente o número de consultas ao banco de dados:
- **Antes**: Para listar 50 assinaturas = 100+ queries (2 por usuário)
- **Depois**: Para listar 50 assinaturas = 1 query única
- **Resultado**: Resposta 50x mais rápida e menos carga no servidor

#### Formatação Mais Robusta
Migramos de Markdown para HTML em todos os comandos de consulta. Por quê?
- **Compatibilidade**: Nomes com caracteres especiais (_, |, *, #) não quebram mais
- **Estabilidade**: Zero erros de formatação, independente do conteúdo
- **Profissionalismo**: Mensagens sempre bem formatadas

### 🐛 Correções

#### Verificação de Assinatura
Corrigimos um bug crítico no comando `/assinatura` onde usuários com assinatura válida recebiam mensagem de erro:
- **Problema**: Verificava campo `is_active` (que não existe)
- **Solução**: Agora usa `can_participate` (retornado pela stored procedure)
- **Impacto**: 100% dos usuários com assinatura ativa agora veem seus dados corretamente

#### Permissões de Admin
Ajustamos a verificação de permissões administrativas em todos os novos comandos:
- Antes usava tabela `tbAdmin` (que não existe)
- Agora usa corretamente `tbPerfilUser` com JOIN apropriado
- Verifica perfis: owner, admin e moderator

### 📚 Documentação

#### Comando `/help` Atualizado
Adicionamos uma nova seção chamada **"Consultas (Privado)"** que documenta todos os comandos administrativos:
- Descrição clara de cada comando
- Exemplos de uso
- Indicação de comandos exclusivos para admins

#### Estrutura do Banco de Dados
O arquivo `database.sql` foi atualizado com as novas views, mantendo:
- Comentários explicativos
- Organização por categorias
- Compatibilidade com a estrutura existente

---

## 💡 Próximas Melhorias Sugeridas

### Comando `/historico`
Aproveitar o histórico de assinaturas mantido no banco para criar um comando que mostre:
- Todo o histórico de pagamentos de um usuário
- Relatórios de faturamento por período
- Estatísticas de renovações

### Dashboard Administrativo
Implementar um comando `/dashboard` que mostre:
- Total de assinaturas ativas vs. expiradas
- Receita do mês
- Taxa de renovação
- Sorteios mais populares

### Notificações Automáticas
Melhorar o sistema de notificações para:
- Avisar usuários 7, 3 e 1 dia antes do vencimento
- Notificar admins sobre assinaturas não renovadas
- Enviar resumos semanais

---

## 🙏 Agradecimentos

Obrigado por usar o Bot de Sorteios FNBR! Este update foi focado em dar mais controle e visibilidade para os administradores, mantendo a simplicidade para os usuários finais.

Encontrou algum bug ou tem uma sugestão? Abra uma issue no GitHub!

---

## 📖 Guia de Uso Rápido

### Para Administradores

```
/sorteios              → Ver todos os sorteios por status
/participantes <cod>   → Ver detalhes de um sorteio específico
/assinaturas          → Gerenciar assinaturas (ativas/expiradas/canceladas)
```

### Para Usuários

```
/assinatura           → Ver minha assinatura
/assinaturas          → Ver minha assinatura (alias)
```

### Dicas

1. **Códigos de sorteio**: Use `/sorteios` para encontrar o código, depois `/participantes` com ele
2. **Assinaturas**: Como admin, use os botões para filtrar por status rapidamente
3. **Performance**: Todas as consultas são rápidas e otimizadas, pode usar à vontade!

---

**Versão**: 2025.11.06  
**Desenvolvido com**: ❤️ para a comunidade FNBR  
**Stack**: Node.js, Telegraf, MySQL
