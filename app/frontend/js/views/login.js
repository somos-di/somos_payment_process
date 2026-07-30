window.initView_login = async function initView_login() {
    const form = document.getElementById('login-form')
    const emailEl = document.getElementById('login-email')
    const pwdEl = document.getElementById('login-password')
    const errEl = document.getElementById('login-error')
    const button = document.getElementById('login-submit')
    const HOME = window.CONFIG.HASH(window.CONFIG.ROUTES.DEFAULT)

    if (window.Auth && window.Auth.isAuthenticated()) {
        window.location.hash = HOME
        return
    }


    var params = window.routeParams
    if (params && typeof params.get === 'function' && params.get('error') === 'oauth') {
        errEl.textContent = 'Falha no login com Microsoft. Tente novamente.'
    }


    var msBtn = document.getElementById('login-ms')
    if (msBtn) {
        msBtn.addEventListener('click', function () {
            window.location.href = window.CONFIG.API_BASE + '/auth/oauth/microsoft'
        })
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault()
        errEl.textContent = ''
        button.disabled = true
        try {
            await window.Auth.signIn(emailEl.value.trim(), pwdEl.value)
            window.location.hash = HOME
        } catch (error) {
            errEl.textContent = error && error.message ? error.message : 'Falha ao entrar'
            button.disabled = false
        }
    })

    emailEl.focus()
}
