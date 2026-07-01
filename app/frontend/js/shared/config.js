(function () {
    window.CONFIG = {
        // Relativo por padrão: o nginx faz proxy de /api -> backend (same-origin,
        // resolve cookie/CORS). Override em dev via `window.__API_BASE__`.
        API_BASE: (window.__API_BASE__ || '/api/v1'),
        ROUTES: { DEFAULT: 'dashboard', LOGIN: 'login' },
        AUTH: { REFRESH_LEEWAY_SECONDS: 30 },
        PROCESS_KINDS: {
            1: 'Pagamento Avulso', 2: 'Reembolso', 3: 'Processo PJ',
            4: 'Taxa de Gestão', 5: 'Distribuição de Lucros', 6: 'Comissão', 7: 'Adiantamento',
        },
        // Fallback: no boot o router sobrescreve isto com payment.status_kind (fonte da verdade).
        STEPS: {
            0: 'Cancelado',
            1: 'Aguardando aprovação', 2: 'Pendente de Correção', 3: 'Cancelado',
            4: 'Em integração', 6: 'Em análise financeiro', 7: 'Integrado',
            8: 'Erro - Sem planejamento', 9: 'UAU - Processo Criado',
        },
        VIEW_TEMPLATE: function (folder, route) { return 'html/views/' + folder + '/' + route + '.html'; },
        HASH: function (route) { return '#/' + route; },
    }
})()
