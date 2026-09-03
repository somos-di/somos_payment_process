import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))

const FILES = [
  'js/shared/config.js',
  'js/shared/api.js',
  'js/shared/backend-client.js',
  'js/shared/store.js',
  'js/shared/data.js',
  'js/shared/auth.js',
  'js/shared/sidebar-user.js',
  'js/shared/consulta-tabs.js',
  'js/shared/process-detail-modal.js',
  'js/shared/column-tools.js',
  'js/shared/client-pager.js',
  'js/shared/process-approvers-modal.js',
  'js/shared/process-installments-modal.js',
  'js/shared/process-filters.js',
  'js/shared/process-list.js',
  'js/apps/commissions/commission-launch.js',
  'js/shared/shell.js',
  'js/shared/router.js',
  'js/shared/agent-widget.js',
]

const OUT = 'js/app.bundle.js'

const parts = FILES.map((rel) => {
  const code = readFileSync(join(root, rel), 'utf8')
  return '/* ==== ' + rel + ' ==== */\n' + code + '\n;\n'
})

writeFileSync(join(root, OUT), parts.join('\n'), 'utf8')
console.log(FILES.length + ' arquivos -> ' + OUT)
