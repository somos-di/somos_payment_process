# Testes (backend)

Testes de unidade do backend usando o **test runner nativo do Node** (`node:test`)
com **tsx** para carregar TypeScript (ESM). Sem dependências extras.

## Rodar

```bash
npm test
```

(equivale a `node --import tsx --test "tests/**/*.test.ts"` — requer Node 21+ para o glob).

## Convenções

- Arquivos terminam em `*.test.ts` dentro desta pasta.
- Imports usam a extensão `.js` (padrão ESM do projeto): `import { x } from '../validators/common.js'`.
- Prefira testes **puros** (sem I/O). Para services/controllers que falam com Supabase/UAU,
  injete/mocke as dependências (o projeto usa injeção via `factories/container.ts`).

## Exemplo

Veja `validators.test.ts` — cobre as regras anti-abuso (`boundedRecord`, limites de
tamanho de texto/arquivo) sem tocar em banco ou rede.
