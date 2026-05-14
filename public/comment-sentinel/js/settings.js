const Settings = {
  _projects: [],
  _activeProjectId: null,

  async init() {
    document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());
    document.getElementById('btn-add-category').addEventListener('click', () => this.showAddCategory());
    document.getElementById('btn-add-keyword').addEventListener('click', () => this.addKeyword());
    document.getElementById('keyword-weight').addEventListener('input', (e) => this.updateWeightDisplay(e.target.value));
    document.getElementById('btn-reclassify-keyword').addEventListener('click', () => this.reclassify('keyword'));
    document.getElementById('btn-reclassify-ai').addEventListener('click', () => this.reclassify('ai'));
    document.getElementById('btn-delete-project').addEventListener('click', () => this.deleteProject());
    await this.loadProjects();
    await this.load();
  },

  async loadProjects() {
    try {
      const data = await API.get('/projects');
      this._projects = data.projects || [];
      this._activeProjectId = data.active;
      const sel = document.getElementById('project-select');
      sel.innerHTML = this._projects.map(p =>
        '<option value="' + p.id + '"' + (p.id === data.active ? ' selected' : '') + '>' + escapeHtml(p.name) + '</option>'
      ).join('');
      const delBtn = document.getElementById('btn-delete-proj');
      if (delBtn) delBtn.style.display = this._projects.length <= 1 ? 'none' : '';
      const active = this._projects.find(p => p.id === data.active);
      const sidebarLabel = document.getElementById('sidebar-project-name');
      if (sidebarLabel && active) sidebarLabel.textContent = active.name;
    } catch {}
  },

  async switchProject(id) {
    if (id === this._activeProjectId) return;
    try {
      await API.put('/projects/switch', { id });
      Toast.success('Switched project');
      this._activeProjectId = id;
      await this.load();
      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }
      if (typeof Training !== 'undefined') Training.load();
    } catch (err) { Toast.error(err.message); }
  },

  showCreateProject() {
    Modal.show(
      '<h3 class="text-lg font-bold text-white mb-6">New Project</h3>' +
      '<div class="form-group"><label class="label">Project Name</label>' +
      '<input id="modal-proj-name" class="input" placeholder="e.g., Campaign Analysis Q2"></div>' +
      '<p class="text-xs text-slate-500 mt-2">A fresh database will be created. Categories, keywords, training data, and settings start empty. API keys stay the same.</p>' +
      '<div class="flex gap-2 mt-6"><button class="btn-primary" onclick="Settings.createProject()">Create &amp; Switch</button>' +
      '<button class="btn-secondary" onclick="Modal.hide()">Cancel</button></div>'
    );
    setTimeout(() => { const el = document.getElementById('modal-proj-name'); if (el) el.focus(); }, 100);
  },

  async createProject() {
    const name = document.getElementById('modal-proj-name').value.trim();
    if (!name) return Toast.warning('Name is required');
    try {
      const { project } = await API.post('/projects', { name });
      Modal.hide();
      await API.put('/projects/switch', { id: project.id });
      Toast.success('Created & switched to "' + project.name + '"');
      this._activeProjectId = project.id;
      await this.loadProjects();
      await this.load();
      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }
      if (typeof Training !== 'undefined') Training.load();
    } catch (err) { Toast.error(err.message); }
  },

  showRenameProject() {
    const current = this._projects.find(p => p.id === this._activeProjectId);
    if (!current) return;
    Modal.show(
      '<h3 class="text-lg font-bold text-white mb-6">Rename Project</h3>' +
      '<div class="form-group"><label class="label">Project Name</label>' +
      '<input id="modal-proj-rename" class="input" value="' + escapeHtml(current.name) + '"></div>' +
      '<div class="flex gap-2 mt-6"><button class="btn-primary" onclick="Settings.renameProject()">Save</button>' +
      '<button class="btn-secondary" onclick="Modal.hide()">Cancel</button></div>'
    );
    setTimeout(() => { const el = document.getElementById('modal-proj-rename'); if (el) { el.focus(); el.select(); } }, 100);
  },

  async renameProject() {
    const name = document.getElementById('modal-proj-rename').value.trim();
    if (!name) return Toast.warning('Name is required');
    try {
      await API.put('/projects/' + this._activeProjectId, { name });
      Modal.hide();
      Toast.success('Project renamed');
      await this.loadProjects();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteCurrentProject() {
    if (this._projects.length <= 1) return Toast.warning('Cannot delete the only project');
    const current = this._projects.find(p => p.id === this._activeProjectId);
    if (!confirm('Delete project "' + current.name + '"? All its data (comments, categories, themes, training) will be permanently deleted.')) return;
    if (!confirm('This is irreversible. Are you sure?')) return;
    try {
      const { active } = await API.del('/projects/' + this._activeProjectId);
      Toast.success('Project deleted');
      this._activeProjectId = active.id;
      await this.loadProjects();
      await this.load();
      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }
      if (typeof Training !== 'undefined') Training.load();
    } catch (err) { Toast.error(err.message); }
  },

  async load() {
    try {
      const settings = await API.get('/settings');
      document.getElementById('setting-project-desc').value = settings.project_description || '';
      document.getElementById('setting-project-lang').value = settings.project_language || '';
    } catch {}
    await this.loadCategories();
    await this.loadKeywords();
  },

  async saveSettings() {
    try {
      await API.put('/settings', {
        project_description: document.getElementById('setting-project-desc').value,
        project_language: document.getElementById('setting-project-lang').value,
      });
      Toast.success('Settings saved');
      if (typeof Dashboard !== 'undefined') Dashboard.load();
    } catch (err) { Toast.error(err.message); }
  },

  async loadCategories() {
    try {
      const cats = await API.get('/categories');
      const el = document.getElementById('categories-list');
      if (!cats.length) { el.innerHTML = '<div class="text-center py-8"><svg class="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg><p class="text-slate-400 font-medium">No categories defined yet</p><p class="text-slate-500 text-sm mt-1">Add at least 2-3 categories (e.g., Positive, Negative, Neutral) to start classifying.</p></div>'; return; }
      el.innerHTML = cats.map(function(c) {
        var count = c.comment_count || 0;
        return '<div class="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.06] hover:border-white/[0.1] transition-all">' +
          '<div class="flex items-center gap-3">' +
            '<div class="w-4 h-4 rounded-full ring-2 ring-offset-2 ring-offset-surface-950" style="background:' + c.color + ';--tw-ring-color:' + c.color + '"></div>' +
            '<div>' +
              '<div class="text-sm font-semibold text-white">' + escapeHtml(c.name) + '</div>' +
              (c.description ? '<div class="text-xs text-slate-500 mt-0.5">' + escapeHtml(c.description) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="flex items-center gap-3">' +
            '<span class="badge bg-white/[0.04] text-slate-400 border border-white/[0.06] cursor-default" title="' + count + ' comment' + (count !== 1 ? 's' : '') + ' classified in this category">' +
              '<svg class="w-3 h-3 mr-1 opacity-50" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>' +
              count +
            '</span>' +
            '<button class="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10" onclick="Settings.deleteCategory(\'' + c.id + '\')">Delete</button>' +
          '</div>' +
        '</div>';
      }).join('');

      Settings.renderCategorySelect('keyword-category', cats);
    } catch {}
  },

  colorPalette: [
    '#ef4444','#f97316','#eab308','#22c55e','#14b8a6',
    '#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7',
    '#d946ef','#ec4899','#f43f5e','#6b7280','#78716c',
  ],
  selectedColor: '#8b5cf6',

  showAddCategory() {
    var self = this;
    self.selectedColor = '#8b5cf6';
    var swatches = self.colorPalette.map(function(c) {
      var sel = c === self.selectedColor;
      return '<button type="button" class="w-8 h-8 rounded-lg transition-all duration-150 ring-offset-2 ring-offset-surface-900 ' +
        (sel ? 'ring-2 ring-white scale-110' : 'hover:scale-110 hover:ring-2 hover:ring-white/30') +
        '" style="background:' + c + '" onclick="Settings.pickColor(\'' + c + '\')"></button>';
    }).join('');

    Modal.show(
      '<h3 class="text-lg font-bold text-white mb-6">Add Category</h3>' +
      '<div class="space-y-5">' +
      '<div class="form-group"><label class="label">Category Name</label><input id="modal-cat-name" class="input" placeholder="e.g., Positive, Negative, Neutral, Off-Topic"></div>' +
      '<div class="form-group"><label class="label">Color</label><p class="text-xs text-slate-500 mb-3">Pick a color for charts and badges</p>' +
        '<div id="modal-color-swatches" class="flex flex-wrap gap-2">' + swatches + '</div>' +
        '<div class="flex items-center gap-3 mt-3">' +
          '<div id="modal-color-preview" class="w-8 h-8 rounded-lg border-2 border-white/20" style="background:' + self.selectedColor + '"></div>' +
          '<input id="modal-cat-color" type="text" class="input w-28 font-mono text-xs" value="' + self.selectedColor + '" placeholder="#hex" onchange="Settings.pickColor(this.value)">' +
        '</div>' +
      '</div>' +
      '<div class="form-group"><label class="label">Description</label><p class="text-xs text-slate-500 mb-2">Help the AI understand when to use this category</p><input id="modal-cat-desc" class="input" placeholder="e.g., Comments expressing approval, satisfaction, or support..."></div>' +
      '</div>' +
      '<div class="flex gap-2 mt-6"><button class="btn-primary" onclick="Settings.addCategory()">Add Category</button><button class="btn-secondary" onclick="Modal.hide()">Cancel</button></div>'
    );
  },

  pickColor(color) {
    this.selectedColor = color;
    document.getElementById('modal-cat-color').value = color;
    var preview = document.getElementById('modal-color-preview');
    if (preview) preview.style.background = color;
    var self = this;
    var container = document.getElementById('modal-color-swatches');
    if (container) {
      container.querySelectorAll('button').forEach(function(btn) {
        var btnColor = btn.style.background;
        var isSelected = false;
        self.colorPalette.forEach(function(c) {
          if (c === color && btn.style.backgroundColor === self.hexToRgb(c)) isSelected = true;
        });
      });
      var swatches = self.colorPalette.map(function(c) {
        var sel = c === color;
        return '<button type="button" class="w-8 h-8 rounded-lg transition-all duration-150 ring-offset-2 ring-offset-surface-900 ' +
          (sel ? 'ring-2 ring-white scale-110' : 'hover:scale-110 hover:ring-2 hover:ring-white/30') +
          '" style="background:' + c + '" onclick="Settings.pickColor(\'' + c + '\')"></button>';
      }).join('');
      container.innerHTML = swatches;
    }
  },

  hexToRgb(hex) { return hex; },

  async addCategory() {
    const name = document.getElementById('modal-cat-name').value.trim();
    const color = document.getElementById('modal-cat-color').value;
    const description = document.getElementById('modal-cat-desc').value.trim();
    if (!name) return Toast.warning('Name is required');
    try {
      await API.post('/categories', { name, color, description });
      Toast.success('Category added');
      Modal.hide();
      await this.loadCategories();
      Training.loadCategories();
      Explorer.loadFilters();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteCategory(id) {
    if (!confirm('Delete this category? Comments will become unclassified.')) return;
    try {
      await API.del('/categories/' + id);
      Toast.success('Category deleted');
      await this.loadCategories();
      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }
    } catch (err) { Toast.error(err.message); }
  },

  weightColor(w) {
    if (w <= 0.5) return 'text-slate-400 bg-white/[0.03]';
    if (w <= 1.0) return 'text-brand-300 bg-brand-500/[0.08]';
    if (w <= 2.0) return 'text-amber-300 bg-amber-500/[0.08]';
    return 'text-red-300 bg-red-500/[0.08]';
  },

  async loadKeywords() {
    try {
      var cats = await API.get('/categories');
      var html = '';
      for (var cat of cats) {
        var kws = await API.get('/categories/' + cat.id + '/keywords');
        if (!kws.length) continue;
        html += '<div class="mb-4"><div class="flex items-center gap-2 mb-2"><div class="w-2.5 h-2.5 rounded-full" style="background:' + cat.color + '"></div><span class="text-xs font-semibold text-slate-300">' + escapeHtml(cat.name) + '</span><span class="text-[10px] text-slate-600">' + kws.length + ' keywords</span></div><div class="flex flex-wrap gap-1.5">' +
          kws.map(function(kw) { return '<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/[0.06] text-xs ' + Settings.weightColor(kw.weight) + '">' + escapeHtml(kw.keyword) + '<span class="font-bold opacity-60 tabular-nums">' + kw.weight + '</span><button class="text-red-400/50 hover:text-red-300 ml-0.5 text-sm leading-none" onclick="Settings.deleteKeyword(\'' + kw.id + '\')">&times;</button></span>'; }).join('') +
          '</div></div>';
      }
      var empty = '<div class="text-center py-6"><svg class="w-10 h-10 text-slate-700 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg><p class="text-slate-500 text-sm">No keywords defined yet. Add keywords above to enable rule-based classification.</p></div>';
      document.getElementById('keywords-list').innerHTML = html || empty;
    } catch {}
  },

  updateWeightDisplay(val) {
    val = parseFloat(val);
    var display = document.getElementById('keyword-weight-display');
    var hint = document.getElementById('keyword-weight-hint');
    display.textContent = val.toFixed(1);
    var levels = [
      { max: 0.5, color: 'text-slate-400', dot: 'bg-slate-400', name: 'Weak signal', desc: 'Ambiguous word that might appear in unrelated comments. Use for generic terms like "they" or "people".' },
      { max: 1.0, color: 'text-brand-400', dot: 'bg-brand-400', name: 'Normal match', desc: 'Standard keyword that reasonably indicates this category.' },
      { max: 2.0, color: 'text-amber-400', dot: 'bg-amber-400', name: 'Strong signal', desc: 'This word strongly indicates the category. Use for clear sentiment words like "excellent" or "terrible".' },
      { max: 3.0, color: 'text-red-400', dot: 'bg-red-400', name: 'Very strong signal', desc: 'Reserved for multi-word phrases or domain-specific terms that are almost always in this category.' },
    ];
    var level = levels.find(function(l) { return val <= l.max; }) || levels[levels.length - 1];
    display.className = 'text-lg font-bold tabular-nums ' + level.color;
    hint.innerHTML = '<div class="flex items-center gap-2 mb-1"><div class="w-2 h-2 rounded-full ' + level.dot + '"></div><span class="text-xs font-semibold text-slate-200">' + level.name + '</span></div><p class="text-xs text-slate-500">' + level.desc + '</p>';
  },

  renderCategorySelect(containerId, cats) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var currentVal = container.dataset.value;
    var defaultCat = cats.length ? cats[0] : null;
    var selected = cats.find(function(c) { return String(c.id) === currentVal; }) || defaultCat;

    container.innerHTML = '';
    container.dataset.value = selected ? selected.id : '';
    container.className = 'category-select';

    var trigger = document.createElement('div');
    trigger.className = 'cs-trigger';
    if (selected) {
      trigger.innerHTML = '<span class="cs-dot" style="background:' + selected.color + '"></span>' +
        '<span>' + escapeHtml(selected.name) + '</span>' +
        '<svg class="cs-arrow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>';
    } else {
      trigger.innerHTML = '<span class="cs-placeholder">Select category…</span>' +
        '<svg class="cs-arrow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>';
    }

    var dropdown = document.createElement('div');
    dropdown.className = 'cs-dropdown';
    cats.forEach(function(c) {
      var opt = document.createElement('div');
      opt.className = 'cs-option' + (selected && selected.id === c.id ? ' selected' : '');
      opt.innerHTML = '<span class="cs-dot" style="background:' + c.color + '"></span><span>' + escapeHtml(c.name) + '</span>';
      opt.addEventListener('click', function(e) {
        e.stopPropagation();
        container.dataset.value = c.id;
        trigger.innerHTML = '<span class="cs-dot" style="background:' + c.color + '"></span>' +
          '<span>' + escapeHtml(c.name) + '</span>' +
          '<svg class="cs-arrow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>';
        dropdown.querySelectorAll('.cs-option').forEach(function(o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        container.classList.remove('open');
      });
      dropdown.appendChild(opt);
    });

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      document.querySelectorAll('.category-select.open').forEach(function(el) {
        if (el !== container) el.classList.remove('open');
      });
      container.classList.toggle('open');
    });

    container.appendChild(trigger);
    container.appendChild(dropdown);

    if (!Settings._csGlobalClose) {
      Settings._csGlobalClose = true;
      document.addEventListener('click', function() {
        document.querySelectorAll('.category-select.open').forEach(function(el) { el.classList.remove('open'); });
      });
    }
  },

  async addKeyword() {
    var catId = document.getElementById('keyword-category').dataset.value || null;
    var keyword = document.getElementById('keyword-text').value.trim();
    var weight = parseFloat(document.getElementById('keyword-weight').value) || 1.0;
    if (!catId || !keyword) return Toast.warning('Select a category and enter a keyword');
    try {
      await API.post('/categories/keywords', { categoryId: catId, keyword, weight: Math.round(weight * 10) / 10 });
      document.getElementById('keyword-text').value = '';
      document.getElementById('keyword-weight').value = '1.0';
      this.updateWeightDisplay(1.0);
      Toast.success('Keyword added');
      await this.loadKeywords();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteKeyword(id) {
    try { await API.del('/categories/keywords/' + id); await this.loadKeywords(); }
    catch (err) { Toast.error(err.message); }
  },

  async deleteProject() {
    if (!confirm('Delete all scraped comments, import sources, and themes? Your categories, keywords, training data, and settings will be kept.')) return;
    if (!confirm('This is irreversible. Type-to-confirm: are you really sure?')) return;
    try {
      await API.del('/settings/project');
      Toast.success('Project deleted — all data wiped');
      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }
      await this.load();
    } catch (err) { Toast.error(err.message); }
  },

  async reclassify(method) {
    if (!confirm('Re-classify ALL comments using ' + method + '? This may take a while.')) return;
    try {
      Toast.info('Re-classifying...');
      if (method === 'ai') {
        const result = await API.post('/ai/reclassify-all');
        Toast.success('AI re-classified ' + (result.classified || 0) + ' comments');
      } else {
        Toast.info('Keyword reclassification running...');
        const result = await API.post('/ai/keyword-reclassify');
        Toast.success('Keyword re-classified ' + (result.classified || 0) + ' comments');
      }
      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }
    } catch (err) { Toast.error(err.message); }
  },
};
