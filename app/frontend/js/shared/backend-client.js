// backend-client.js — expõe window.SB com a MESMA interface de antes (select/rpc/userId),
// mas tudo via backend (POST /data/:resource, /rpc/:fn). Sem supabase-js no front.
// O builder (q => q.eq().ilike().order().limit()) é gravado como uma lista de ops
// e enviada ao backend, que reconstrói a query com o JWT do usuário (RLS vale).
(function () {
  // gravador que imita o query-builder do supabase-js (só o que o app usa).
  function Spec() { this.__ops = []; }
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is'].forEach(function (m) {
    Spec.prototype[m] = function (col, val) { this.__ops.push([m, col, val]); return this; };
  });
  Spec.prototype.in = function (col, arr) { this.__ops.push(['in', col, arr]); return this; };
  Spec.prototype.or = function (filter) { this.__ops.push(['or', filter]); return this; };
  Spec.prototype.order = function (col, opt) { this.__ops.push(['order', col, opt || {}]); return this; };
  Spec.prototype.limit = function (n) { this.__ops.push(['limit', n]); return this; };
  Spec.prototype.range = function (a, b) { this.__ops.push(['range', a, b]); return this; };

  var _userId = null; // cache do id do usuário logado (vem de /auth/me)

  window.SB = {
    setUserId: function (id) { _userId = id || null; },
    userId: async function () {
      if (_userId) return _userId;
      try { var me = await window.API.get('/auth/me'); _userId = me ? me.id : null; } catch (e) { _userId = null; }
      return _userId;
    },
    // select(resource, build): build recebe o Spec e encadeia as operações.
    select: async function (resource, build) {
      var spec = new Spec();
      if (build) build(spec);
      return window.API.post('/data/' + resource, { ops: spec.__ops });
    },
    // count(resource, build): META — devolve SÓ o total (count exato), sem trafegar
    // linhas (head:true). Chamado 1x por filtro; as páginas seguintes não recontam.
    count: async function (resource, build) {
      var spec = new Spec();
      if (build) build(spec);
      var res = await window.API.postFull('/data/' + resource, { ops: spec.__ops, count: true, head: true });
      return (res && res.count != null) ? res.count : 0;
    },
    rpc: function (fn, args) { return window.API.post('/rpc/' + fn, { args: args || {} }); },
    // upload de anexo (base64 -> backend -> storage). Retorna { url }.
    upload: function (file) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () {
          var b64 = String(fr.result).split(',')[1] || '';
          window.API.post('/storage/upload', { filename: file.name, contentBase64: b64, contentType: file.type })
            .then(resolve, reject);
        };
        fr.onerror = function () { reject(new Error('Falha ao ler o arquivo')); };
        fr.readAsDataURL(file);
      });
    },
  };
})();
