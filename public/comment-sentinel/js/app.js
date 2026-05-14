var _importCommentsState = { sourceId: null, page: 1, limit: 20, total: 0, categories: [] };

async function showImportComments(sourceId, sourceName, page) {
  _importCommentsState.sourceId = sourceId;
  _importCommentsState.page = page || 1;

  if (!_importCommentsState.categories.length) {
    try { _importCommentsState.categories = await API.get('/categories'); } catch (e) {}
  }

  try {
    var data = await API.get('/comments?sourceId=' + sourceId + '&page=' + _importCommentsState.page + '&limit=' + _importCommentsState.limit);
    _importCommentsState.total = data.total;
    var totalPages = data.totalPages || 1;
    var cats = _importCommentsState.categories;

    var catOptions = '<option value="">— Unclassified —</option>' + cats.map(function(c) {
      return '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>';
    }).join('');

    var rows = (data.rows || []).map(function(r) {
      var catBadge = r.category_name
        ? '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded text-white" style="background:' + (r.category_color || '#64748b') + '">' + escapeHtml(r.category_name) + '</span>'
        : '<span class="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">Unclassified</span>';
      return '<div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">' +
        '<p class="text-sm text-slate-300 leading-relaxed">' + escapeHtml(r.comment_text) + '</p>' +
        '<div class="flex items-center justify-between mt-2 gap-2 flex-wrap">' +
          '<div class="flex items-center gap-2">' +
            (r.author_name ? '<span class="text-[10px] text-slate-500">' + escapeHtml(r.author_name) + '</span>' : '') +
            catBadge +
            (r.confidence ? '<span class="text-[10px] text-slate-600">' + Math.round(r.confidence * 100) + '%</span>' : '') +
            (r.comment_date ? '<span class="text-[10px] text-slate-600">' + timeAgo(r.comment_date) + '</span>' : '') +
          '</div>' +
          '<select class="bg-white/[0.03] border border-white/[0.08] rounded-lg text-[10px] text-slate-300 px-2 py-1 cursor-pointer" onchange="reassignComment(\'' + r.id + '\',this.value,this)" data-current="' + (r.category_id || '') + '">' +
            catOptions.replace('value="' + (r.category_id || '') + '"', 'value="' + (r.category_id || '') + '" selected') +
          '</select>' +
        '</div>' +
      '</div>';
    }).join('');

    var prevDisabled = _importCommentsState.page <= 1 ? ' opacity-30 pointer-events-none' : '';
    var nextDisabled = _importCommentsState.page >= totalPages ? ' opacity-30 pointer-events-none' : '';

    var pagination = '<div class="flex items-center justify-between mt-4">' +
      '<button class="btn-ghost text-xs' + prevDisabled + '" onclick="showImportComments(\'' + sourceId + '\',\'' + escapeHtml(sourceName).replace(/'/g, "\\'") + '\',' + (_importCommentsState.page - 1) + ')">' +
        '<svg class="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>Previous' +
      '</button>' +
      '<span class="text-xs text-slate-500">Page ' + _importCommentsState.page + ' of ' + totalPages + ' (' + data.total + ' comments)</span>' +
      '<button class="btn-ghost text-xs' + nextDisabled + '" onclick="showImportComments(\'' + sourceId + '\',\'' + escapeHtml(sourceName).replace(/'/g, "\\'") + '\',' + (_importCommentsState.page + 1) + ')">' +
        'Next<svg class="w-3.5 h-3.5 inline ml-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>' +
      '</button>' +
    '</div>';

    Modal.show(
      '<div class="flex items-center justify-between mb-4">' +
        '<div>' +
          '<h3 class="text-lg font-bold text-white">' + escapeHtml(sourceName) + '</h3>' +
          '<p class="text-xs text-slate-500 mt-0.5">' + data.total + ' comments &middot; Use dropdowns to reclassify</p>' +
        '</div>' +
        '<button class="btn-ghost text-xs" onclick="Modal.hide()">Close</button>' +
      '</div>' +
      '<div class="space-y-2" style="max-height:60vh;overflow-y:auto">' + (rows || '<p class="text-sm text-slate-500 py-4 text-center">No comments found.</p>') + '</div>' +
      pagination
    );
  } catch (err) { Toast.error('Failed to load comments: ' + err.message); }
}

async function reassignComment(commentId, categoryId, selectEl) {
  try {
    var catId = categoryId ? categoryId : null;
    await API.put('/comments/' + commentId + '/category', { categoryId: catId });
    var badge = selectEl.closest('.p-3').querySelector('[class*="font-semibold"], .text-slate-400');
    if (badge && categoryId) {
      var cat = _importCommentsState.categories.find(function(c) { return String(c.id) === String(categoryId); });
      if (cat) {
        badge.textContent = cat.name;
        badge.style.background = cat.color;
        badge.className = 'text-[10px] font-semibold px-1.5 py-0.5 rounded text-white';
      }
    } else if (badge && !categoryId) {
      badge.textContent = 'Unclassified';
      badge.style.background = '';
      badge.className = 'text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400';
    }
  } catch (err) { Toast.error('Failed to update: ' + err.message); }
}

async function deleteImport(id, btn) {
  if (!confirm('Delete this import and ALL its comments and themes? This cannot be undone.')) return;
  try {
    await API.del('/import/' + id);
    var row = btn.closest('[class*="rounded-xl"]');
    if (row) row.remove();
    Toast.success('Import deleted');
    if (typeof Dashboard !== 'undefined') Dashboard.load();
    if (typeof loadHomePage === 'function') loadHomePage();
  } catch (err) { Toast.error('Failed to delete: ' + err.message); }
}

async function renameImport(id, btn) {
  var row = btn.closest('[class*="rounded-xl"]');
  var nameEl = row ? row.querySelector('.text-sm.text-white') : null;
  var current = nameEl ? nameEl.textContent.trim() : '';
  var newName = prompt('Edit import title:', current);
  if (newName === null || newName.trim() === '' || newName.trim() === current) return;
  try {
    await API.patch('/import/' + id, { filename: newName.trim() });
    if (nameEl) nameEl.textContent = newName.trim();
    Toast.success('Title updated');
  } catch (err) { Toast.error('Failed to rename: ' + err.message); }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var sun = document.getElementById('theme-icon-sun');
  var moon = document.getElementById('theme-icon-moon');
  if (sun && moon) {
    sun.classList.toggle('hidden', theme === 'light');
    moon.classList.toggle('hidden', theme === 'dark');
  }
}

function toggleTheme() {
  var current = document.documentElement.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('cs-theme', next);
  applyTheme(next);
  if (typeof Dashboard !== 'undefined') Dashboard.load();
}

function applySidebarState(collapsed) {
  var sidebar = document.getElementById('sidebar');
  var main = document.getElementById('main-content');
  var collapseIcon = document.getElementById('sidebar-collapse-icon');
  var expandIcon = document.getElementById('sidebar-expand-icon');

  if (!sidebar || !main) return;

  var toggleBtn = document.getElementById('btn-sidebar-toggle');

  if (collapsed) {
    sidebar.classList.add('collapsed');
    main.classList.add('sidebar-collapsed');
    if (collapseIcon) collapseIcon.classList.add('hidden');
    if (expandIcon) expandIcon.classList.remove('hidden');
    if (toggleBtn) toggleBtn.title = 'Expand sidebar';
  } else {
    sidebar.classList.remove('collapsed');
    main.classList.remove('sidebar-collapsed');
    if (collapseIcon) collapseIcon.classList.remove('hidden');
    if (expandIcon) expandIcon.classList.add('hidden');
    if (toggleBtn) toggleBtn.title = 'Collapse sidebar';
  }
}

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  var isCollapsed = sidebar && sidebar.classList.contains('collapsed');
  localStorage.setItem('cs-sidebar-collapsed', !isCollapsed);
  applySidebarState(!isCollapsed);
}

document.addEventListener('DOMContentLoaded', async function() {
  applyTheme(localStorage.getItem('cs-theme') || 'dark');
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  applySidebarState(localStorage.getItem('cs-sidebar-collapsed') === 'true');
  document.documentElement.classList.remove('sidebar-init-collapsed');
  document.getElementById('btn-sidebar-toggle').addEventListener('click', toggleSidebar);

  var IS_EMBEDDED = document.documentElement.classList.contains('cs-embedded');

  // Hide sections requested by the host (e.g. admin-only tabs for non-admins).
  try {
    var hideParam = new URL(window.location.href).searchParams.get('hide') || '';
    if (hideParam) {
      hideParam.split(',').forEach(function(name) {
        var key = name.trim();
        if (!key) return;
        var nav = document.querySelector('#main-nav [data-page="' + key + '"]');
        if (nav) nav.style.display = 'none';
        var pg = document.getElementById('page-' + key);
        if (pg) pg.classList.add('cs-hidden-page');
      });
    }
  } catch (_) { /* ignore */ }

  function postToParent(page) {
    if (!IS_EMBEDDED || window.parent === window) return;
    try { window.parent.postMessage({ type: 'cs:page', page: page }, '*'); } catch (_) {}
  }

  function navigateTo(page) {
    document.querySelectorAll('.page-container').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('#main-nav .nav-link').forEach(function(l) { l.classList.remove('active'); });
    var pageEl = document.getElementById('page-' + page);
    var navEl = document.querySelector('#main-nav [data-page="' + page + '"]');
    if (pageEl) pageEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
    if (!IS_EMBEDDED) localStorage.setItem('cs-active-page', page);
    postToParent(page);
  }
  window.csNavigateTo = navigateTo;

  document.querySelectorAll('#main-nav .nav-link[data-page]').forEach(function(link) {
    link.addEventListener('click', function() {
      navigateTo(this.dataset.page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }.bind(link));
  });

  // Parent → iframe navigation.
  window.addEventListener('message', function(ev) {
    var d = ev && ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'cs:navigate' && typeof d.page === 'string') {
      navigateTo(d.page);
    }
  });

  if (IS_EMBEDDED) {
    try {
      var initial = new URL(window.location.href).searchParams.get('page');
      if (initial && document.getElementById('page-' + initial)) {
        navigateTo(initial);
      } else {
        postToParent('home');
      }
    } catch (_) { /* ignore */ }
  } else {
    var savedPage = localStorage.getItem('cs-active-page');
    if (savedPage && document.getElementById('page-' + savedPage)) {
      navigateTo(savedPage);
    }
  }

  try {
    var aiStatus = await API.get('/ai/status');
    var badge = document.getElementById('ai-status-badge');
    if (aiStatus.configured) {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span><span class="sidebar-text">AI Connected</span><span class="sidebar-text text-slate-600">&middot;</span><span class="sidebar-text text-slate-500">' + aiStatus.model + '</span>';
      badge.className = 'flex items-center gap-2 text-[11px] text-emerald-400';
    } else {
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span><span class="sidebar-text">AI not configured</span>';
      badge.className = 'flex items-center gap-2 text-[11px] text-amber-400';
    }
  } catch {
    var badge2 = document.getElementById('ai-status-badge');
    badge2.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"></span><span class="sidebar-text">AI Error</span>';
    badge2.className = 'flex items-center gap-2 text-[11px] text-red-400';
  }

  await Dashboard.init();
  Scraper.init();
  await Explorer.init();
  await Training.init();
  Importer.init();
  await Settings.init();
  await Keys.init();
  await EntityReport.init();

  loadHomePage();
});

async function loadHomePage() {
  try {
    var stats = await API.get('/analytics/overview');

    var inlineEl = document.getElementById('home-stats-inline');
    if (inlineEl) {
      if (stats.total) {
        var items = [
          { v: stats.total || 0, l: 'Comments' },
          { v: stats.classified || 0, l: 'Classified' },
          { v: stats.sources || 0, l: 'Sources' },
        ];
        inlineEl.innerHTML = items.map(function(it) {
          return '<div class="flex items-center gap-2"><span class="text-2xl font-extrabold text-white">' + it.v + '</span><span class="text-xs text-slate-500 uppercase tracking-wider font-medium">' + it.l + '</span></div>';
        }).join('<div class="w-px h-6 bg-white/[0.08]"></div>');
      } else {
        inlineEl.innerHTML = '';
      }
    }

    var overviewEl = document.getElementById('home-overview');
    if (overviewEl) {
      if (!stats.total) {
        overviewEl.innerHTML = '<div class="col-span-full card text-center py-8 px-6">' +
          '<div class="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-4">' +
            '<svg class="w-7 h-7 text-brand-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>' +
          '</div>' +
          '<h3 class="text-white font-bold text-lg mb-2">Get started in 3 steps</h3>' +
          '<div class="flex flex-col sm:flex-row items-center justify-center gap-3 mt-5">' +
            '<div class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">' +
              '<span class="w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-xs font-bold">1</span>' +
              '<span class="text-sm text-slate-300">Configure categories</span>' +
            '</div>' +
            '<svg class="w-4 h-4 text-slate-600 rotate-90 sm:rotate-0 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>' +
            '<div class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">' +
              '<span class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xs font-bold">2</span>' +
              '<span class="text-sm text-slate-300">Import or scrape comments</span>' +
            '</div>' +
            '<svg class="w-4 h-4 text-slate-600 rotate-90 sm:rotate-0 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>' +
            '<div class="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">' +
              '<span class="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-xs font-bold">3</span>' +
              '<span class="text-sm text-slate-300">Classify & analyze</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      } else {
        var cards = [
          { v: stats.total || 0, l: 'Total Comments', color: 'brand', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>' },
          { v: stats.classified || 0, l: 'Classified', color: 'emerald', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
          { v: stats.unclassified || 0, l: 'Unclassified', color: 'amber', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
          { v: stats.sources || 0, l: 'Sources', color: 'purple', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>' },
        ];
        overviewEl.innerHTML = cards.map(function(c) {
          return '<div class="stat-card">' +
            '<div class="w-9 h-9 rounded-xl bg-' + c.color + '-500/10 flex items-center justify-center mb-3">' +
            '<svg class="w-[18px] h-[18px] text-' + c.color + '-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' + c.icon + '</svg>' +
            '</div>' +
            '<div class="stat-value">' + c.v + '</div>' +
            '<div class="stat-label">' + c.l + '</div>' +
            '</div>';
        }).join('');
      }
    }

    var recentEl = document.getElementById('home-recent-imports');
    if (recentEl) {
      if (!stats.recentImports || stats.recentImports.length === 0) {
        recentEl.innerHTML = emptyState(
          '<path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>',
          'No imports yet',
          'Scrape comments from social media or import a CSV to get started.'
        );
      } else {
        recentEl.innerHTML = '<div class="space-y-2">' + stats.recentImports.map(function(s) {
          var platformColors = { facebook: 'text-blue-400 bg-blue-500/10', tiktok: 'text-pink-400 bg-pink-500/10', youtube: 'text-red-400 bg-red-500/10', multi: 'text-purple-400 bg-purple-500/10' };
          var pClass = platformColors[s.platform] || 'text-slate-400 bg-white/[0.06]';
          var pLabel = (s.platform || s.source_type || 'csv').charAt(0).toUpperCase() + (s.platform || s.source_type || 'csv').slice(1);
          return '<div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all group">' +
            '<div class="flex items-start gap-3">' +
              '<div class="flex-1 min-w-0">' +
                '<div class="flex items-center gap-2">' +
                  '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ' + pClass + '">' + escapeHtml(pLabel) + '</span>' +
                  '<span class="text-[11px] text-slate-600">' + timeAgo(s.imported_at) + '</span>' +
                  (s.total_views > 0 ? '<span class="text-[10px] text-slate-400"><svg class="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>' + formatViews(s.total_views) + '</span>' : '') +
                '</div>' +
                '<p class="text-sm text-white mt-1.5 truncate">' + escapeHtml(s.filename) + '</p>' +
                '<div class="flex items-center gap-3 mt-1">' +
                  '<button class="text-xs text-slate-500 hover:text-brand-400 transition-colors cursor-pointer" onclick="event.stopPropagation();showImportComments(\'' + s.id + '\',\'' + escapeHtml(s.filename).replace(/'/g, "\\'") + '\')">' + (s.total_comments || 0) + ' comments</button>' +
                  (s.source_url ? '<a href="' + escapeHtml(s.source_url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 transition-colors"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>Open source</a>' : '') +
                '</div>' +
              '</div>' +
              '<div class="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">' +
                '<button class="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-lg border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] flex items-center gap-1 transition-all" onclick="event.stopPropagation();renameImport(\'' + s.id + '\',this)" title="Edit title">' +
                  '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>' +
                  'Edit' +
                '</button>' +
                '<button class="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded-lg border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 flex items-center gap-1 transition-all" onclick="event.stopPropagation();deleteImport(\'' + s.id + '\',this)" title="Delete import">' +
                  '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>' +
                  'Delete' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>';
      }
    }

    var catsEl = document.getElementById('home-categories');
    if (catsEl) {
      if (!stats.perCategory || stats.perCategory.length === 0) {
        catsEl.innerHTML = emptyState(
          '<path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>',
          'No categories defined',
          'Go to Settings to define sentiment categories like Positive, Negative, Neutral.',
          { label: 'Open Settings', onclick: "document.querySelector('[data-page=settings]').click()" }
        );
      } else {
        var total = stats.perCategory.reduce(function(a, c) { return a + (c.count || 0); }, 0) || 1;
        catsEl.innerHTML = '<div class="space-y-3">' + stats.perCategory.map(function(c) {
          var pct = Math.round(((c.count || 0) / total) * 100);
          return '<div>' +
            '<div class="flex items-center justify-between mb-1.5">' +
            '<div class="flex items-center gap-2"><div class="w-2.5 h-2.5 rounded-full" style="background:' + c.color + '"></div><span class="text-sm text-white font-medium">' + escapeHtml(c.name) + '</span></div>' +
            '<span class="text-xs text-slate-500 tabular-nums cursor-default" title="' + (c.count || 0) + ' comments">' + pct + '%</span>' +
            '</div>' +
            '<div class="w-full bg-white/[0.04] rounded-full h-1.5"><div class="h-1.5 rounded-full transition-all duration-500" style="width:' + pct + '%;background:' + c.color + '"></div></div>' +
            '</div>';
        }).join('') + '</div>';
      }
    }
  } catch {}
}
