(function () {
  
  function Spec() { this.__ops = []; }
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is'].forEach(function (m) {
    Spec.prototype[m] = function (col, val) { this.__ops.push([m, col, val]); return this; };
  });
  Spec.prototype.in = function (col, arr) { this.__ops.push(['in', col, arr]); return this; };
  Spec.prototype.or = function (filter) { this.__ops.push(['or', filter]); return this; };
  Spec.prototype.order = function (col, opt) { this.__ops.push(['order', col, opt || {}]); return this; };
  Spec.prototype.limit = function (n) { this.__ops.push(['limit', n]); return this; };
  Spec.prototype.range = function (a, b) { this.__ops.push(['range', a, b]); return this; };

  var _userId = null; 

  window.SB = {
    setUserId: function (id) { _userId = id || null; },
    userId: async function () {
      if (_userId) return _userId;
      try { var me = await window.API.get('/auth/me'); _userId = me ? me.id : null; } catch (e) { _userId = null; }
      return _userId;
    },
    
    select: async function (resource, build) {
      var spec = new Spec();
      if (build) build(spec);
      return window.API.post('/data/' + resource, { ops: spec.__ops });
    },

    count: async function (resource, build) {
      var spec = new Spec();
      if (build) build(spec);
      var res = await window.API.postFull('/data/' + resource, { ops: spec.__ops, count: true, head: true });
      return (res && res.count != null) ? res.count : 0;
    },
    rpc: function (fn, args) { return window.API.post('/rpc/' + fn, { args: args || {} }); },
    
    // endpoint opcional: '/storage/upload' (padrão, anexos) ou '/storage/bulk-import' (xlsx do lote)
    upload: function (file, endpoint) {
      return new Promise(function (resolve, reject) {
        // teto único de tamanho (todos os uploads passam por aqui): 14 MB.
        var MAX_FILE_BYTES = 14 * 1024 * 1024;
        if (file && file.size > MAX_FILE_BYTES) {
          reject(new Error('Arquivo excede o limite de 14 MB.')); return;
        }
        var fr = new FileReader();
        fr.onload = function () {
          var b64 = String(fr.result).split(',')[1] || '';
          window.API.post(endpoint || '/storage/upload', { filename: file.name, contentBase64: b64, contentType: file.type })
            .then(resolve, reject);
        };
        fr.onerror = function () { reject(new Error('Falha ao ler o arquivo')); };
        fr.readAsDataURL(file);
      });
    },
  };
})();
