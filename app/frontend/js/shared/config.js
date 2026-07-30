(function () {
    window.CONFIG = {

        API_BASE: (window.__API_BASE__ || '/api/v1'),
        ROUTES: { DEFAULT: 'consulta', LOGIN: 'login' },
        AUTH: { REFRESH_LEEWAY_SECONDS: 30 },

        PARAMS: {
            comAprovador: { slowDays: 5 },
        },
        PROCESS_KINDS: {},
        MESSAGE_KINDS: {},
        STEPS: {},
        STATUS: {},
        STATUS_COLORS: { 0: 'red', 1: 'blue', 2: 'violet', 3: 'red', 4: 'blue', 6: 'warn', 7: 'ok', 8: 'red', 9: 'ok' },
        VIEW_TEMPLATE: function (folder, route) { return 'html/views/' + folder + '/' + route + '.html'; },
        HASH: function (route) { return '#/' + route; },
    }
})()
