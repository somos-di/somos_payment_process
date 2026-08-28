(function () {

  function Spec() { this.__ops = []; }
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is'].forEach(function (item) {
    Spec.prototype[item] = function (column, value) { this.__ops.push([item, column, value]); return this; };
  });
  Spec.prototype.in = function (column, items) { this.__ops.push(['in', column, items]); return this; };
  Spec.prototype.or = function (filter) { this.__ops.push(['or', filter]); return this; };
  Spec.prototype.order = function (column, orderOptions) { this.__ops.push(['order', column, orderOptions || {}]); return this; };
  Spec.prototype.limit = function (count) { this.__ops.push(['limit', count]); return this; };
  Spec.prototype.range = function (fromIndex, toIndex) { this.__ops.push(['range', fromIndex, toIndex]); return this; };

  var _userId = null;

  window.SB = {
    setUserId: function (id) { _userId = id || null; },
    userId: async function () {
      if (_userId) return _userId;
      try { var currentUser = await window.API.get('/auth/me'); _userId = currentUser ? currentUser.id : null; } catch (error) { _userId = null; }
      return _userId;
    },

    select: async function (resource, build) {
      var spec = new Spec();
      if (build) build(spec);
      return window.API.post('/data/' + resource, { operations: spec.__ops });
    },

    count: async function (resource, build) {
      var spec = new Spec();
      if (build) build(spec);
      var response = await window.API.postFull('/data/' + resource, { operations: spec.__ops, count: true, head: true });
      return (response && response.count != null) ? response.count : 0;
    },

    page: async function (resource, build, countMode) {
      var spec = new Spec();
      if (build) build(spec);
      var body = { operations: spec.__ops };
      if (countMode) body.count = countMode;
      var response = await window.API.postFull('/data/' + resource, body);
      return {
        data: (response && response.data) || [],
        count: (response && response.count != null) ? response.count : null,
      };
    },
    rpc: function (fn, args) { return window.API.post('/rpc/' + fn, { rpcArguments: args || {} }); },

    upload: function (file, endpoint) {
      return new Promise(function (resolve, reject) {
        var MAX_FILE_BYTES = 20 * 1024 * 1024;
        if (file && file.size > MAX_FILE_BYTES) {
          reject(new Error('Arquivo excede o limite de 14 MB.')); return;
        }
        var fileReader = new FileReader();
        fileReader.onload = function () {
          var base64 = String(fileReader.result).split(',')[1] || '';
          window.API.post(endpoint || '/storage/upload', { filename: file.name, contentBase64: base64, contentType: file.type })
            .then(resolve, reject);
        };
        fileReader.onerror = function () { reject(new Error('Falha ao ler o arquivo')); };
        fileReader.readAsDataURL(file);
      });
    },
  };
})();
