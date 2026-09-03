(function () {
  window.ClientPager = function (total, page, pageSize) {
    pageSize = pageSize || 50;
    total = total || 0;
    var pages = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(Math.max(0, page || 0), pages - 1);
    var from = total ? page * pageSize + 1 : 0;
    var to = Math.min(total, (page + 1) * pageSize);
    return {
      page: page,
      pages: pages,
      slice: function (arr) { return (arr || []).slice(page * pageSize, page * pageSize + pageSize); },
      html: function () {
        if (total <= pageSize) return '';
        return '<div class="cp-pager" style="display:flex;align-items:center;gap:10px;justify-content:flex-end;padding:12px 8px;flex-wrap:wrap">'
          + '<span style="color:var(--muted);font-size:13px">' + from + '–' + to + ' de ' + total + '</span>'
          + '<button type="button" class="btn btn-light" data-cp="prev"' + (page <= 0 ? ' disabled' : '') + '>‹ Anterior</button>'
          + '<button type="button" class="btn btn-light" data-cp="next"' + (page >= pages - 1 ? ' disabled' : '') + '>Próxima ›</button>'
          + '</div>';
      },
      wire: function (root, onGo) {
        if (!root) return;
        var prev = root.querySelector('[data-cp="prev"]'), next = root.querySelector('[data-cp="next"]');
        if (prev) prev.addEventListener('click', function () { onGo(page - 1); });
        if (next) next.addEventListener('click', function () { onGo(page + 1); });
      }
    };
  };
})();
