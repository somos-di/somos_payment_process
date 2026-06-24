window.initView_login = async function initView_login() {
    const form = document.getElementById('login-form')
    const emailEl = document.getElementById('login-email')
    const pwdEl = document.getElementById('login-password')
    const errEl = document.getElementById('login-error')
    const btn = document.getElementById('login-submit')
    const HOME = window.CONFIG.HASH(window.CONFIG.ROUTES.DEFAULT)

    if (window.Auth && window.Auth.isAuthenticated()) {
        window.location.hash = HOME
        return
    }

    form.addEventListener('submit', async function (ev) {
        ev.preventDefault()
        errEl.textContent = ''
        btn.disabled = true
        try {
            await window.Auth.signIn(emailEl.value.trim(), pwdEl.value)
            window.location.hash = HOME
        } catch (err) {
            errEl.textContent = err && err.message ? err.message : 'Falha ao entrar'
            btn.disabled = false
        }
    })

    emailEl.focus()
}
