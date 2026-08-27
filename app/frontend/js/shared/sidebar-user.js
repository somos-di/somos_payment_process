(function () {
    function reflectAdmin(user) {
        const show = (user && user.is_admin) ? '' : 'none'
        document.querySelectorAll('.menu-group[data-group="admin"], .menu-group[data-group="integracao"]')
            .forEach(function (item) { item.style.display = show })
        const finShow = (user && (user.is_financeiro || user.is_admin)) ? '' : 'none'
        document.querySelectorAll('[data-fin-only]').forEach(function (item) { item.style.display = finShow })
        const commShow = (user && (user.is_commission || user.is_financeiro || user.is_admin)) ? '' : 'none'
        document.querySelectorAll('.menu-group[data-group="comissoes"]').forEach(function (item) { item.style.display = commShow })
        const medShow = (user && (user.is_medicao || user.is_admin)) ? '' : 'none'
        document.querySelectorAll('.menu-group[data-group="medicao"]').forEach(function (item) { item.style.display = medShow })
        const admOnly = (user && user.is_admin) ? '' : 'none'
        document.querySelectorAll('[data-admin-only]').forEach(function (item) { item.style.display = admOnly })
    }

    function reflectUser(user) {
        reflectAdmin(user)
        const nameEl = document.getElementById('user-name')
        const emailEl = document.getElementById('user-email')
        const avatarEl = document.getElementById('user-avatar')
        if (user) {
            const handle = (user.name || (user.email || '').split('@')[0]) || '-'
            if (nameEl) nameEl.textContent = handle
            if (emailEl) emailEl.textContent = user.email || ''
            if (avatarEl) avatarEl.textContent = (handle[0] || '·').toUpperCase()
        } else {
            if (nameEl) nameEl.textContent = '-'
            if (emailEl) emailEl.textContent = ''
            if (avatarEl) avatarEl.textContent = '·'
        }
    }

    function setupLogout() {
        const button = document.getElementById('logout-btn')
        if (button) {
            button.addEventListener('click', function () {
                if (window.Auth) window.Auth.signOut()
            })
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        setupLogout()
        if (!window.Auth) return
        reflectUser(window.Auth.getUser())
        window.Auth.onChange(reflectUser)
    })
})()
