(function () {
    function reflectAdmin(user) {
        // mostra o grupo "Administração" só pra admin (cosmético; o backend é o gate)
        const grp = document.querySelector('.menu-group[data-group="admin"]')
        if (grp) grp.style.display = (user && user.is_admin) ? '' : 'none'
    }

    function reflectUser(user) {
        reflectAdmin(user)
        const nameEl = document.getElementById('user-name')
        const emailEl = document.getElementById('user-email')
        const avatarEl = document.getElementById('user-avatar')
        if (user) {
            const handle = (user.name || (user.email || '').split('@')[0]) || '—'
            if (nameEl) nameEl.textContent = handle
            if (emailEl) emailEl.textContent = user.email || ''
            if (avatarEl) avatarEl.textContent = (handle[0] || '·').toUpperCase()
        } else {
            if (nameEl) nameEl.textContent = '—'
            if (emailEl) emailEl.textContent = ''
            if (avatarEl) avatarEl.textContent = '·'
        }
    }

    function setupLogout() {
        const btn = document.getElementById('logout-btn')
        if (btn) {
            btn.addEventListener('click', function () {
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
