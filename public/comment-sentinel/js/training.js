const Training = {
  async init() {
    document.getElementById('btn-add-training').addEventListener('click', () => this.addExample());
    document.getElementById('btn-test-ai').addEventListener('click', () => this.testAI());
    await this.loadCategories();
    await this.load();
  },

  async loadCategories() {
    try {
      const cats = await API.get('/categories');
      Settings.renderCategorySelect('training-category', cats);
    } catch {}
  },

  async load() {
    try {
      const examples = await API.get('/training');
      document.getElementById('training-count').textContent = examples.length + ' training examples';
      const el = document.getElementById('training-list');
      if (examples.length === 0) { el.innerHTML = '<p class="text-slate-500 text-sm">No training examples yet. Add examples to improve AI classification.</p>'; return; }
      el.innerHTML = '<div class="space-y-2">' + examples.map(function(ex) {
        return '<div class="flex items-start gap-3 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-all">' +
        '<div class="flex-1 min-w-0">' +
        '<p class="text-sm text-slate-200 leading-relaxed">"' + escapeHtml(truncate(ex.comment_text, 120)) + '"</p>' +
        '<div class="flex items-center gap-2 mt-2">' + categoryBadge(ex.category_name, ex.category_color) +
        (ex.user_reasoning ? '<span class="text-[11px] text-slate-500">' + escapeHtml(truncate(ex.user_reasoning, 60)) + '</span>' : '') +
        '</div></div>' +
        '<button class="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0" onclick="Training.deleteExample(\'' + ex.id + '\')">Delete</button>' +
        '</div>';
      }).join('') + '</div>';
    } catch (err) { Toast.error('Failed to load training examples'); }
  },

  async addExample() {
    const commentText = document.getElementById('training-comment').value.trim();
    const contextText = document.getElementById('training-context').value.trim();
    const categoryId = document.getElementById('training-category').dataset.value || null;
    const reasoning = document.getElementById('training-reasoning').value.trim();
    if (!commentText) return Toast.warning('Enter a comment text');
    if (!categoryId) return Toast.warning('Select a category');
    try {
      await API.post('/training', { commentText, contextText, correctCategoryId: categoryId, userReasoning: reasoning });
      Toast.success('Training example added');
      document.getElementById('training-comment').value = '';
      document.getElementById('training-context').value = '';
      document.getElementById('training-reasoning').value = '';
      await this.load();
    } catch (err) { Toast.error(err.message); }
  },

  async deleteExample(id) {
    if (!confirm('Delete this training example?')) return;
    try { await API.del('/training/' + id); Toast.success('Deleted'); await this.load(); }
    catch (err) { Toast.error(err.message); }
  },

  async testAI() {
    const commentText = document.getElementById('training-comment').value.trim();
    const contextText = document.getElementById('training-context').value.trim();
    if (!commentText) return Toast.warning('Enter a comment to test');
    try {
      Toast.info('Testing AI classification...');
      const result = await API.post('/ai/test', { commentText, contextText });
      const el = document.getElementById('ai-test-result');
      el.classList.remove('hidden');
      el.innerHTML = '<h4 class="text-sm font-semibold text-white mb-2">AI Result</h4>' +
        '<div class="space-y-1 text-sm">' +
        '<div><span class="text-slate-400">Category:</span> <span class="text-white">' + (result.categoryId || 'None') + '</span></div>' +
        '<div><span class="text-slate-400">Confidence:</span> ' + confidenceBar(result.confidence) + '</div>' +
        '<div><span class="text-slate-400">Sentiment:</span> <span class="text-white">' + (result.sentiment || '') + '</span></div>' +
        '<div><span class="text-slate-400">Reasoning:</span> <span class="text-slate-300">' + escapeHtml(result.reasoning || '') + '</span></div>' +
        '</div>';
    } catch (err) { Toast.error(err.message); }
  },
};
