(function () {
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  var STYLE_ID = 'coltools-style';
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style'); st.id = STYLE_ID;
    st.textContent =
      '@media (min-width:821px){.ct-fixed{table-layout:fixed}'
      + '.table-scroll table.ct-fixed{min-width:0}'
      + '.ct-fixed th,.ct-fixed td{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.ct-fixed th.ct-keep,.ct-fixed td.ct-keep{overflow:visible}}'
      + '.ct-fixed th{position:relative;text-align:center}'
      + '.ct-resizer{position:absolute;top:0;right:-4px;width:9px;height:100%;cursor:col-resize;user-select:none;z-index:2}'
      + '.ct-resizer.edge-left{left:0;right:auto}'
      + '.ct-resizer::before{content:"";position:absolute;left:3px;top:0;bottom:0;width:2px;background:transparent}'
      + '.ct-resizer:hover::before,.ct-resizer.dragging::before{background:var(--accent)}'
      + '.ct-cols{position:relative}'
      + '.ct-cols-menu{position:absolute;z-index:60;top:calc(100% + 4px);right:0;min-width:190px;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-md);padding:6px;display:none;max-height:320px;overflow:auto}'
      + '.ct-cols-menu.open{display:block}'
      + '.ct-cols-opt{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:13px;cursor:pointer;white-space:nowrap}'
      + '.ct-cols-opt:hover{background:var(--surface-2)}'
      + '.ct-cols-opt input{width:15px;height:15px;flex:none}';
    document.head.appendChild(st);
  }

  window.ColumnTools = {
    // opts: { storageKey, columns:[{col,label,width,type,render}], onChange }
    create: function (opts) {
      ensureStyle();
      var columns = opts.columns || [];
      var storageKey = 'cols:' + (opts.storageKey || 'view');
      var state = { hidden: {}, widths: {} };
      try { var saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); if (saved) { state.hidden = saved.hidden || {}; state.widths = saved.widths || {}; } } catch (error) { }
      function save() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (error) { } }
      function visible() { return columns.filter(function (c) { return !state.hidden[c.col]; }); }
      function widthOf(c) { return state.widths[c.col] || c.width || 120; }

      return {
        visible: visible,
        typeOf: function (col) { for (var i = 0; i < columns.length; i++) if (columns[i].col === col) return columns[i].type || 'text'; return 'text'; },

        tableWidth: function (leadCols, trailCols) {
          var sum = visible().reduce(function (a, c) { return a + widthOf(c); }, 0);
          (leadCols || []).forEach(function (w) { sum += w; });
          (trailCols || []).forEach(function (w) { sum += w; });
          return sum;
        },
        colgroup: function (leadCols, trailCols) {
          return (leadCols || []).map(function (w) { return '<col style="width:' + w + 'px">'; }).join('')
            + visible().map(function (c) { return '<col style="width:' + widthOf(c) + 'px">'; }).join('')
            + (trailCols || []).map(function (w) { return '<col style="width:' + w + 'px">'; }).join('');
        },
        head: function (sortIndicator) {
          return visible().map(function (c, i) {
            var ind = sortIndicator ? (' ' + sortIndicator(c.col)) : '';
            return '<th data-col="' + escapeHtml(c.col) + '">'
              + (i === 0 ? '<span class="ct-resizer edge-left" data-col="' + escapeHtml(c.col) + '" data-edge="left"></span>' : '')
              + escapeHtml(c.label) + ind
              + '<span class="ct-resizer" data-col="' + escapeHtml(c.col) + '"></span></th>';
          }).join('');
        },
        cells: function (entry) {
          return visible().map(function (c) {
            var raw = entry[c.col];
            var value = c.render ? c.render(entry) : ((raw == null || raw === '') ? '<span style="color:var(--muted)">-</span>' : escapeHtml(raw));
            var title = c.render ? '' : ' title="' + escapeHtml(raw == null ? '' : raw) + '"';
            return '<td data-label="' + escapeHtml(c.label) + '"' + title + '>' + value + '</td>';
          }).join('');
        },

        wireResize: function (tableEl, leadCount) {
          if (!tableEl) return;
          var vcols = visible();
          leadCount = leadCount || 0;
          function colElAt(vi) { return tableEl.querySelectorAll('colgroup col')[leadCount + vi]; }
          function applyColWidth(colEl, colName, newW) {
            var oldW = parseInt(colEl.style.width, 10) || 120;
            var tW = parseInt(tableEl.style.width, 10) || Math.round(tableEl.getBoundingClientRect().width);
            colEl.style.width = newW + 'px';
            tableEl.style.width = (tW + (newW - oldW)) + 'px';
            state.widths[colName] = newW; save();
          }
          tableEl.querySelectorAll('.ct-resizer').forEach(function (rz) {
            var colName = rz.getAttribute('data-col'), vi = -1;
            for (var k = 0; k < vcols.length; k++) { if (vcols[k].col === colName) { vi = k; break; } }
            if (vi < 0) return;

            rz.addEventListener('mousedown', function (event) {
              event.preventDefault(); event.stopPropagation();
              var colEl = colElAt(vi); if (!colEl) return;
              var edge = rz.getAttribute('data-edge');
              var nextCol = (edge !== 'left') ? (vcols[vi + 1] || null) : null;
              var nextColEl = nextCol ? colElAt(vi + 1) : null;
              var nextName = nextCol ? nextCol.col : null;
              var startX = event.clientX;
              var startW = parseInt(colEl.style.width, 10) || 120;
              var startNextW = nextColEl ? (parseInt(nextColEl.style.width, 10) || 120) : 0;
              var startTableW = parseInt(tableEl.style.width, 10) || Math.round(tableEl.getBoundingClientRect().width);
              rz.classList.add('dragging');
              document.body.style.userSelect = 'none';
              document.body.style.cursor = 'col-resize';
              function onMove(e) {
                var delta = e.clientX - startX;
                if (edge === 'left') {
                  var lw = Math.max(56, startW - delta);
                  colEl.style.width = lw + 'px';
                  tableEl.style.width = (startTableW + (lw - startW)) + 'px';
                } else if (nextColEl) {
                  if (delta < 56 - startW) delta = 56 - startW;
                  if (delta > startNextW - 56) delta = startNextW - 56;
                  colEl.style.width = (startW + delta) + 'px';
                  nextColEl.style.width = (startNextW - delta) + 'px';
                } else {
                  var newW = Math.max(56, startW + delta);
                  colEl.style.width = newW + 'px';
                  tableEl.style.width = (startTableW + (newW - startW)) + 'px';
                }
              }
              function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                rz.classList.remove('dragging');
                document.body.style.userSelect = '';
                document.body.style.cursor = '';
                state.widths[colName] = parseInt(colEl.style.width, 10) || startW;
                if (nextColEl && nextName) state.widths[nextName] = parseInt(nextColEl.style.width, 10) || startNextW;
                save();
              }
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            });

            rz.addEventListener('dblclick', function (event) {
              event.preventDefault(); event.stopPropagation();
              var colEl = colElAt(vi); if (!colEl) return;
              var cellIndex = leadCount + vi;
              var sampleTd = tableEl.querySelector('tbody tr td:nth-child(' + (cellIndex + 1) + ')');
              var meas = document.createElement('span');
              meas.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;top:-9999px;left:-9999px';
              if (sampleTd) { var cs = getComputedStyle(sampleTd); meas.style.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; }
              document.body.appendChild(meas);
              var maxW = 40, th = tableEl.querySelectorAll('thead th')[cellIndex];
              if (th) { meas.textContent = th.textContent || ''; maxW = Math.max(maxW, meas.offsetWidth + 22); }
              tableEl.querySelectorAll('tbody tr').forEach(function (tr) {
                var td = tr.children[cellIndex];
                if (td) { meas.textContent = td.textContent || ''; if (meas.offsetWidth > maxW) maxW = meas.offsetWidth; }
              });
              meas.remove();
              applyColWidth(colEl, colName, Math.max(56, Math.min(680, maxW + 28)));
            });
          });
        },

        menuButton: function () {
          return '<div class="ct-cols"><button type="button" class="btn btn-light" data-cols-btn title="Mostrar, ocultar e redimensionar colunas">Colunas</button><div class="ct-cols-menu" data-cols-menu></div></div>';
        },
        wireMenu: function (rootEl) {
          var wrap = rootEl.querySelector('.ct-cols');
          var btn = rootEl.querySelector('[data-cols-btn]'), menu = rootEl.querySelector('[data-cols-menu]');
          if (!btn || !menu) return;
          function build() {
            menu.innerHTML = columns.map(function (c) {
              return '<label class="ct-cols-opt"><input type="checkbox" data-c="' + escapeHtml(c.col) + '"' + (state.hidden[c.col] ? '' : ' checked') + '> ' + escapeHtml(c.label) + '</label>';
            }).join('');
            menu.querySelectorAll('input[data-c]').forEach(function (cb) {
              cb.addEventListener('change', function () {
                var col = cb.getAttribute('data-c');
                if (!cb.checked && visible().length <= 1) { cb.checked = true; return; }
                if (cb.checked) delete state.hidden[col]; else state.hidden[col] = true;
                save(); if (opts.onChange) opts.onChange();
              });
            });
          }
          btn.addEventListener('click', function (event) { event.stopPropagation(); build(); menu.classList.toggle('open'); });
          document.addEventListener('click', function (event) { if (wrap && !wrap.contains(event.target)) menu.classList.remove('open'); });
        },
      };
    },
  };
})();
