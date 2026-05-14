let uploadedFile = null;
let detectedMapping = null;

const Importer = {
  init() {
    const input = document.getElementById('csv-file-input');
    const dropZone = document.getElementById('drop-zone');
    input.addEventListener('change', (e) => { if (e.target.files[0]) this.handleFile(e.target.files[0]); });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-brand-500'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-brand-500'));
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('border-brand-500'); if (e.dataTransfer.files[0]) this.handleFile(e.dataTransfer.files[0]); });
    document.getElementById('btn-import-process').addEventListener('click', () => this.processImport());
    this.loadHistory();
  },

  async handleFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    try {
      Toast.info('Uploading...');
      const result = await API.upload('/import/upload', fd);
      uploadedFile = result;
      detectedMapping = result.mapping;
      document.getElementById('import-preview').classList.remove('hidden');
      this.renderMapping(result.headers, result.mapping);
      this.renderPreview(result.preview);
      Toast.success('File uploaded: ' + result.totalRows + ' rows found');
    } catch (err) { Toast.error('Upload failed: ' + err.message); }
  },

  renderMapping(headers, mapping) {
    const fields = ['author_name', 'comment_text', 'comment_date', 'likes', 'replies', 'post_url', 'original_post'];
    const labels = { author_name: 'Author', comment_text: 'Comment', comment_date: 'Date', likes: 'Likes', replies: 'Replies', post_url: 'Post URL', original_post: 'Original Post' };
    const el = document.getElementById('import-mapping');
    el.innerHTML = fields.map(f => '<div><label class="text-xs text-slate-400 mb-1 block">' + labels[f] + '</label><select class="select text-xs" data-field="' + f + '"><option value="">-- Skip --</option>' + headers.map(h => '<option value="' + h + '"' + (mapping[f] === h ? ' selected' : '') + '>' + escapeHtml(h) + '</option>').join('') + '</select></div>').join('');
  },

  renderPreview(rows) {
    if (!rows || !rows.length) return;
    const headers = Object.keys(rows[0]);
    document.getElementById('import-preview-table').innerHTML = '<table><thead><tr>' + headers.map(h => '<th>' + escapeHtml(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.slice(0, 5).map(r => '<tr>' + headers.map(h => '<td class="text-xs">' + escapeHtml(truncate(r[h], 50)) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  },

  async processImport() {
    if (!uploadedFile) return Toast.warning('Upload a file first');
    const mapping = {};
    document.querySelectorAll('#import-mapping select').forEach(sel => { if (sel.value) mapping[sel.dataset.field] = sel.value; });
    if (!mapping.comment_text) return Toast.warning('Map at least the Comment column');
    try {
      Toast.info('Processing...');
      const result = await API.post('/import/process', {
        filePath: uploadedFile.filePath,
        mapping,
        description: document.getElementById('import-description').value,
        postContext: document.getElementById('import-context').value,
      });
      const el = document.getElementById('import-result');
      el.classList.remove('hidden');
      el.innerHTML = '<div class="flex items-center gap-2 mb-4"><svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="text-emerald-400 font-semibold text-sm">Import Successful</span></div><div class="grid grid-cols-3 gap-4 text-center"><div class="p-3 bg-white/[0.02] rounded-xl"><div class="text-2xl font-bold text-white">' + result.imported + '</div><div class="text-xs text-slate-500 mt-1">Imported</div></div><div class="p-3 bg-white/[0.02] rounded-xl"><div class="text-2xl font-bold text-white">' + (result.classified || 0) + '</div><div class="text-xs text-slate-500 mt-1">Classified</div></div><div class="p-3 bg-white/[0.02] rounded-xl"><div class="text-2xl font-bold text-white">' + result.sourceId + '</div><div class="text-xs text-slate-500 mt-1">Source ID</div></div></div>';
      Toast.success('Imported ' + result.imported + ' comments');
      this.loadHistory();
      Dashboard.load();
    } catch (err) { Toast.error(err.message); }
  },

  async loadHistory() {
    try {
      const sources = await API.get('/import/history');
      const el = document.getElementById('import-history');
      if (!sources.length) { el.innerHTML = '<p class="text-slate-500 text-sm">No imports yet.</p>'; return; }
      el.innerHTML = '<div class="space-y-1">' + sources.map(function(s) { return '<div class="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-white/[0.02] transition-colors"><div class="flex-1 min-w-0"><p class="text-sm text-white truncate">' + escapeHtml(s.filename) + '</p><div class="flex gap-3 text-xs text-slate-500 mt-1"><span>' + (s.total_comments || 0) + ' total</span><span>' + (s.classified_count || 0) + ' classified</span><span>' + (s.platform || 'csv') + '</span><span>' + timeAgo(s.imported_at) + '</span></div></div><button class="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10" onclick="Importer.deleteSource(' + s.id + ')">Delete</button></div>'; }).join('') + '</div>';
    } catch {}
  },

  async deleteSource(id) {
    if (!confirm('Delete this import and all its comments?')) return;
    try { await API.del('/import/' + id); Toast.success('Deleted'); this.loadHistory(); Dashboard.load(); }
    catch (err) { Toast.error(err.message); }
  },
};
