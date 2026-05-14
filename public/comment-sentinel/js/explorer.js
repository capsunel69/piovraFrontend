let explorerPage = 1;

const Explorer = {
  async init() {
    document.getElementById('explorer-search').addEventListener('input', debounce(() => { explorerPage = 1; this.load(); }, 400));
    document.getElementById('explorer-category').addEventListener('change', () => { explorerPage = 1; this.load(); });
    document.getElementById('explorer-source').addEventListener('change', () => { explorerPage = 1; this.load(); });
    document.getElementById('explorer-platform').addEventListener('change', () => { explorerPage = 1; this.load(); });
    document.getElementById('explorer-classified').addEventListener('change', () => { explorerPage = 1; this.load(); });
    document.getElementById('btn-classify-all').addEventListener('click', () => this.showClassifyModal('keyword'));
    document.getElementById('btn-ai-classify-all').addEventListener('click', () => this.showClassifyModal('ai'));
    await this.loadFilters();
    await this.load();
  },

  async loadFilters() {
    try {
      const cats = await API.get('/categories');
      const catSelect = document.getElementById('explorer-category');
      catSelect.innerHTML = '<option value="">All Categories</option>' + cats.map(c => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('');

      const sources = await API.get('/import/history');
      const srcSelect = document.getElementById('explorer-source');
      srcSelect.innerHTML = '<option value="">All Sources</option>' + sources.map(s => '<option value="' + s.id + '">' + escapeHtml(s.filename) + '</option>').join('');
    } catch {}
  },

  async load() {
    try {
      const params = new URLSearchParams({
        page: explorerPage,
        limit: 50,
      });
      const search = document.getElementById('explorer-search').value;
      const catId = document.getElementById('explorer-category').value;
      const srcId = document.getElementById('explorer-source').value;
      const platform = document.getElementById('explorer-platform').value;
      const classified = document.getElementById('explorer-classified').value;
      if (search) params.set('search', search);
      if (catId) params.set('categoryId', catId);
      if (srcId) params.set('sourceId', srcId);
      if (platform) params.set('platform', platform);
      if (classified) params.set('classifiedBy', classified);

      const data = await API.get('/comments?' + params.toString());
      this.renderTable(data);
      this.renderPagination(data);
    } catch (err) { Toast.error('Failed to load comments: ' + err.message); }
  },

  renderTable(data) {
    const el = document.getElementById('explorer-table');
    if (!data.rows || data.rows.length === 0) { el.innerHTML = '<p class="text-slate-500 text-sm p-4">No comments found.</p>'; return; }
    el.innerHTML = '<table><thead><tr><th class="w-[140px]">Author</th><th>Comment</th><th class="w-[120px]">Category</th><th class="w-[100px]">Confidence</th><th class="w-[50px]">Platform</th><th class="w-[110px]">Actions</th></tr></thead><tbody>' +
      data.rows.map(r => {
        var classifiedIcon = r.classified_by === 'ai'
          ? '<span class="text-[9px] text-brand-400 bg-brand-500/10 px-1 py-0.5 rounded" title="Classified by AI">AI</span>'
          : r.classified_by === 'auto'
          ? '<span class="text-[9px] text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded" title="Classified by keywords">KW</span>'
          : r.classified_by === 'manual'
          ? '<span class="text-[9px] text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded" title="Manually classified">M</span>'
          : '';
        return '<tr>' +
          '<td><div class="flex items-center gap-2">' + platformIcon(r.platform) + '<span class="text-white text-xs font-medium truncate">' + escapeHtml(truncate(r.author_name, 20)) + '</span></div></td>' +
          '<td class="max-w-md"><p class="text-sm text-slate-300 leading-relaxed line-clamp-2">' + escapeHtml(truncate(r.comment_text, 200)) + '</p></td>' +
          '<td><div class="flex items-center gap-1.5">' + categoryBadge(r.category_name, r.category_color) + classifiedIcon + '</div></td>' +
          '<td>' + confidenceBar(r.confidence) + '</td>' +
          '<td class="text-center"><span class="text-[10px] text-slate-500 capitalize">' + (r.platform || '') + '</span></td>' +
          '<td><div class="flex gap-1.5"><button class="text-xs text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg hover:bg-brand-500/10 transition-colors" onclick="Explorer.showDetail(' + r.id + ')">View</button><button class="text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded-lg hover:bg-amber-500/10 transition-colors" onclick="Explorer.trainFromComment(' + r.id + ')">Train</button></div></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  },

  renderPagination(data) {
    const el = document.getElementById('explorer-pagination');
    el.innerHTML = '<span class="text-sm text-slate-400">Page ' + data.page + ' of ' + data.totalPages + ' (' + data.total + ' comments)</span>' +
      '<div class="flex gap-2">' +
      '<button class="btn-secondary" ' + (data.page <= 1 ? 'disabled' : '') + ' onclick="explorerPage--; Explorer.load()">Prev</button>' +
      '<button class="btn-secondary" ' + (data.page >= data.totalPages ? 'disabled' : '') + ' onclick="explorerPage++; Explorer.load()">Next</button>' +
      '</div>';
  },

  async showDetail(id) {
    try {
      const c = await API.get('/comments/' + id);
      Modal.show(
        '<h3 class="text-lg font-bold text-white mb-5">Comment Detail</h3>' +
        '<div class="space-y-4">' +
        '<div class="flex items-center gap-3"><span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Author</span><span class="text-sm text-white">' + escapeHtml(c.author_name) + '</span></div>' +
        '<div class="flex items-center gap-3"><span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Platform</span><div class="flex items-center gap-1.5">' + platformIcon(c.platform) + '<span class="text-sm text-white capitalize">' + (c.platform || '') + '</span></div></div>' +
        '<div><span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Comment</span><p class="text-slate-200 mt-2 text-sm bg-white/[0.03] p-4 rounded-xl border border-white/[0.06] leading-relaxed">' + escapeHtml(c.comment_text) + '</p></div>' +
        '<div class="flex items-center gap-3"><span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Category</span>' + categoryBadge(c.category_name, c.category_color) + confidenceBar(c.confidence) + '</div>' +
        (c.ai_reasoning ? '<div><span class="text-xs font-medium text-slate-500 uppercase tracking-wider">AI Reasoning</span><p class="text-slate-400 text-sm mt-1 leading-relaxed">' + escapeHtml(c.ai_reasoning) + '</p></div>' : '') +
        (c.post_context ? '<div><span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Context</span><p class="text-slate-400 text-sm mt-1">' + escapeHtml(truncate(c.post_context, 300)) + '</p></div>' : '') +
        '</div>' +
        '<div class="flex gap-2 mt-6"><button class="btn-secondary" onclick="Modal.hide()">Close</button><button class="btn-primary" onclick="Explorer.reclassifySingle(' + c.id + ')">Re-classify (AI)</button></div>'
      );
    } catch (err) { Toast.error(err.message); }
  },

  async trainFromComment(id) {
    try {
      const c = await API.get('/comments/' + id);
      document.querySelector('[data-page="training"]').click();
      setTimeout(() => {
        document.getElementById('training-comment').value = c.comment_text || '';
        document.getElementById('training-context').value = c.post_context || '';
      }, 100);
    } catch (err) { Toast.error(err.message); }
  },

  async reclassifySingle(id) {
    try {
      Modal.hide();
      Toast.info('Re-classifying with AI...');
      await API.post('/ai/classify/' + id);
      Toast.success('Comment re-classified');
      await this.load();
      if (typeof Dashboard !== 'undefined') Dashboard.load();
    } catch (err) { Toast.error(err.message); }
  },

  showClassifyModal(method) {
    if (method === 'keyword') {
      Modal.show(
        '<div class="flex items-start gap-4 mb-5">' +
          '<div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">' +
            '<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-lg font-bold text-white">Keyword Classification</h3>' +
            '<p class="text-sm text-slate-400 mt-0.5">Rule-based classification using your configured keywords</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-3 mb-6">' +
          '<div class="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">' +
            '<svg class="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
            '<div class="text-sm text-slate-300">Scans <span class="text-white font-medium">unclassified comments only</span> and matches them against your keyword rules defined in Settings.</div>' +
          '</div>' +
          '<div class="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">' +
            '<svg class="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' +
            '<div class="text-sm text-slate-300"><span class="text-white font-medium">Instant &amp; free</span> &mdash; runs locally using keyword weights. No API calls needed.</div>' +
          '</div>' +
          '<div class="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">' +
            '<svg class="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' +
            '<div class="text-sm text-slate-400">Comments that don\'t match any keyword remain unclassified. Already-classified comments are <span class="text-white font-medium">not affected</span>.</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex gap-2">' +
          '<button class="btn-primary" onclick="Modal.hide(); Explorer.classifyAll(\'keyword\')"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg> Run Keyword Classification</button>' +
          '<button class="btn-secondary" onclick="Modal.hide()">Cancel</button>' +
        '</div>'
      );
    } else {
      Modal.show(
        '<div class="flex items-start gap-4 mb-5">' +
          '<div class="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">' +
            '<svg class="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-lg font-bold text-white">AI Classification</h3>' +
            '<p class="text-sm text-slate-400 mt-0.5">Classify comments using OpenAI with your trained categories</p>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-3 mb-6">' +
          '<div class="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">' +
            '<svg class="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
            '<div class="text-sm text-slate-300">Sends <span class="text-white font-medium">unclassified comments</span> to OpenAI in batches. The AI considers your categories, training examples, project description, and each comment\'s context.</div>' +
          '</div>' +
          '<div class="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">' +
            '<svg class="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
            '<div class="text-sm text-amber-200/80"><span class="text-amber-300 font-medium">Costs tokens</span> &mdash; each comment uses OpenAI API tokens. Processing many comments may take a minute and incur costs based on your selected model.</div>' +
          '</div>' +
          '<div class="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">' +
            '<svg class="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
            '<div class="text-sm text-slate-300">Each comment gets a <span class="text-white font-medium">category, confidence score, and reasoning</span>. Already-classified comments are not affected.</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex gap-2">' +
          '<button class="btn-primary" onclick="Modal.hide(); Explorer.classifyAll(\'ai\')"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Run AI Classification</button>' +
          '<button class="btn-secondary" onclick="Modal.hide()">Cancel</button>' +
        '</div>'
      );
    }
  },

  async classifyAll(method) {
    try {
      Toast.info('Classifying all unclassified comments (' + method + ')...');
      if (method === 'keyword') {
        const result = await API.post('/ai/keyword-classify');
        Toast.success('Keyword-classified ' + (result.classified || 0) + ' comments');
      } else {
        const result = await API.post('/ai/classify-all');
        Toast.success('AI classified ' + (result.classified || 0) + ' comments');
      }
      await this.load();
      Dashboard.load();
    } catch (err) { Toast.error(err.message); }
  },
};

function debounce(fn, ms) {
  let timer;
  return function() {
    clearTimeout(timer);
    var args = arguments;
    var self = this;
    timer = setTimeout(function() { fn.apply(self, args); }, ms);
  };
}
