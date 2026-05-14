let currentPlatform = 'facebook';
let currentMode = 'page';
let fetchedPosts = [];
let selectedPosts = new Set();
let multiValidatedLinks = [];
let batchEntryCounter = 0;

// Client-side URL validation to catch wrong-platform links before hitting the API
const URL_PATTERNS = {
  facebook: {
    hosts: ['facebook.com', 'fb.com', 'm.facebook.com', 'www.facebook.com', 'www.fb.com'],
    wrongPlatform: ['tiktok.com', 'youtube.com', 'youtu.be', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv', 'threads.net'],
  },
  tiktok: {
    hosts: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com'],
    wrongPlatform: ['facebook.com', 'fb.com', 'youtube.com', 'youtu.be', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv', 'threads.net'],
  },
  youtube: {
    hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
    wrongPlatform: ['facebook.com', 'fb.com', 'tiktok.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv', 'threads.net'],
  },
};

function quickValidateUrl(url, platform) {
  if (!url || !url.startsWith('http')) return { valid: false, error: 'URL must start with http:// or https://' };
  try {
    var host = new URL(url).hostname.toLowerCase();
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
  var config = URL_PATTERNS[platform];
  if (!config) return { valid: true, error: null };

  // Check if the URL belongs to a different platform
  for (var i = 0; i < config.wrongPlatform.length; i++) {
    if (host === config.wrongPlatform[i] || host.endsWith('.' + config.wrongPlatform[i])) {
      return { valid: false, error: 'This is not a ' + platform + ' URL — you may have the wrong platform tab selected' };
    }
  }

  // Check if host matches expected platform
  var hostMatch = false;
  for (var j = 0; j < config.hosts.length; j++) {
    if (host === config.hosts[j]) { hostMatch = true; break; }
  }
  if (!hostMatch) return { valid: false, error: 'URL does not appear to be a ' + platform + ' link' };

  return { valid: true, error: null };
}

const Scraper = {
  init() {
    document.querySelectorAll('#platform-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#platform-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPlatform = btn.dataset.platform;
        this.updateUI();
        this.clearResults();
      });
    });

    document.querySelectorAll('#scraper-mode-tabs button').forEach(btn => {
      btn.addEventListener('click', () => this.switchMode(btn.dataset.mode));
    });

    document.getElementById('btn-fetch-posts').addEventListener('click', () => this.fetchPosts());
    document.getElementById('btn-scrape-context').addEventListener('click', () => this.scrapeContext());
    document.getElementById('btn-multi-validate').addEventListener('click', () => this.validateMultiLinks());
    document.getElementById('btn-multi-scrape').addEventListener('click', () => this.processMultiLinks());
    document.getElementById('multi-urls-input').addEventListener('input', () => this.updateMultiCount());

    this.updateUI();
  },

  switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('#scraper-mode-tabs button').forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.className = 'px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 bg-brand-600 text-white shadow';
      } else {
        btn.className = 'px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 text-slate-400 hover:text-white';
      }
    });
    document.getElementById('page-scraper-mode').classList.toggle('hidden', mode !== 'page');
    document.getElementById('batch-links-mode').classList.toggle('hidden', mode !== 'batch');
    document.getElementById('multi-platform-mode').classList.toggle('hidden', mode !== 'multi');
    document.getElementById('scraper-results').classList.toggle('hidden', mode !== 'page');
    document.getElementById('platform-tabs').classList.toggle('hidden', mode === 'multi');
    if (mode === 'batch' && document.getElementById('batch-entries-list').children.length === 0) {
      this.addBatchEntry();
    }
    this.updateUI();
  },

  clearResults() {
    fetchedPosts = [];
    selectedPosts.clear();
    document.getElementById('scraper-results').innerHTML = '';
    document.getElementById('batch-entries-list').innerHTML = '';
    document.getElementById('batch-scrape-actions').classList.add('hidden');
    document.getElementById('batch-results-summary').classList.add('hidden');
    batchEntryCounter = 0;
  },

  updateUI() {
    const pageLabels = { facebook: 'Facebook Page URL', tiktok: 'TikTok Profile URL', youtube: 'YouTube Channel URL' };
    const pagePlaceholders = { facebook: 'https://www.facebook.com/page-name', tiktok: 'https://www.tiktok.com/@username', youtube: 'https://www.youtube.com/@channel' };
    document.getElementById('scraper-url-label').textContent = pageLabels[currentPlatform] || 'URL';
    document.getElementById('scraper-url').placeholder = pagePlaceholders[currentPlatform] || 'Enter URL...';

  },

  detectPlatformFromUrl(url) {
    if (!url) return null;
    try { var host = new URL(url).hostname.toLowerCase(); } catch (e) { return null; }
    for (var p in URL_PATTERNS) {
      for (var h = 0; h < URL_PATTERNS[p].hosts.length; h++) {
        if (host === URL_PATTERNS[p].hosts[h]) return p;
      }
    }
    return null;
  },

  addBatchEntry() {
    var idx = batchEntryCounter++;
    var container = document.getElementById('batch-entries-list');
    var langOptions = '<option value="">Auto-detect</option><option value="ro">Romanian</option><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="de">German</option><option value="it">Italian</option><option value="pt">Portuguese</option><option value="nl">Dutch</option><option value="pl">Polish</option><option value="hu">Hungarian</option><option value="tr">Turkish</option><option value="ru">Russian</option><option value="uk">Ukrainian</option><option value="ar">Arabic</option><option value="hi">Hindi</option><option value="ja">Japanese</option><option value="ko">Korean</option><option value="zh">Chinese</option>';
    var card = document.createElement('div');
    card.id = 'batch-entry-' + idx;
    card.className = 'p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3 relative';
    card.innerHTML =
      '<div class="flex items-center justify-between mb-1">' +
        '<span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Source #' + (container.children.length + 1) + '</span>' +
        '<button type="button" class="text-slate-600 hover:text-red-400 transition-colors p-1" onclick="Scraper.removeBatchEntry(' + idx + ')" title="Remove">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' +
        '<div class="form-group mb-0">' +
          '<label class="label text-xs mb-1">Title <span class="text-red-400">*</span></label>' +
          '<input type="text" class="input text-xs batch-entry-title" data-idx="' + idx + '" placeholder="e.g., My Article About X">' +
        '</div>' +
        '<div class="form-group mb-0">' +
          '<label class="label text-xs mb-1">Post / Video URL <span class="text-red-400">*</span></label>' +
          '<input type="url" class="input text-xs font-mono batch-entry-url" data-idx="' + idx + '" placeholder="https://facebook.com/... or tiktok.com/... or youtube.com/..." oninput="Scraper.onBatchUrlInput(' + idx + ')">' +
        '</div>' +
      '</div>' +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-3">' +
        '<div class="form-group mb-0">' +
          '<label class="label text-xs mb-1">Article URL <span class="text-slate-500 font-normal">(optional)</span></label>' +
          '<input type="url" class="input text-xs font-mono batch-entry-article" data-idx="' + idx + '" placeholder="https://example.com/article">' +
        '</div>' +
        '<div class="form-group mb-0">' +
          '<label class="label text-xs mb-1">Site Traffic <span class="text-slate-500 font-normal">(optional)</span></label>' +
          '<input type="number" class="input text-xs batch-entry-traffic" data-idx="' + idx + '" placeholder="e.g., 5000" min="0">' +
        '</div>' +
        '<div class="form-group mb-0">' +
          '<label class="label text-xs mb-1">Transcript Language <span class="text-slate-500 font-normal">(optional)</span></label>' +
          '<select class="select text-xs batch-entry-lang" data-idx="' + idx + '">' + langOptions + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="flex items-center gap-2">' +
        '<span class="batch-entry-platform text-[10px] text-slate-500" id="batch-entry-platform-' + idx + '"></span>' +
        '<span class="batch-entry-status" id="batch-entry-status-' + idx + '"></span>' +
      '</div>';
    container.appendChild(card);
    this._updateBatchActions();
  },

  removeBatchEntry(idx) {
    var card = document.getElementById('batch-entry-' + idx);
    if (card) card.remove();
    this._renumberBatchEntries();
    this._updateBatchActions();
    if (document.getElementById('batch-entries-list').children.length === 0) {
      this.addBatchEntry();
    }
  },

  _renumberBatchEntries() {
    var entries = document.getElementById('batch-entries-list').children;
    for (var i = 0; i < entries.length; i++) {
      var label = entries[i].querySelector('.text-xs.font-bold');
      if (label) label.textContent = 'Source #' + (i + 1);
    }
  },

  onBatchUrlInput(idx) {
    var input = document.querySelector('.batch-entry-url[data-idx="' + idx + '"]');
    var platformEl = document.getElementById('batch-entry-platform-' + idx);
    if (!input || !platformEl) return;
    var url = input.value.trim();
    var platform = this.detectPlatformFromUrl(url);
    if (platform) {
      var icons = { facebook: 'FB', tiktok: 'TT', youtube: 'YT' };
      var colors = { facebook: 'text-blue-400', tiktok: 'text-pink-400', youtube: 'text-red-400' };
      platformEl.innerHTML = '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] text-[10px] font-semibold ' + (colors[platform] || '') + '">' + (icons[platform] || platform) + ' detected</span>';
    } else if (url.length > 10) {
      platformEl.innerHTML = '<span class="text-[10px] text-amber-400">Unknown platform</span>';
    } else {
      platformEl.innerHTML = '';
    }
  },

  _updateBatchActions() {
    var entries = document.querySelectorAll('#batch-entries-list > div');
    var filled = 0;
    entries.forEach(function(entry) {
      var title = entry.querySelector('.batch-entry-title');
      var url = entry.querySelector('.batch-entry-url');
      if (title && url && title.value.trim() && url.value.trim()) filled++;
    });
    var actionsEl = document.getElementById('batch-scrape-actions');
    if (filled > 0) {
      actionsEl.classList.remove('hidden');
      document.getElementById('batch-ready-count').textContent = filled + ' source' + (filled !== 1 ? 's' : '') + ' ready';
    } else {
      actionsEl.classList.add('hidden');
    }
  },

  // ─── Page Scraper (existing) ─────────────────────────────────────────────

  async scrapeContext() {
    var url = document.getElementById('context-url').value.trim();
    if (!url) return Toast.warning('Enter a URL to scrape');
    try {
      this.logActivity('Scraping article context: ' + url);
      Toast.info('Scraping article...');
      var result = await API.post('/context/scrape-url', { url: url });
      document.getElementById('context-text').value = result.text || '';
      this.logActivity('Article context extracted (' + (result.text || '').length + ' chars)', 'success');
      Toast.success('Article context extracted');
    } catch (err) { this.logActivity('Article scrape failed: ' + err.message, 'error'); Toast.error('Failed to scrape: ' + err.message); }
  },

  async fetchPosts() {
    var url = document.getElementById('scraper-url').value.trim();
    if (!url) return Toast.warning('Enter a URL first');

    var check = quickValidateUrl(url, currentPlatform);
    if (!check.valid) { this.logActivity('URL validation failed: ' + check.error, 'error'); return Toast.error(check.error); }

    var dateFilter = document.getElementById('scraper-date-filter').value;

    this.logActivity('Starting ' + currentPlatform + ' page scrape: ' + url);
    this.showProgress('Fetching posts...');
    fetchedPosts = [];
    selectedPosts.clear();

    try {
      var result;
      if (currentPlatform === 'facebook') {
        this.logActivity('Calling Facebook page posts API...');
        result = await API.get('/scraper/fb/posts?pageUrl=' + encodeURIComponent(url) + (dateFilter ? '&dateFilter=' + dateFilter : ''));
        fetchedPosts = result.posts || [];
      } else if (currentPlatform === 'tiktok') {
        this.logActivity('Calling TikTok profile videos API...');
        result = await API.get('/scraper/tt/posts?profileUrl=' + encodeURIComponent(url) + (dateFilter ? '&dateFilter=' + dateFilter : ''));
        fetchedPosts = result.posts || [];
      } else if (currentPlatform === 'youtube') {
        this.logActivity('Calling YouTube channel API...');
        result = await API.get('/scraper/yt/posts?channelUrl=' + encodeURIComponent(url));
        fetchedPosts = result.posts || [];
      }

      this.hideProgress();
      if (fetchedPosts.length === 0) { this.logActivity('No posts found', 'warn'); Toast.warning('No posts found'); return; }
      this.logActivity('Found ' + fetchedPosts.length + ' posts', 'success');
      Toast.success('Found ' + fetchedPosts.length + ' posts');
      this.renderPosts();
    } catch (err) { this.hideProgress(); this.logActivity('Fetch failed: ' + err.message, 'error'); Toast.error('Fetch failed: ' + err.message); }
  },

  renderPosts() {
    var el = document.getElementById('scraper-results');
    el.innerHTML = '<div class="card">' +
      '<div class="flex items-center justify-between mb-4">' +
      '<h3 class="section-title mb-0">Posts (' + fetchedPosts.length + ')</h3>' +
      '<div class="flex gap-2">' +
      '<button class="btn-secondary" onclick="Scraper.selectAll()">Select All</button>' +
      '<button class="btn-primary" onclick="Scraper.fetchComments()">Fetch Comments for Selected</button>' +
      '</div></div>' +
      '<div class="space-y-2">' +
      fetchedPosts.map(function(p, i) {
        var text = p.text || p.message || p.title || p.description || '';
        var comments = p.commentCount || p.comments || 0;
        return '<label class="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-700/30 cursor-pointer">' +
          '<input type="checkbox" class="mt-1 rounded border-slate-600" data-idx="' + i + '" onchange="Scraper.togglePost(' + i + ', this.checked)">' +
          '<div class="flex-1 min-w-0">' +
          '<p class="text-sm text-white line-clamp-2">' + escapeHtml(truncate(text, 200)) + '</p>' +
          '<div class="flex gap-4 mt-1 text-xs text-slate-500">' +
          '<span>' + comments + ' comments</span>' +
          (p.reactionCount ? '<span>' + p.reactionCount + ' reactions</span>' : '') +
          (p.videoViewCount ? '<span>' + p.videoViewCount + ' views</span>' : '') +
          '</div></div></label>';
      }).join('') +
      '</div></div>';
  },

  selectAll() {
    fetchedPosts.forEach(function(_, i) { selectedPosts.add(i); });
    document.querySelectorAll('#scraper-results input[type="checkbox"]').forEach(function(cb) { cb.checked = true; });
  },

  togglePost(idx, checked) {
    if (checked) selectedPosts.add(idx); else selectedPosts.delete(idx);
  },

  async fetchComments() {
    if (selectedPosts.size === 0) return Toast.warning('Select at least one post');
    this.logActivity('Fetching comments for ' + selectedPosts.size + ' selected post(s)...');
    Modal.showProcessing('Scraping Comments', 'Fetching comments from ' + selectedPosts.size + ' post(s)...');
    this.showProgress('Fetching comments...');

    try {
      var urls = [...selectedPosts].map(function(i) { return fetchedPosts[i].url || fetchedPosts[i].postUrl || ''; }).filter(Boolean);
      if (urls.length === 0) return Toast.error('No valid URLs in selected posts');

      this.logActivity('Calling ' + currentPlatform + ' comments API for ' + urls.length + ' URL(s)...');
      var result;
      if (currentPlatform === 'facebook') {
        result = await API.post('/scraper/fb/comments', { postUrls: urls });
      } else if (currentPlatform === 'tiktok') {
        result = await API.post('/scraper/tt/comments', { videoUrls: urls });
      } else if (currentPlatform === 'youtube') {
        result = await API.post('/scraper/yt/comments', { videoUrls: urls });
      }

      this.logActivity('Received ' + (result.totalItems || 0) + ' comments from API', 'success');
      this.setProgress(50, 'Processing ' + (result.totalItems || 0) + ' comments...');

      var allComments = [];
      var byPost = result.commentsByPost || {};
      Object.keys(byPost).forEach(function(postUrl) {
        byPost[postUrl].forEach(function(c) {
          allComments.push({
            author_name: (c.author && c.author.name) || 'Unknown',
            comment_text: c.text || '',
            comment_date: c.created_at || '',
            likes: c.reaction_count || 0,
            replies: c.reply_count || 0,
            post_url: postUrl,
            platform: currentPlatform,
          });
        });
      });

      if (allComments.length === 0) { this.hideProgress(); Modal.hideProcessing(); this.logActivity('No comments found after processing', 'warn'); Toast.warning('No comments found'); return; }

      Modal.updateProcessing('Importing & classifying ' + allComments.length + ' comments...');
      this.logActivity('Importing ' + allComments.length + ' comments & running classification...');
      this.setProgress(70, 'Importing & classifying...');
      var contextText = document.getElementById('context-text').value.trim();
      var importResult = await API.post('/scraper/import-analyze', {
        comments: allComments,
        platform: currentPlatform,
        sourceName: currentPlatform + ' scrape - ' + new Date().toISOString().split('T')[0],
        contextText: contextText,
      });

      this.hideProgress();
      Modal.hideProcessing();
      this.logActivity('Import complete: ' + importResult.imported + ' imported, ' + (importResult.classified || 0) + ' classified, ' + (importResult.themes ? importResult.themes.length : 0) + ' themes', 'success');
      Toast.success('Imported ' + importResult.imported + ' comments, classified ' + (importResult.classified || 0));

      var resultEl = document.getElementById('scraper-results');
      resultEl.innerHTML += '<div class="card mt-4 bg-emerald-500/[0.05] border-emerald-500/20">' +
        '<div class="flex items-center gap-2 mb-4"><svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="text-emerald-400 font-semibold text-sm">Import Complete</span></div>' +
        '<div class="grid grid-cols-3 gap-3 text-center">' +
        '<div class="p-3 bg-white/[0.02] rounded-xl"><div class="text-2xl font-bold text-white">' + importResult.imported + '</div><div class="text-xs text-slate-500 mt-1">Imported</div></div>' +
        '<div class="p-3 bg-white/[0.02] rounded-xl"><div class="text-2xl font-bold text-white">' + (importResult.classified || 0) + '</div><div class="text-xs text-slate-500 mt-1">Classified</div></div>' +
        '<div class="p-3 bg-white/[0.02] rounded-xl"><div class="text-2xl font-bold text-white">' + (importResult.themes ? importResult.themes.length : 0) + '</div><div class="text-xs text-slate-500 mt-1">Themes</div></div>' +
        '</div></div>';

      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }
    } catch (err) { this.hideProgress(); Modal.hideProcessing(); Toast.error('Failed: ' + err.message); }
  },

  // ─── Batch Entries ──────────────────────────────────────────────────────

  _badgeHtml(color, icon, text) {
    var spinSvg = '<svg class="animate-spin w-3.5 h-3.5 mr-1.5 inline-block" viewBox="0 0 20 20" fill="none">' +
      '<circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" opacity="0.2"/>' +
      '<circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="32 50"/></svg>';
    return '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-' + color + '-500/15 text-' + color + '-300 border border-' + color + '-500/20">' +
      (icon === 'spin' ? spinSvg : '') +
      text + '</span>';
  },

  async processBatchEntries() {
    var entries = document.querySelectorAll('#batch-entries-list > div');
    var self = this;
    var entriesToProcess = [];

    entries.forEach(function(entry) {
      var titleEl = entry.querySelector('.batch-entry-title');
      var urlEl = entry.querySelector('.batch-entry-url');
      var articleEl = entry.querySelector('.batch-entry-article');
      var trafficEl = entry.querySelector('.batch-entry-traffic');
      var langEl = entry.querySelector('.batch-entry-lang');
      var title = titleEl ? titleEl.value.trim() : '';
      var url = urlEl ? urlEl.value.trim() : '';
      if (!title || !url) return;
      var idx = urlEl.dataset.idx;
      var platform = self.detectPlatformFromUrl(url);
      entriesToProcess.push({
        title: title,
        url: url,
        articleUrl: articleEl ? articleEl.value.trim() : '',
        siteTraffic: trafficEl ? parseInt(trafficEl.value) || 0 : 0,
        language: langEl ? langEl.value : '',
        platform: platform || 'facebook',
        _idx: idx
      });
    });

    if (entriesToProcess.length === 0) return Toast.warning('Fill in at least one source with a title and URL');

    var missingTitle = false;
    entries.forEach(function(entry) {
      var urlEl = entry.querySelector('.batch-entry-url');
      var titleEl = entry.querySelector('.batch-entry-title');
      if (urlEl && urlEl.value.trim() && (!titleEl || !titleEl.value.trim())) missingTitle = true;
    });
    if (missingTitle) return Toast.warning('Every source needs a title');

    this.logActivity('Starting batch scrape for ' + entriesToProcess.length + ' source(s)...');
    Modal.showProcessing('Scraping Comments', 'Processing source 1/' + entriesToProcess.length + '...');

    var btn = document.getElementById('btn-batch-scrape');
    btn.disabled = true;
    btn.innerHTML = '<svg class="animate-spin w-4 h-4" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" opacity="0.2"/><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="32 50"/></svg> Processing...';

    var totalProcessed = 0;
    var totalImported = 0;
    var totalClassified = 0;

    for (var j = 0; j < entriesToProcess.length; j++) {
      var ep = entriesToProcess[j];
      var label = '#' + (j + 1) + '/' + entriesToProcess.length;
      var statusEl = document.getElementById('batch-entry-status-' + ep._idx);

      try {
        Modal.updateProcessing('Processing source ' + (j + 1) + '/' + entriesToProcess.length + ' — scraping comments...');
        if (statusEl) statusEl.innerHTML = this._badgeHtml('brand', 'spin', 'Scraping...');
        this.logActivity('Source ' + label + ' (' + escapeHtml(ep.title) + ') — scraping ' + ep.platform + ' comments...');

        var commentsResult;
        if (ep.platform === 'facebook') {
          commentsResult = await API.post('/scraper/fb/comments', { postUrls: [ep.url] });
        } else if (ep.platform === 'tiktok') {
          commentsResult = await API.post('/scraper/tt/comments', { videoUrls: [ep.url] });
        } else if (ep.platform === 'youtube') {
          commentsResult = await API.post('/scraper/yt/comments', { videoUrls: [ep.url] });
        } else {
          commentsResult = await API.post('/scraper/fb/comments', { postUrls: [ep.url] });
        }

        var allComments = [];
        var byPost = commentsResult.commentsByPost || {};
        Object.keys(byPost).forEach(function(postUrl) {
          byPost[postUrl].forEach(function(c) {
            allComments.push({
              author_name: (c.author && c.author.name) || 'Unknown',
              comment_text: c.text || '',
              comment_date: c.created_at || '',
              likes: c.reaction_count || 0,
              replies: c.reply_count || 0,
              post_url: postUrl,
              platform: ep.platform,
            });
            if (c._replies) {
              c._replies.forEach(function(r) {
                allComments.push({
                  author_name: (r.author && r.author.name) || 'Unknown',
                  comment_text: r.text || '',
                  comment_date: r.created_at || '',
                  likes: r.reaction_count || 0,
                  replies: r.reply_count || 0,
                  post_url: postUrl,
                  platform: ep.platform,
                });
              });
            }
          });
        });

        if (allComments.length === 0) {
          if (statusEl) statusEl.innerHTML = this._badgeHtml('amber', '', 'No comments found');
          this.logActivity('Source ' + label + ': no comments found', 'warn');
          totalProcessed++;
          continue;
        }

        this.logActivity('Source ' + label + ': scraped ' + allComments.length + ' comments', 'success');

        Modal.updateProcessing('Processing source ' + (j + 1) + '/' + entriesToProcess.length + ' — classifying ' + allComments.length + ' comments...');
        if (statusEl) statusEl.innerHTML = this._badgeHtml('amber', 'spin', 'Classifying ' + allComments.length + '...');

        var importResult = await API.post('/scraper/import-analyze', {
          comments: allComments,
          platform: ep.platform,
          sourceName: ep.title,
          contextText: '',
          viewCount: ep.siteTraffic || 0,
          articleUrl: ep.articleUrl || '',
        });

        if (statusEl) statusEl.innerHTML = '<div class="flex gap-1">' + this._badgeHtml('emerald', '', importResult.imported + ' imported') + this._badgeHtml('brand', '', (importResult.classified || 0) + ' classified') + '</div>';
        this.logActivity('Source ' + label + ': ' + importResult.imported + ' imported, ' + (importResult.classified || 0) + ' classified', 'success');
        totalImported += importResult.imported;
        totalClassified += importResult.classified || 0;
      } catch (err) {
        if (statusEl) statusEl.innerHTML = this._badgeHtml('red', '', 'Failed: ' + escapeHtml(err.message));
        this.logActivity('Source ' + label + ' error: ' + err.message, 'error');
      }
      totalProcessed++;
    }

    Modal.hideProcessing();
    this.logActivity('Batch complete: ' + totalImported + ' comments from ' + totalProcessed + ' sources', 'success');

    document.getElementById('batch-scrape-actions').classList.add('hidden');
    Toast.success('Batch complete: ' + totalImported + ' comments imported from ' + totalProcessed + ' sources');
    if (typeof Dashboard !== 'undefined') Dashboard.load();
    if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }

    btn.disabled = false;
    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Scrape All';

    Modal.show(
      '<div class="text-center">' +
        '<div class="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">' +
          '<svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
        '</div>' +
        '<h3 class="text-xl font-bold text-white mb-2">Scrape Complete</h3>' +
        '<p class="text-sm text-slate-400 mb-6">Processed ' + totalProcessed + ' source' + (totalProcessed !== 1 ? 's' : '') + ' successfully.</p>' +
        '<div class="grid grid-cols-3 gap-3 mb-6">' +
          '<div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"><div class="text-2xl font-bold text-white">' + totalProcessed + '</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Sources</div></div>' +
          '<div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"><div class="text-2xl font-bold text-white">' + totalImported + '</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Imported</div></div>' +
          '<div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"><div class="text-2xl font-bold text-white">' + totalClassified + '</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Classified</div></div>' +
        '</div>' +
        '<div class="flex gap-2 justify-center">' +
          '<button class="btn-primary" onclick="Modal.hide(); document.querySelector(\'[data-page=dashboard]\').click();">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>' +
            ' Go to Dashboard' +
          '</button>' +
          '<button class="btn-secondary" onclick="Modal.hide(); Scraper.clearResults(); Scraper.addBatchEntry();">' +
            'New Scrape' +
          '</button>' +
        '</div>' +
      '</div>'
    );
  },

  // ─── Multi-Platform ──────────────────────────────────────────────────────

  updateMultiCount() {
    var urls = document.getElementById('multi-urls-input').value.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0 && l.startsWith('http'); });
    document.getElementById('multi-url-count').textContent = urls.length + ' link' + (urls.length !== 1 ? 's' : '') + ' detected';
  },

  async validateMultiLinks() {
    var raw = document.getElementById('multi-urls-input').value;
    var urls = raw.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0 && l.startsWith('http'); });
    if (urls.length === 0) return Toast.warning('Paste at least one URL');

    var unique = [...new Set(urls)];
    this.logActivity('Validating ' + unique.length + ' multi-platform URL(s)...');
    this.showProgress('Validating links across platforms...');

    document.getElementById('multi-links-list').innerHTML = '';
    document.getElementById('multi-scrape-actions').classList.add('hidden');
    document.getElementById('multi-validated-info').classList.add('hidden');
    multiValidatedLinks = [];

    try {
      var lang = document.getElementById('multi-transcript-lang').value.trim() || null;
      var result = await API.post('/scraper/multi/validate', { urls: unique, language: lang });

      this.hideProgress();
      multiValidatedLinks = result.links || [];

      if (result.suggestedTitle) {
        document.getElementById('multi-title').value = result.suggestedTitle;
      }

      var validCount = multiValidatedLinks.filter(function(l) { return l.valid; }).length;
      var totalViews = multiValidatedLinks.reduce(function(s, l) { return s + (l.viewCount || 0); }, 0);
      var totalComments = multiValidatedLinks.reduce(function(s, l) { return s + (l.commentCount || 0); }, 0);

      this.renderMultiLinks();
      this.updateMultiStats();

      if (validCount > 0) {
        document.getElementById('multi-scrape-actions').classList.remove('hidden');
        document.getElementById('multi-ready-count').textContent = validCount + ' platform' + (validCount !== 1 ? 's' : '') + ' ready';
      }

      this.logActivity('Validated ' + validCount + '/' + multiValidatedLinks.length + ' links, ' + formatViews(totalViews) + ' total views', validCount > 0 ? 'success' : 'warn');
      Toast.success('Validated ' + validCount + '/' + multiValidatedLinks.length + ' links');
    } catch (err) {
      this.hideProgress();
      this.logActivity('Multi-platform validation failed: ' + err.message, 'error');
      Toast.error('Validation failed: ' + err.message);
    }
  },

  updateMultiStats() {
    var validLinks = multiValidatedLinks.filter(function(l) { return l.valid; });
    if (!validLinks.length) return;

    // Include manual overrides
    document.querySelectorAll('.multi-views-input').forEach(function(input) {
      var idx = parseInt(input.dataset.idx);
      var val = parseInt(input.value);
      if (!isNaN(idx) && val > 0 && multiValidatedLinks[idx]) multiValidatedLinks[idx].viewCount = val;
    });

    var totalViews = validLinks.reduce(function(s, l) { return s + (l.viewCount || 0); }, 0);
    var totalComments = validLinks.reduce(function(s, l) { return s + (l.commentCount || 0); }, 0);
    var validCount = validLinks.length;

    document.getElementById('multi-validated-info').classList.remove('hidden');
    document.getElementById('multi-stats').innerHTML =
      '<span class="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">' + validCount + ' platform' + (validCount !== 1 ? 's' : '') + '</span>' +
      (totalViews > 0 ? '<span class="text-xs px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-300 border border-brand-500/20"><svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>' + formatViews(totalViews) + ' views</span>' : '') +
      '<span class="text-xs px-2.5 py-1 rounded-lg bg-white/[0.04] text-slate-400 border border-white/[0.06]">~' + totalComments + ' comments (est.)</span>';
  },

  renderMultiLinks() {
    var el = document.getElementById('multi-links-list');
    if (!multiValidatedLinks.length) { el.innerHTML = ''; return; }

    var platformLabels = { facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube' };
    var platformColors = { facebook: 'text-blue-400 bg-blue-500/10 border-blue-500/20', tiktok: 'text-pink-400 bg-pink-500/10 border-pink-500/20', youtube: 'text-red-400 bg-red-500/10 border-red-500/20' };

    el.innerHTML = multiValidatedLinks.map(function(link, i) {
      var pLabel = platformLabels[link.platform] || link.platform || 'Unknown';
      var pClass = platformColors[link.platform] || 'text-slate-400 bg-white/[0.06] border-white/[0.06]';
      var shortUrl = link.url.length > 70 ? link.url.substring(0, 67) + '...' : link.url;

      if (link.error) {
        return '<div class="card border-red-500/10">' +
          '<div class="flex items-center gap-2 mb-2">' +
            '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ' + pClass + '">' + escapeHtml(pLabel) + '</span>' +
            '<span class="badge bg-red-500/20 text-red-300">Error</span>' +
          '</div>' +
          '<p class="text-xs text-slate-500 font-mono truncate">' + escapeHtml(shortUrl) + '</p>' +
          '<p class="text-xs text-red-400 mt-1">' + escapeHtml(link.error) + '</p>' +
        '</div>';
      }

      var missingViews = !link.viewCount;
      var missingComments = !link.commentCount;
      var warnings = [];
      if (missingViews) warnings.push('views');
      if (missingComments) warnings.push('comments');

      return '<div class="card">' +
        '<div class="flex items-start justify-between gap-3">' +
          '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center gap-2 flex-wrap">' +
              '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded border ' + pClass + '">' + escapeHtml(pLabel) + '</span>' +
              (link.viewCount ? '<span class="text-[10px] text-slate-400">' + formatViews(link.viewCount) + ' views</span>' : '') +
              '<span class="text-[10px] text-slate-500">' + (link.commentCount || 0) + ' comments (est.)</span>' +
              (link.transcript ? '<span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">Transcript</span>' : '') +
              (warnings.length ? '<span class="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">\u26A0 No ' + warnings.join(' or ') + ' data</span>' : '') +
            '</div>' +
            '<p class="text-xs text-brand-300 font-mono mt-1.5 truncate" title="' + escapeHtml(link.url) + '">' + escapeHtml(shortUrl) + '</p>' +
            (missingViews ? '<div class="flex items-center gap-2 mt-2">' +
              '<label class="text-[10px] text-amber-400 whitespace-nowrap">Views (manual):</label>' +
              '<input type="number" class="multi-views-input bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white w-28 placeholder-slate-600" data-idx="' + i + '" placeholder="e.g. 50000" min="0">' +
            '</div>' : '') +
          '</div>' +
          '<div id="multi-link-status-' + i + '" class="flex-shrink-0"></div>' +
        '</div>' +
      '</div>';
    }).join('');

    var self = this;
    el.querySelectorAll('.multi-views-input').forEach(function(input) {
      input.addEventListener('input', function() { self.updateMultiStats(); });
    });
  },

  async processMultiLinks() {
    // Pick up any manually entered view counts before processing
    document.querySelectorAll('.multi-views-input').forEach(function(input) {
      var idx = parseInt(input.dataset.idx);
      var val = parseInt(input.value);
      if (!isNaN(idx) && val > 0 && multiValidatedLinks[idx]) {
        multiValidatedLinks[idx].viewCount = val;
      }
    });

    var validLinks = multiValidatedLinks.filter(function(l) { return l.valid; });
    if (validLinks.length === 0) return Toast.warning('No valid links to process');

    var title = document.getElementById('multi-title').value.trim();
    if (!title) return Toast.warning('Enter a title for this import');

    this.logActivity('Starting multi-platform scrape: ' + validLinks.length + ' platform(s)...');

    Modal.showProcessing('Multi-Platform Scrape', 'Scraping ' + validLinks.length + ' platform(s)... This may take a few minutes.');

    var btn = document.getElementById('btn-multi-scrape');
    btn.disabled = true;
    btn.innerHTML =
      '<svg class="animate-spin w-4 h-4" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" opacity="0.2"/><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="32 50"/></svg> Processing...';

    for (var i = 0; i < multiValidatedLinks.length; i++) {
      var statusEl = document.getElementById('multi-link-status-' + i);
      if (statusEl && multiValidatedLinks[i].valid) {
        statusEl.innerHTML = this._badgeHtml('brand', 'spin', 'Waiting...');
      }
    }

    try {
      var result = await API.post('/scraper/multi/process', {
        title: title,
        links: validLinks,
        language: document.getElementById('multi-transcript-lang').value.trim() || null,
      });

      for (var j = 0; j < multiValidatedLinks.length; j++) {
        var sEl = document.getElementById('multi-link-status-' + j);
        if (sEl && multiValidatedLinks[j].valid) {
          var pStat = (result.platformStats || []).find(function(p) { return p.url === multiValidatedLinks[j].url; });
          if (pStat && pStat.comments > 0) {
            sEl.innerHTML = this._badgeHtml('emerald', '', pStat.comments + ' imported');
          } else {
            sEl.innerHTML = this._badgeHtml('amber', '', 'No comments');
          }
        }
      }

      Modal.hideProcessing();
      this.logActivity('Multi-platform complete: ' + result.imported + ' comments, ' + (result.classified || 0) + ' classified, ' + (result.themes ? result.themes.length : 0) + ' themes', 'success');
      Toast.success('Imported ' + result.imported + ' comments from ' + validLinks.length + ' platform(s)');

      document.getElementById('multi-scrape-actions').classList.add('hidden');
      if (typeof Dashboard !== 'undefined') Dashboard.load();
      if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }

      Modal.show(
        '<div class="text-center">' +
          '<div class="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">' +
            '<svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
          '</div>' +
          '<h3 class="text-xl font-bold text-white mb-2">Multi-Platform Import Complete</h3>' +
          '<p class="text-sm text-slate-400 mb-6">' + validLinks.length + ' platform' + (validLinks.length !== 1 ? 's' : '') + ' scraped into a single source.</p>' +
          '<div class="grid grid-cols-3 gap-3 mb-6">' +
            '<div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"><div class="text-2xl font-bold text-white">' + validLinks.length + '</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Platforms</div></div>' +
            '<div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"><div class="text-2xl font-bold text-white">' + (result.imported || 0) + '</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Comments</div></div>' +
            '<div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]"><div class="text-2xl font-bold text-white">' + formatViews(result.totalViews || 0) + '</div><div class="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Views</div></div>' +
          '</div>' +
          '<div class="flex gap-2 justify-center">' +
            '<button class="btn-primary" onclick="Modal.hide(); document.querySelector(\'[data-page=dashboard]\').click();">Go to Dashboard</button>' +
            '<button class="btn-secondary" onclick="Modal.hide();">Close</button>' +
          '</div>' +
        '</div>'
      );
    } catch (err) {
      Modal.hideProcessing();
      this.logActivity('Multi-platform scrape failed: ' + err.message, 'error');
      Toast.error('Failed: ' + err.message);
    }

    btn.disabled = false;
    btn.innerHTML =
      '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>' +
      ' Scrape All Platforms';
  },


  // ─── Activity Log ────────────────────────────────────────────────────────

  logActivity(msg, level) {
    var logEl = document.getElementById('scraper-activity-log');
    var entries = document.getElementById('scraper-log-entries');
    logEl.classList.remove('hidden');

    var colors = { info: 'text-slate-400', success: 'text-emerald-400', warn: 'text-amber-400', error: 'text-red-400' };
    var icons = { info: '\u2022', success: '\u2713', warn: '\u26A0', error: '\u2717' };
    var lvl = level || 'info';
    var time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    var line = document.createElement('div');
    line.className = 'flex gap-2 leading-relaxed ' + (colors[lvl] || colors.info);
    line.innerHTML = '<span class="text-slate-600 flex-shrink-0">' + time + '</span>' +
      '<span class="flex-shrink-0">' + (icons[lvl] || icons.info) + '</span>' +
      '<span>' + escapeHtml(msg) + '</span>';
    entries.appendChild(line);
    entries.scrollTop = entries.scrollHeight;
  },

  clearLog() {
    document.getElementById('scraper-log-entries').innerHTML = '';
    document.getElementById('scraper-activity-log').classList.add('hidden');
  },

  // ─── Shared Progress ─────────────────────────────────────────────────────

  showProgress(text) {
    document.getElementById('scraper-progress').classList.remove('hidden');
    document.getElementById('scraper-progress-text').textContent = text;
    document.getElementById('scraper-progress-bar').style.width = '10%';
    this.logActivity(text);
  },
  setProgress(pct, text) {
    document.getElementById('scraper-progress-text').textContent = text;
    document.getElementById('scraper-progress-bar').style.width = pct + '%';
    this.logActivity(text);
  },
  hideProgress() {
    document.getElementById('scraper-progress').classList.add('hidden');
  },
};
