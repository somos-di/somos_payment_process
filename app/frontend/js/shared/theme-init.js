(function () {
  function stored() {
    try { return localStorage.getItem('theme'); } catch (error) { return null; }
  }
  function apply(value) {
    document.documentElement.setAttribute('data-theme', value === 'light' ? 'light' : 'black');
  }

  apply(stored());

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('theme-toggle');
    if (!button) return;
    button.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'black' ? 'light' : 'black';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (error) { }
    });
  });
})();
