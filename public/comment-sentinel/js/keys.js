const Keys = {
  models: [],
  currentModel: '',

  async init() {
    document.getElementById('btn-save-keys').addEventListener('click', () => this.save());
    await this.load();
  },

  async load() {
    try {
      var data = await API.get('/keys');
      this.models = data.models || [];
      this.currentModel = data.openai_model || 'gpt-4o-mini';

      this.renderModelCards();
      this.renderKeyDisplay('openai', data.openai_api_key, data.openai_api_key_set);
      this.renderKeyDisplay('scrapecreators', data.scrape_creators_api_key, data.scrape_creators_api_key_set);
      this.renderKeyDisplay('apify', data.apify_api_token, data.apify_api_token_set);

      this.setStatus('openai', data.openai_api_key_set);
      this.setStatus('scrapecreators', data.scrape_creators_api_key_set);
      this.setStatus('apify', data.apify_api_token_set);
    } catch (err) {
      Toast.error('Failed to load keys: ' + err.message);
    }
  },

  renderKeyDisplay(service, masked, isSet) {
    var displayEl = document.getElementById('key-display-' + service);
    var editEl = document.getElementById('key-edit-' + service);

    if (isSet) {
      displayEl.innerHTML =
        '<svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>' +
        '<code class="text-sm text-slate-300 font-mono tracking-wider flex-1">' + escapeHtml(masked) + '</code>' +
        '<button class="btn-ghost text-xs" onclick="Keys.toggleEdit(\'' + service + '\')">Change</button>';
    } else {
      displayEl.innerHTML =
        '<svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' +
        '<span class="text-sm text-slate-500 italic flex-1">No key configured</span>' +
        '<button class="btn-ghost text-xs text-brand-400" onclick="Keys.toggleEdit(\'' + service + '\')">Add key</button>';
    }

    editEl.classList.add('hidden');
    document.getElementById('key-' + service).value = '';
  },

  toggleEdit(service) {
    var editEl = document.getElementById('key-edit-' + service);
    var isHidden = editEl.classList.contains('hidden');
    editEl.classList.toggle('hidden');
    if (isHidden) {
      document.getElementById('key-' + service).focus();
    }
  },

  renderModelCards() {
    var el = document.getElementById('key-openai-models');
    var self = this;
    el.innerHTML = this.models.map(function(m) {
      var selected = m.id === self.currentModel;
      var dots = function(n, max) {
        var filled = '';
        for (var i = 0; i < max; i++) {
          filled += '<div class="w-1.5 h-1.5 rounded-full ' + (i < n ? 'bg-current' : 'bg-white/[0.08]') + '"></div>';
        }
        return filled;
      };
      var priceColor = m.input <= 0.20 ? 'text-emerald-400' : m.input <= 1.0 ? 'text-brand-300' : 'text-amber-400';

      return '<div class="relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ' +
        (selected ? 'border-brand-500/50 bg-brand-500/[0.06]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]') +
        '" data-model="' + m.id + '" onclick="Keys.selectModel(\'' + m.id + '\')">' +
        (selected ? '<div class="absolute top-3 right-3"><svg class="w-5 h-5 text-brand-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></div>' : '') +
        '<div class="flex items-center gap-2 mb-2">' +
          '<span class="text-sm font-bold text-white">' + m.label + '</span>' +
        '</div>' +
        '<p class="text-xs text-slate-500 mb-3 leading-relaxed">' + m.desc + '</p>' +
        '<div class="grid grid-cols-3 gap-3">' +
          '<div>' +
            '<div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Intelligence</div>' +
            '<div class="flex gap-0.5 text-brand-400">' + dots(m.intelligence, 5) + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Speed</div>' +
            '<div class="flex gap-0.5 text-emerald-400">' + dots(m.speed, 5) + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Cost</div>' +
            '<div class="text-xs font-semibold tabular-nums ' + priceColor + '">$' + m.input.toFixed(2) + '<span class="text-slate-600 font-normal"> / </span>$' + m.output.toFixed(2) + '</div>' +
            '<div class="text-[9px] text-slate-600">in / out per 1M</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  },

  selectModel(modelId) {
    this.currentModel = modelId;
    this.renderModelCards();
  },

  setStatus(service, configured) {
    var el = document.getElementById('key-status-' + service);
    if (configured) {
      el.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Active</span>';
    } else {
      el.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Missing</span>';
    }
  },

  async save() {
    var payload = {};
    var openaiKey = document.getElementById('key-openai').value.trim();
    var scKey = document.getElementById('key-scrapecreators').value.trim();
    var apifyKey = document.getElementById('key-apify').value.trim();

    if (openaiKey) payload.openai_api_key = openaiKey;
    payload.openai_model = this.currentModel;
    if (scKey) payload.scrape_creators_api_key = scKey;
    if (apifyKey) payload.apify_api_token = apifyKey;

    try {
      await API.put('/keys', payload);
      Toast.success('Keys saved and applied');
      await this.load();
      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') Explorer.loadFilters();
    } catch (err) {
      Toast.error('Failed to save: ' + err.message);
    }
  },
};
