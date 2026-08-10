function initView_inicio() {
  var user = (window.Auth && window.Auth.getUser()) || {}
  var name = user.name || (user.email || '').split('@')[0] || '—'
  var nameEl = document.getElementById('home-user-name')
  var emailEl = document.getElementById('home-user-email')
  if (nameEl) nameEl.textContent = name
  if (emailEl) emailEl.textContent = user.email || ''
  loadQuoteOfTheDay()
}

function loadQuoteOfTheDay() {
  if (!window.SB || !window.SB.rpc) return
  window.SB.rpc('quote_of_the_day').then(function (rows) {
    var quote = Array.isArray(rows) ? rows[0] : rows
    if (!quote || !quote.text_qot) return
    var box = document.getElementById('home-quote')
    var textEl = document.getElementById('home-quote-text')
    var authorEl = document.getElementById('home-quote-author')
    if (textEl) textEl.textContent = '“' + quote.text_qot + '”'
    if (authorEl) authorEl.textContent = quote.author_qot ? '— ' + quote.author_qot : ''
    if (box) box.style.opacity = '1'
  }).catch(function () {})
}
