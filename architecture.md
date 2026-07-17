# Arquitetura inicial do projeto Portal

## Visão geral
Este repositório implementa um portal de processos de pagamento com uma arquitetura em duas camadas principais:

- Backend em TypeScript com Fastify, responsável por autenticação, rotas, integração e orquestração para o produto de aprovação.
- Frontend estático em HTML/CSS/JavaScript puro, servido por nginx via container Docker.

O contexto de negócio do projeto é mais amplo do que um simples CRUD: ele é um portal BFF para um ecossistema de aprovação, onde o fluxo principal é receber informações de pagamento, aplicar regras de negócio e delegar a execução para o serviço de aprovação Dokimos. O portal não deve expor diretamente o Dokimos ao frontend; ele atua como camada de proteção, autenticação, autorização e composição de dados.

## Contexto de produto e evolução esperada
O produto original foi pensado para ser um input de informações de pagamento a serem realizados por uma empresa. A regra de negócio relacionada ao fluxo de aprovação foi encapsulada e liberada em Dokimos, que passa a ser o motor de aprovação do produto. O portal, por sua vez, deve concentrar:

- autenticação e autorização do usuário
- gestão de tenants e usuários
- orquestração de chamadas ao Dokimos
- exposição de uma API para o frontend em formato BFF

Esse padrão é importante porque os microserviços downstream, incluindo o Dokimos, não precisam implementar autenticação nem autorização próprios. O portal assume esse papel central.

## Direcionamento arquitetural para a próxima fase
A estrutura atual já está alinhada com o padrão BFF em termos de entrada HTTP e separação entre rotas, controllers, services e gateways. A evolução esperada para a próxima versão inclui:

- migração da gestão de usuários do modelo atual para um armazenamento em MongoDB, com coleção users
- integração com autenticação via OIDC do Azure para identificar o usuário e seu tenant
- introdução de um modelo de tenant e permissões com campos como dokimus_roles e is_admin
- criação de endpoints para regras de aprovação, usuários e listagens de solicitações

### Modelo de usuário planejado
A coleção users no MongoDB deve guardar, em essência, os seguintes campos:

- id: identificador interno do usuário
- oid: id do usuário no Microsoft Entra ID / Azure
- tid: tenant_id do usuário
- email
- telefone
- dokimus_roles: objeto com flags de permissões, por exemplo admin e issuer
- is_admin: flag administrativa do sistema, usada para gerenciar permissões e usuários do tenant

### Collection tenants
Além da coleção users, o sistema deve ter uma coleção tenants para centralizar a configuração do tenant. Essa coleção deve guardar, no mínimo, o tenant_id e um conjunto de flags de habilitação por produto ou módulo.

Exemplo de estrutura inicial:

- id
- tid
- name
- dokimos: boolean
- enabled_features: object

A ideia é que, no primeiro momento, o tenant controle se o módulo Dokimos está habilitado. Posteriormente, essa mesma coleção pode evoluir para conter billing, limites, integrações e outras configurações de produto.

### Regras de negócio da primeira versão
A primeira versão deve contemplar:

1. entrada e criação de tenant quando o tenant do usuário ainda não existir
2. capacidade de alterar dados de outros usuários do mesmo tenant quando o usuário for admin
3. alteração do próprio telefone pelo usuário
4. cadastro de novos usuários pelo admin, com associação automática ao oid ao entrar
5. cadastro de fluxos de aprovação do Dokimos
6. listagem das solicitações criadas pelo usuário
7. listagem das solicitações aprovadas ou pendentes de aprovação pelo usuário

## Ponto de entrada

### Backend
- O bootstrap principal está em [app/backend/main.ts](app/backend/main.ts).
- O servidor Fastify registra:
  - middlewares globais (CORS, cookies, rate limiting, error handler)
  - rotas públicas e protegidas
  - inicialização de cache e warming no boot
- Na evolução desejada, o backend passará a atuar como camada de orchestration do BFF, concentrando o fluxo de autenticação, tenant e acessos.

### Frontend
- O ponto inicial é [app/frontend/index.html](app/frontend/index.html).
- O frontend é estático e usa navegação por hash para carregar diferentes views.
- O conteúdo é servido por nginx, que também faz proxy das chamadas para o backend em /api.
- Em uma próxima fase, o frontend deve depender exclusivamente do backend como interface unificada, sem chamadas diretas ao Dokimos.

## Arquitetura do backend

### Estrutura principal
A organização segue uma separação por responsabilidade:

- [app/backend/routes](app/backend/routes): registro de rotas por domínio
- [app/backend/controllers](app/backend/controllers): camada de entrada HTTP
- [app/backend/services](app/backend/services): lógica de negócio
- [app/backend/gateways](app/backend/gateways): integração externa e clientes de infraestrutura
- [app/backend/middlewares](app/backend/middlewares): autenticação, autorização e tratamento de erros
- [app/backend/models](app/backend/models): esquemas/validação de dados
- [app/backend/validators](app/backend/validators): validação de payloads e parâmetros
- [app/backend/tests](app/backend/tests): testes automatizados

### Container de dependências
A criação de dependências do core do sistema acontece em [app/backend/factories/container.ts](app/backend/factories/container.ts).

Esse container instancia:
- gateways para Supabase, Redis e UAU
- serviços para processos, auth, dados, admin, catálogo e sincronização
- controladores para cada domínio

Isso reduz acoplamento e centraliza a composição do núcleo da aplicação.

## Fluxo de rotas

### Rotas públicas e protegidas
O registro de rotas é dividido em [app/backend/routes/index.ts](app/backend/routes/index.ts):

- Rotas públicas: autenticação, logout, OAuth e endpoints de health
- Rotas protegidas: processos, sync, dados, admin, catálogo e mini apps

As rotas protegidas passam por um preHandler global com [app/backend/middlewares/requireAuth.ts](app/backend/middlewares/requireAuth.ts), que valida o token de sessão do usuário e tenta renovar a sessão quando necessário.

### Middleware de autorização
- [app/backend/middlewares/requireAdmin.ts](app/backend/middlewares/requireAdmin.ts) restringe acesso a endpoints administrativos.
- O sistema usa o conceito de sessão baseada em cookies httpOnly e tokens Supabase.

## Domínios de negócio

### Processos
O domínio central da aplicação está em:
- [app/backend/controllers/processesController.ts](app/backend/controllers/processesController.ts)
- [app/backend/services/processesService.ts](app/backend/services/processesService.ts)

Esse módulo cuida de:
- criação de processos e parcelas
- aprovação e rejeição
- correção de processos
- administração de parcelas
- ações de fluxo como cancelamento e envio para UAU

A implementação usa RPCs do banco com autorização no PostgreSQL, em vez de confiar somente na lógica do TypeScript.

### Autenticação
A autenticação é tratada no backend em [app/backend/services/authService.ts](app/backend/services/authService.ts).

Principais características:
- login tradicional com Supabase Auth
- fluxo OAuth com Microsoft/Azure via PKCE
- refresh de sessão via refresh token
- provisionamento de usuário em tabela local de usuários

### Dados e catálogo
O módulo de dados em [app/backend/services/dataService.ts](app/backend/services/dataService.ts) fornece acesso genérico a recursos do banco, com cache para recursos globais.

O catálogo em [app/backend/services/catalogService.ts](app/backend/services/catalogService.ts) normaliza e entrega dados para o frontend, com estratégia de cache.

### Admin
O módulo de administração em [app/backend/controllers/adminController.ts](app/backend/controllers/adminController.ts) e [app/backend/services/adminService.ts](app/backend/services/adminService.ts) cuida de:
- usuários
- grupos
- permissões
- associação de usuário UAU

## Integrações externas

### Supabase
A camada de integração com Supabase fica em [app/backend/gateways/supabase.ts](app/backend/gateways/supabase.ts).

Há três modos de cliente:
- adminClient: operações com service role
- anonClient: operações anônimas
- userClient: operações em nome do usuário autenticado via token

Essa separação é importante porque grande parte da segurança e autorização está no banco via RLS e RPCs.

### UAU
A integração com UAU está em:
- [app/backend/gateways/uau.ts](app/backend/gateways/uau.ts)
- [app/backend/services/uauIntegrationService.ts](app/backend/services/uauIntegrationService.ts)
- [app/backend/services/syncUauData/sync.ts](app/backend/services/syncUauData/sync.ts)

O fluxo de integração inclui:
- montagem de payloads a partir dos dados do processo
- envio para webhook/n8n
- sincronização de dados espelhados do UAU para tabelas locais

### Redis e cache
A camada de cache está em [app/backend/cache](app/backend/cache):
- [app/backend/cache/cacheManager.ts](app/backend/cache/cacheManager.ts)
- [app/backend/cache/cacheWarmer.ts](app/backend/cache/cacheWarmer.ts)
- [app/backend/cache/cacheableResources.ts](app/backend/cache/cacheableResources.ts)

O projeto usa cache de leitura em Redis para recursos globais e lookups, com degradação resiliente para o banco quando o Redis estiver indisponível.

## Mini apps
O backend também suporta módulos menores, ou mini apps, registrados em [app/backend/apps/index.ts](app/backend/apps/index.ts).

Atualmente existem:
- Comissões: [app/backend/apps/commissions](app/backend/apps/commissions)
- Reaprovações: [app/backend/apps/reapprovals](app/backend/apps/reapprovals)

Esses módulos têm estrutura própria de controller, service, gateway e rotas, e são injetados no fluxo principal do backend.

## Frontend

### Características
O frontend é composto por:
- HTML principal em [app/frontend/index.html](app/frontend/index.html)
- CSS compartilhado em [app/frontend/css/shared](app/frontend/css/shared)
- JavaScript em [app/frontend/js](app/frontend/js)
- Views em [app/frontend/html/views](app/frontend/html/views)
- Apps específicos em [app/frontend/html/apps](app/frontend/html/apps)

### Estilo de implementação
O frontend é mais tradicional e imperativo do que modularizado em frameworks. Ele usa:
- templates HTML estáticos
- scripts JS que controlam navegação e chamadas ao backend
- abas, modais e filtros para interações do usuário

A camada de comunicação com o backend é centralizada em [app/frontend/js/shared/backend-client.js](app/frontend/js/shared/backend-client.js) e [app/frontend/js/shared/api.js](app/frontend/js/shared/api.js).

## Deploy e execução
O projeto usa Docker Compose para orquestrar:
- backend Fastify
- frontend nginx
- Redis

Veja [docker-compose.yaml](docker-compose.yaml).

## Pontos importantes para próximos agentes
1. O sistema depende fortemente de uma combinação entre lógica do backend e regras no banco PostgreSQL via RPCs.
2. A autenticação e autorização são centrais e devem ser preservadas.
3. O cache é resiliente, mas deve ser tratado com cuidado em mudanças de dados.
4. O frontend é estático e não segue um framework moderno; mudanças devem respeitar essa estrutura.
5. O backend é modular, mas a evolução deve preservar o padrão controller/service/gateway/route.
6. Novos módulos devem ser adicionados de forma consistente com os mini apps existentes.
7. A arquitetura futura deve priorizar o papel do portal como BFF e concentrar segurança e autorização nele.
8. A migração para MongoDB deve considerar a coleção users e o tenant como unidade de isolamento de dados.

## Diretrizes para futuras melhorias
- Preferir mudanças pequenas e bem delimitadas.
- Respeitar o fluxo atual de autenticação, autorização e integração externa.
- Evitar reescritas completas de frontend e backend sem necessidade.
- Quando criar novos endpoints, preferir manter a separação entre controller, service e gateway.
- Atualizar testes sempre que houver alteração de comportamento relevante.
- Em novas implementações, o portal deve ser o único ponto de entrada autorizado para o usuário e para as integrações com Dokimos.
- A autorização deve ser aplicada por tenant e por papel, e não apenas por endpoint isolado.
- A regra de negócio relacionada a aprovação deve ser tratada como responsabilidade do Dokimos e não como lógica espalhada no frontend nem no portal de forma duplicada.
- A visibilidade do módulo Dokimos deve ser controlada pelo tenant. Se o campo dokimos estiver habilitado para o tenant, o frontend pode exibir as telas e ações relacionadas ao Dokimos; caso contrário, elas devem ficar ocultas.
- A validação de habilitação do Dokimos deve acontecer também no backend, de forma a impedir acesso a endpoints e operações relacionadas ao módulo mesmo que o frontend seja burlado.
- O portal deve orquestrar chamadas ao Dokimos, mas não reimplementar as regras internas do motor de aprovação.
- O frontend deve consumir o portal, e não depender diretamente de endpoints do Dokimos.
- O backend deve desacoplar o conceito de tenant e usuário do conceito de fluxo de aprovação, mantendo o isolamento por contexto.
- Em uma transição futura, parte da lógica atual vinculada a RPCs e fluxo de pagamento pode ser reorganizada para ficar mais próxima do domínio de aprovação, com o portal apenas coordenando o processo.

## O que sugiro remover ou repensar
- Lógica de aprovação duplicada em camadas do frontend e do backend que hoje podem estar misturando domínio de negócio com camada de apresentação.
- Dependências diretas de UI para serviços externos, especialmente para o Dokimos.
- A ideia de manter regras de negócio no portal como se ele fosse o sistema de decisão final, quando o modelo correto é o portal atuar como gateway de segurança e orquestrador.
- Acoplamentos fortes ao Supabase como fonte única de verdade para dados de identidade e autorização, especialmente no contexto da migração para MongoDB.
- Qualquer endpoint que exponha diretamente o motor de aprovação sem passar pela política de autorização do tenant do portal.
