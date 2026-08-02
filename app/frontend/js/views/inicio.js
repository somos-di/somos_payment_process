function initView_inicio() {
  var user = (window.Auth && window.Auth.getUser()) || {}
  var name = user.name || (user.email || '').split('@')[0] || '—'
  var nameEl = document.getElementById('home-user-name')
  var emailEl = document.getElementById('home-user-email')
  if (nameEl) nameEl.textContent = name
  if (emailEl) emailEl.textContent = user.email || ''
}
