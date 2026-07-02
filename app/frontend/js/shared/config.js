(function () {
    window.CONFIG = {
        // Relativo por padrão: o nginx faz proxy de /api -> backend (same-origin,
        // resolve cookie/CORS). Override em dev via `window.__API_BASE__`.
        API_BASE: (window.__API_BASE__ || '/api/v1'),
        ROUTES: { DEFAULT: 'dashboard', LOGIN: 'login' },
        AUTH: { REFRESH_LEEWAY_SECONDS: 30 },
        // Parâmetros fixos por view/função (ponto único; nada de números soltos nas views).
        PARAMS: {
            comAprovador: { slowDays: 5 }, // aguardando há mais dias que isso = "lento" (vermelho)
        },
        PROCESS_KINDS: {
            1: 'Pagamento Avulso', 2: 'Reembolso', 3: 'Processo PJ',
            4: 'Taxa de Gestão', 5: 'Distribuição de Lucros', 6: 'Comissão', 7: 'Adiantamento',
        },
        // Fallbacks: no boot o router sobrescreve STEPS/STATUS com o catálogo
        // normalizado do backend (GET /catalog/status, fonte da verdade = payment.status_kind).
        STEPS: {   // id -> rótulo
            0: 'Cancelado',
            1: 'Aguardando aprovação', 2: 'Pendente de Correção', 3: 'Cancelado',
            4: 'Em integração', 6: 'Em análise financeiro', 7: 'Integrado',
            8: 'Erro - Sem planejamento', 9: 'UAU - Processo Criado',
        },
        STATUS: {  // key -> id (usado nas comparações de tela)
            cancelado: 0, aguardando: 1, correcao: 2, cancelado_alt: 3,
            integracao: 4, financeiro: 6, integrado: 7, erro: 8, uau_criado: 9,
        },
        VIEW_TEMPLATE: function (folder, route) { return 'html/views/' + folder + '/' + route + '.html'; },
        HASH: function (route) { return '#/' + route; },
    }
})()
