async function initView_trocar_senha() {
  var selectElement = function (id) { return document.getElementById(id); };
  var user = window.Auth && window.Auth.getUser();
  var status = selectElement('ts-status');

  if (user && user.must_change_password) {
    selectElement('ts-intro').textContent = 'Primeiro acesso: troque a senha temporária que você recebeu para ver os relatórios. Use pelo menos 8 caracteres.';
  }

  function problem() {
    var current = selectElement('ts-current').value;
    var next = selectElement('ts-new').value;
    if (next.length < 8) return 'A nova senha precisa ter pelo menos 8 caracteres.';
    if (next !== selectElement('ts-confirm').value) return 'As duas senhas novas não são iguais.';
    if (next === current) return 'A nova senha precisa ser diferente da atual.';
    return '';
  }

  selectElement('ts-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    var message = problem();
    status.style.color = 'var(--danger)';
    status.textContent = message;
    if (message) return;
    var button = selectElement('ts-save');
    button.disabled = true;
    status.style.color = 'var(--muted)';
    status.textContent = 'Salvando…';
    try {
      await window.API.post('/auth/password', {
        current_password: selectElement('ts-current').value,
        new_password: selectElement('ts-new').value,
      });
      selectElement('ts-form').reset();
      status.style.color = 'var(--ok)';
      status.textContent = 'Senha trocada.';
      await window.Auth.init();
      window.location.hash = window.CONFIG.HASH('relatorios');
    } catch (error) {
      status.style.color = 'var(--danger)';
      status.textContent = error.message || 'Não foi possível trocar a senha.';
    } finally {
      button.disabled = false;
    }
  });
}
