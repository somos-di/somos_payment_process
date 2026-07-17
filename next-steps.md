# Next steps para a próxima fase do portal

## Objetivo
Este documento organiza os próximos passos para evoluir o portal a partir do estado atual, preservando o modelo BFF e preparando a implementação das primeiras funcionalidades da versão inicial.

## 1. Definir o modelo de domínio inicial
Antes de implementar, consolidar os conceitos centrais:

- Tenant
- User
- Rule
- ApprovalRequest / Solicitation
- ApprovalEvent

Esses conceitos devem ser refletidos no backend e, no futuro, no frontend.

## 2. Implementar a gestão de usuários com autenticação OIDC do Azure
### Objetivos
- autenticar o usuário via Microsoft Entra ID / Azure
- identificar o tenant via tid
- criar o usuário e o tenant quando ainda não existirem

### Pontos importantes
- o portal deve ser a única camada responsável por autenticação e autorização
- o usuário deve ser identificado por oid do Azure
- o tenant deve ser o principal isolador de dados e permissões

## 3. Introduzir o modelo de usuários e tenants no MongoDB
A primeira migração de persistência deve priorizar as coleções users e tenants.

### Collection tenants
Criar a collection tenants com, pelo menos, os campos:

- id
- tid
- name
- features: {dokimos: boolean}

### Comportamento esperado
- se o tenant tiver dokimos = true, o frontend pode exibir os recursos do Dokimos
- se o tenant tiver dokimos = false, o frontend deve ocultar esses recursos
- o backend deve validar essa flag antes de permitir acesso aos endpoints do módulo Dokimos

### Campos mínimos sugeridos para users
- id
- oid
- tid
- email
- telefone
- dokimus_roles
- is_admin

### Regras de uso
- o usuário pode editar apenas o próprio telefone
- admins do tenant podem editar outros usuários do mesmo tenant
- admins podem alterar dokimus_roles e promover outros usuários a admin

## 4. Implementar o fluxo inicial de onboarding
### Requisitos
- ao entrar, se o tenant não existir, criar um tenant
- se o usuário for o primeiro login do tenant, ele deve se tornar admin do tenant
- se não for o primeiro, o usuário entra como viewer normal

## 5. Implementar regras de aprovação
### Endpoint esperado
- /api/v1/{tenant_id}/rules

### Funcionalidades iniciais
- listar regras do tenant
- criar regra
- substituir regra
- excluir regra

### Observação importante
Essas rotas devem ser protegidas pelo portal e não depender diretamente do Dokimos para autenticação.

## 6. Implementar listagens de solicitações
### Requisitos iniciais
- listar solicitações criadas pelo usuário
- listar solicitações aprovadas
- listar solicitações pendentes de aprovação

Essas listagens devem consumir o backend do portal como camada de orquestração, não expor o downstream diretamente ao frontend.

## 7. Estruturar a camada de autorização por tenant e papel
A arquitetura futura deve garantir que:

- usuários só acessem dados do próprio tenant
- admins do tenant tenham operações de gerenciamento sobre usuários e regras
- membros normais tenham acesso apenas às ações permitidas pelo seu papel

## 8. Planejar a migração da camada de dados
Atualmente o projeto está fortemente vinculado ao Supabase e a RPCs. A próxima etapa de evolução deve começar a separar a camada de dados do portal do modelo atual, preparando a migração para MongoDB com foco na coleção users.

## 9. Manter o padrão de arquitetura do backend
A implementação deve preservar o padrão já adotado no projeto:

- routes
- controllers
- services
- gateways
- middlewares

Isso mantém o projeto consistente e facilita o trabalho de próximos agentes.

## 10. Prioridades recomendadas
1. autenticação OIDC + criação de tenant
2. coleção users no MongoDB
3. gestão de usuários por tenant
4. regras de aprovação
5. listagens de solicitações
6. integração com Dokimos como camada downstream
