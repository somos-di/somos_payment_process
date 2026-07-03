(function () {
    window.CONFIG = {

        API_BASE: (window.__API_BASE__ || '/api/v1'),
        ROUTES: { DEFAULT: 'dashboard', LOGIN: 'login' },
        AUTH: { REFRESH_LEEWAY_SECONDS: 30 },
        
        PARAMS: {
            comAprovador: { slowDays: 5 }, 
        },
        PROCESS_KINDS: {
            1: 'Pagamento Avulso', 2: 'Reembolso', 3: 'Processo PJ',
            4: 'Taxa de Gestão', 5: 'Distribuição de Lucros', 6: 'Comissão', 7: 'Adiantamento',
        },

        STEPS: {   
            0: 'Cancelado',
            1: 'Aguardando aprovação', 2: 'Pendente de Correção', 3: 'Cancelado',
            4: 'Em integração', 6: 'Em análise financeiro', 7: 'Integrado',
            8: 'Erro - Sem planejamento', 9: 'UAU - Processo Criado',
        },
        STATUS: {  
            cancelado: 0, aguardando: 1, correcao: 2, cancelado_alt: 3,
            integracao: 4, financeiro: 6, integrado: 7, erro: 8, uau_criado: 9,
        },
        VIEW_TEMPLATE: function (folder, route) { return 'html/views/' + folder + '/' + route + '.html'; },
        HASH: function (route) { return '#/' + route; },
    }
})()
