const DEFAULT_ROUTE = window.CONFIG.ROUTES.DEFAULT
const LOGIN_ROUTE = window.CONFIG.ROUTES.LOGIN

const ROUTES = {
    'login': { title: 'Entrar', folder: 'auth', public: true },
    'solicitar': { title: 'Novo Processo', folder: 'solicitar', parentLabel: 'Solicitar' },
    'solicitar-massa': { title: 'Solicitar em Massa', folder: 'solicitar', parentLabel: 'Solicitar' },
    'meus-lancamentos': { title: 'Meus Lançamentos', folder: 'solicitar', parentLabel: 'Solicitar' },
    'correcao': { title: 'Correções', folder: 'correcao', parentLabel: 'Correção' },
    'editar-processo': { title: 'Editar Processo', folder: 'correcao', parentLabel: 'Correção' },
    'consulta': { title: 'Processos', folder: 'consulta', parentLabel: 'Consulta' },
    'aprovacoes': { title: 'Aprovações Pendentes', folder: 'aprovar', parentLabel: 'Aprovar' },
    'minhas-aprovacoes': { title: 'Minhas Aprovações', folder: 'aprovar', parentLabel: 'Aprovar' },
    'financeiro': { title: 'Financeiro', folder: 'departamento', parentLabel: 'Departamento', financeiro: true },
    'financeiro-integrados': { title: 'Processos Integrados', folder: 'departamento', parentLabel: 'Departamento', financeiro: true },
    'sync': { title: 'Sincronização UAU', folder: 'sync', parentLabel: 'Integração', admin: true },
    'admin-grupos': { title: 'Grupos & Usuários', folder: 'admin', parentLabel: 'Administração', admin: true },
    'permissoes': { title: 'Permissões (Empresa/Obra/Tipo)', folder: 'admin', parentLabel: 'Administração', admin: true },
    'sem-aprovador': { title: 'Processos sem Aprovador', folder: 'admin', parentLabel: 'Administração', admin: true },
    'um-aprovador': { title: 'Processos com 1 Aprovador', folder: 'admin', parentLabel: 'Administração', admin: true },
    'com-aprovador': { title: 'Processos com Aprovador', folder: 'admin', parentLabel: 'Administração', admin: true },
    'gestao-processos': { title: 'Gestão de Processos', folder: 'admin', parentLabel: 'Administração', admin: true },
    'reaprovals': { title: 'Reaprovações', appDir: 'reapprovals', parentLabel: 'Administração', admin: true },
    'comissoes': { title: 'Pagamento de Comissões', appDir: 'commissions', parentLabel: 'Comissões', commission: true },
    'comissoes-empreendimentos': { title: 'Empreendimentos (Comissões)', appDir: 'commissions', parentLabel: 'Comissões', admin: true },
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
    groups.forEach(function (group, gIdx) {
        const subId = 'sub-sol-' + gIdx
        const groupItemCount = group.subgroups.reduce(function (sum, subgroup) { return sum + subgroup.items.length }, 0)
        totalItems += groupItemCount

        const subgroupsHtml = group.subgroups.map(function (subgroup, sgIdx) {
            const itemsHtml = subgroup.items.map(function (item) {
                const globalIdx = window.SOLICITATION_LAUNCHERS.indexOf(item)
                return '<a class="nav-item sol-launcher" href="javascript:void(0)" data-launcher-idx="'
                    + globalIdx + '">' + escapeText(item.menuLabel) + '</a>'
            }).join('')
            const labelHtml = subgroup.subgroup
                ? '<div class="sol-subgroup-label">'
                + '<span class="sg-dot" style="background:' + colorForGroup(sgIdx) + '"></span>'
                + '<span class="sg-label">' + escapeText(subgroup.subgroup) + '</span>'
                + '<span class="sg-count">' + subgroup.items.length + '</span>'
                + '</div>'
                : ''
            return labelHtml + itemsHtml
        }).join('')

        html += ''
            + '<div class="subfolder open" id="' + subId + '">'
            + '<div class="subfolder-head">'
            + '<span class="gdot" style="background:' + colorForGroup(gIdx) + '"></span>'
            + '<span class="gl">' + escapeText(group.group) + '</span>'
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

    body.querySelectorAll('.subfolder-head').forEach(function (item) {
        item.addEventListener('click', function () { item.parentElement.classList.toggle('open') })
    })
    body.querySelectorAll('.sol-launcher').forEach(function (item) {
        item.addEventListener('click', function () {
            const index = Number(item.getAttribute('data-launcher-idx'))
            const config = window.SOLICITATION_LAUNCHERS[index]
            if (!config || typeof window.openSolicitationModal !== 'function') return
            window.openSolicitationModal(config).catch(function (error) {
                if (error && error.message === 'cancelled') return
                console.warn('solicitation-modal: falha', error)
            })
        })
    })
}

function colorForGroup(index) {
    const palette = ['var(--accent)', 'var(--warn)', 'var(--ok)', 'var(--violet)']
    return palette[index % palette.length]
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

async function loadScriptOnce(scriptUrl) {
    if (loadedScripts.has(scriptUrl)) return
    return new Promise(function (resolve, reject) {
        const s = document.createElement('script')
        s.src = scriptUrl
        s.onload = function () { loadedScripts.add(scriptUrl); resolve() }
        s.onerror = function () { reject(new Error('Falha ao carregar ' + scriptUrl)) }
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
        const user = window.Auth && window.Auth.getUser()
        if (!user || !user.is_admin) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    if (meta.financeiro) {
        const u = window.Auth && window.Auth.getUser()
        if (!u || (!u.is_financeiro && !u.is_admin)) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    if (meta.commission) {
        const u = window.Auth && window.Auth.getUser()
        if (!u || (!u.is_commission && !u.is_financeiro && !u.is_admin)) {
            window.location.hash = window.CONFIG.HASH(DEFAULT_ROUTE)
            return
        }
    }
    document.body.classList.toggle('auth-mode', route === LOGIN_ROUTE)

    updateBreadcrumb(meta)
    content.innerHTML = '<div class="view-loading">Carregando ' + escapeText(meta.title) + '…</div>'
    window.routeParams = params

    try {
        const htmlUrl = meta.appDir ? ('html/apps/' + meta.appDir + '/' + route + '.html') : window.CONFIG.VIEW_TEMPLATE(meta.folder, route)
        const jsUrl = meta.appDir ? ('js/apps/' + meta.appDir + '/' + route + '.js') : ('js/views/' + route + '.js')
        const html = await fetch(htmlUrl).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status)
            return r.text()
        })
        if (stale()) return
        const parsed = new DOMParser().parseFromString(html, 'text/html')
        const partial = parsed.querySelector('main')
        if (!partial) throw new Error('A página legada não tem <main>')
        content.innerHTML = partial.innerHTML

        await loadScriptOnce(jsUrl)
        if (stale()) return

        const initFnName = 'initView_' + route.replace(/-/g, '_')
        const initFn = window[initFnName]
        if (typeof initFn !== 'function') {
            throw new Error('JS desta view não expõe ' + initFnName + '().')
        }
        await initFn()
    } catch (error) {
        if (stale()) return
        content.innerHTML = '<div class="view-error">Falha ao carregar a view: ' + escapeText(error.message) + '</div>'
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





async function loadCatalogs() {
    if (!window.Auth || !window.Auth.isAuthenticated()) return
    try {
        const b = await window.API.get('/catalog/bootstrap')
        if (b) {
            if (b.steps) window.CONFIG.STEPS = b.steps
            if (b.status) window.CONFIG.STATUS = b.status
            if (b.processKinds) window.CONFIG.PROCESS_KINDS = b.processKinds
        }
    } catch (error) { }
    if (typeof window.buildConsultaTabs === 'function') window.buildConsultaTabs()
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
