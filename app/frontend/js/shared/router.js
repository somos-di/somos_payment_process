const DEFAULT_ROUTE = window.CONFIG.ROUTES.DEFAULT
const LOGIN_ROUTE = window.CONFIG.ROUTES.LOGIN

const ROUTES = {
    'login': { title: 'Entrar', folder: 'auth', public: true },
    'dashboard': { title: 'Dashboard', folder: 'dashboard', parentLabel: 'Início' },
    'solicitar': { title: 'Novo Processo', folder: 'solicitar', parentLabel: 'Solicitar' },
    'solicitar-massa': { title: 'Solicitar em Massa', folder: 'solicitar', parentLabel: 'Solicitar' },
    'meus-lancamentos': { title: 'Meus Lançamentos', folder: 'solicitar', parentLabel: 'Solicitar' },
    'correcao': { title: 'Correções', folder: 'correcao', parentLabel: 'Correção' },
    'editar-processo': { title: 'Editar Processo', folder: 'correcao', parentLabel: 'Correção' },
    'consulta': { title: 'Processos', folder: 'consulta', parentLabel: 'Consulta' },
    'aprovacoes': { title: 'Aprovações Pendentes', folder: 'aprovar', parentLabel: 'Aprovar' },
    'minhas-aprovacoes': { title: 'Minhas Aprovações', folder: 'aprovar', parentLabel: 'Aprovar' },
    'financeiro': { title: 'Financeiro', folder: 'departamento', parentLabel: 'Departamento' },
    'financeiro-integrados': { title: 'Processos Integrados', folder: 'departamento', parentLabel: 'Departamento', financeiro: true },
    'sync': { title: 'Sincronização UAU', folder: 'sync', parentLabel: 'Integração', admin: true },
    'admin-grupos': { title: 'Grupos & Usuários', folder: 'admin', parentLabel: 'Administração', admin: true },
    'permissoes': { title: 'Permissões (Empresa/Obra/Tipo)', folder: 'admin', parentLabel: 'Administração', admin: true },
    'sem-aprovador': { title: 'Processos sem Aprovador', folder: 'admin', parentLabel: 'Administração', admin: true },
    'um-aprovador': { title: 'Processos com 1 Aprovador', folder: 'admin', parentLabel: 'Administração', admin: true },
    'com-aprovador': { title: 'Processos com Aprovador', folder: 'admin', parentLabel: 'Administração', admin: true },
}

const loadedScripts = new Set()

function setupSidebar() {

    if (typeof window.setupShell === 'function') window.setupShell()
}

function populateSolicitationLaunchers() {
    const body = document.getElementById('sol-folder-body')
    const countEl = document.getElementById('sol-folder-count')
    if (!body || typeof window.getSolicitationGroups !== 'function') return

    const groups = window.getSolicitationGroups()
    let totalItems = 0
    let html = ''
    groups.forEach(function (g, gIdx) {
        const subId = 'sub-sol-' + gIdx
        const groupItemCount = g.subgroups.reduce(function (sum, s) { return sum + s.items.length }, 0)
        totalItems += groupItemCount

        const subgroupsHtml = g.subgroups.map(function (sg, sgIdx) {
            const itemsHtml = sg.items.map(function (it) {
                const globalIdx = window.SOLICITATION_LAUNCHERS.indexOf(it)
                return '<a class="nav-item sol-launcher" href="javascript:void(0)" data-launcher-idx="'
                    + globalIdx + '">' + escapeText(it.menuLabel) + '</a>'
            }).join('')
            const labelHtml = sg.subgroup
                ? '<div class="sol-subgroup-label">'
                + '<span class="sg-dot" style="background:' + colorForGroup(sgIdx) + '"></span>'
                + '<span class="sg-label">' + escapeText(sg.subgroup) + '</span>'
                + '<span class="sg-count">' + sg.items.length + '</span>'
                + '</div>'
                : ''
            return labelHtml + itemsHtml
        }).join('')

        html += ''
            + '<div class="subfolder open" id="' + subId + '">'
            + '<div class="subfolder-head">'
            + '<span class="gdot" style="background:' + colorForGroup(gIdx) + '"></span>'
            + '<span class="gl">' + escapeText(g.group) + '</span>'
            + '<span class="gc">' + groupItemCount + '</span>'
            + '<svg class="gchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>'
            + '</div>'
            + '<div class="subfolder-body">' + subgroupsHtml + '</div>'
            + '</div>'
    })

    html += '<a class="nav-item nav-item-flat" href="' + window.CONFIG.HASH('solicitations')
        + '" data-route="solicitations" style="margin-top:8px">Todas as Solicitações</a>'

    body.innerHTML = html
    if (countEl) countEl.textContent = String(totalItems)

    body.querySelectorAll('.subfolder-head').forEach(function (h) {
        h.addEventListener('click', function () { h.parentElement.classList.toggle('open') })
    })
    body.querySelectorAll('.sol-launcher').forEach(function (a) {
        a.addEventListener('click', function () {
            const idx = Number(a.getAttribute('data-launcher-idx'))
            const cfg = window.SOLICITATION_LAUNCHERS[idx]
            if (!cfg || typeof window.openSolicitationModal !== 'function') return
            window.openSolicitationModal(cfg).catch(function (err) {
                if (err && err.message === 'cancelled') return
                console.warn('solicitation-modal: falha', err)
            })
        })
    })
}

function colorForGroup(idx) {
    const palette = ['var(--accent)', 'var(--warn)', 'var(--ok)', 'var(--violet)']
    return palette[idx % palette.length]
}

function escapeText(s) {
    if (s === null || s === undefined) return ''
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function updateActiveLink(route) {
    document.querySelectorAll('.menu-item, .home-link').forEach(function (link) {
        const r = link.getAttribute('data-route')
        link.classList.toggle('active', r === route)
    })
}

function updateBreadcrumb(meta) {
    const crumb = document.getElementById('crumb')
    if (!crumb) return
    let html = '<span>FLUXO</span><span class="sep">/</span>'
    if (meta.parentLabel) {
        html += '<span class="tag">' + escapeText(meta.parentLabel) + '</span><span class="sep">/</span>'
    }
    html += '<b>' + escapeText(meta.title) + '</b>'
    crumb.innerHTML = html
}

function parseHash() {
    const hash = window.location.hash || window.CONFIG.HASH(DEFAULT_ROUTE)
    const cleaned = hash.replace(/^#\/?/, '') || DEFAULT_ROUTE
    const [route, queryString] = cleaned.split('?')
    return {
        route: route || DEFAULT_ROUTE,
        params: new URLSearchParams(queryString || ''),
    }
}

async function loadScriptOnce(src) {
    if (loadedScripts.has(src)) return
    return new Promise(function (resolve, reject) {
        const s = document.createElement('script')
        s.src = src
        s.onload = function () { loadedScripts.add(src); resolve() }
        s.onerror = function () { reject(new Error('Falha ao carregar ' + src)) }
        document.head.appendChild(s)
    })
}

async function loadView(route, params) {
    const meta = ROUTES[route]
    const content = document.getElementById('app-content')


    const navId = window.__currentNavId
    const stale = function () { return navId !== window.__currentNavId }

    if (!meta) {
        window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
        return
    }

    const authed = window.Auth && window.Auth.isAuthenticated()
    if (!meta.public && !authed) {
        window.location.hash = window.CONFIG.HASH(LOGIN_ROUTE)
        return
    }
    if (route === LOGIN_ROUTE && authed) {
        window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
        return
    }

    if (meta.admin) {
        const u = window.Auth && window.Auth.getUser()
        if (!u || !u.is_admin) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    // rota de financeiro: só membros dos grupos "Financeiro Integração*" (is_financeiro)
    // ou admin. A RLS ainda limita as LINHAS por grupo; este gate é o de acesso à tela.
    if (meta.financeiro) {
        const u = window.Auth && window.Auth.getUser()
        if (!u || (!u.is_financeiro && !u.is_admin)) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    document.body.classList.toggle('auth-mode', route === LOGIN_ROUTE)

    updateBreadcrumb(meta)
    content.innerHTML = '<div class="view-loading">Carregando ' + escapeText(meta.title) + '…</div>'
    window.routeParams = params

    try {
        const html = await fetch(window.CONFIG.VIEW_TEMPLATE(meta.folder, route)).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status)
            return r.text()
        })
        if (stale()) return
        const parsed = new DOMParser().parseFromString(html, 'text/html')
        const partial = parsed.querySelector('main')
        if (!partial) throw new Error('A página legada não tem <main>')
        content.innerHTML = partial.innerHTML

        await loadScriptOnce('js/views/' + route + '.js')
        if (stale()) return

        const initFnName = 'initView_' + route.replace(/-/g, '_')
        const initFn = window[initFnName]
        if (typeof initFn !== 'function') {
            throw new Error('JS desta view não expõe ' + initFnName + '().')
        }
        await initFn()
    } catch (err) {
        if (stale()) return
        content.innerHTML = '<div class="view-error">Falha ao carregar a view: ' + escapeText(err.message) + '</div>'
    }
}

async function handleRoute() {
    window.__currentNavId = (window.__currentNavId || 0) + 1
    const parsed = parseHash()
    updateActiveLink(parsed.route)
    await loadView(parsed.route, parsed.params)
}




function warmState() {
    if (!window.Store || !window.Auth || !window.Auth.isAuthenticated()) return
    window.Store.warm('pending_approvals')
}





async function loadStatusCatalog() {
    try {
        const catalog = await window.API.get('/catalog/status')
        if (catalog && catalog.byId) window.CONFIG.STEPS = catalog.byId
        if (catalog && catalog.byKey) window.CONFIG.STATUS = catalog.byKey
    } catch (e) {  }
}


async function loadProcessKinds() {
    try {
        const rows = await window.Store.get('process_kinds')
        if (Array.isArray(rows) && rows.length) {
            const m = {}
            rows.forEach(function (r) { m[r.id_pkn] = r.name_pkn })
            window.CONFIG.PROCESS_KINDS = m
        }
    } catch (e) {  }
}

async function loadCatalogs() {
    if (!window.Store || !window.Auth || !window.Auth.isAuthenticated()) return
    await Promise.all([loadStatusCatalog(), loadProcessKinds()])
}

async function bootstrapAuth() {
    if (!window.Auth) return
    await window.Auth.init()
    await loadCatalogs()
    warmState()
    window.Auth.onChange(function (session) {
        if (!session && (window.location.hash || '').indexOf(LOGIN_ROUTE) === -1) {
            window.location.hash = window.CONFIG.HASH(LOGIN_ROUTE)
        }
        if (session) { loadCatalogs(); warmState() }
    })
}

window.addEventListener('hashchange', handleRoute)
window.addEventListener('DOMContentLoaded', async function () {
    await bootstrapAuth()
    setupSidebar()
    if (!window.location.hash) {
        window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
        return
    }
    handleRoute()
})
