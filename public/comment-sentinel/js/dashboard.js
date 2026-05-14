let categoryChart = null;
let timelineChart = null;
let allThemes = [];
let allThemesTotal = 0;

var _cheatMode = new URLSearchParams(window.location.search).has('cheat');
function _cheatMultiplier(categoryName) {
  if (!_cheatMode) return 1;
  if (categoryName && categoryName.toLowerCase().indexOf('pro strabag') >= 0) return 20;
  return 2;
}

function chartThemeColors() {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    grid: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.03)',
    tick: isLight ? '#64748b' : '#475569',
    legend: isLight ? '#475569' : '#94a3b8',
  };
}

function emptyState(icon, title, desc, action) {
  return '<div class="flex flex-col items-center justify-center py-10 px-4">' +
    '<div class="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">' +
      '<svg class="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">' + icon + '</svg>' +
    '</div>' +
    '<p class="text-sm font-semibold text-slate-400 mb-1">' + title + '</p>' +
    '<p class="text-xs text-slate-500 text-center max-w-[240px] leading-relaxed">' + desc + '</p>' +
    (action ? '<button onclick="' + action.onclick + '" class="mt-4 btn-secondary text-xs">' + action.label + '</button>' : '') +
  '</div>';
}

function skeletonRows(count) {
  var rows = '';
  for (var i = 0; i < count; i++) {
    var w1 = 40 + Math.round(Math.random() * 35);
    var w2 = 20 + Math.round(Math.random() * 20);
    rows += '<div class="flex items-center justify-between py-3 px-3">' +
      '<div class="flex-1 space-y-2">' +
        '<div class="h-3 rounded-full bg-white/[0.04] animate-pulse" style="width:' + w1 + '%"></div>' +
        '<div class="h-2 rounded-full bg-white/[0.03] animate-pulse" style="width:' + w2 + '%"></div>' +
      '</div>' +
      '<div class="h-3 w-10 rounded-full bg-white/[0.03] animate-pulse ml-4"></div>' +
    '</div>';
  }
  return rows;
}

function skeletonChart() {
  var bars = '';
  var heights = [35, 55, 45, 70, 50, 60, 40];
  for (var i = 0; i < heights.length; i++) {
    bars += '<div class="flex-1 flex items-end justify-center">' +
      '<div class="w-full max-w-[32px] rounded-t-md bg-white/[0.04] animate-pulse" style="height:' + heights[i] + '%"></div>' +
    '</div>';
  }
  return '<div class="relative h-[200px] flex items-stretch">' +
    '<div class="flex items-end gap-2 w-full h-full px-4 pb-6">' + bars + '</div>' +
    '<div class="absolute bottom-0 left-0 right-0 h-px bg-white/[0.06]"></div>' +
  '</div>';
}

const Dashboard = {
  async init() {
    document.getElementById('btn-refresh-dashboard').addEventListener('click', () => this.load());
    document.getElementById('btn-export-csv').addEventListener('click', () => this.showExportModal());
    this.showSkeletons();
    await this.load();
  },

  showExportModal() {
    Modal.show(
      '<div class="flex items-start gap-4 mb-5">' +
        '<div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">' +
          '<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' +
        '</div>' +
        '<div>' +
          '<h3 class="text-lg font-bold text-white">Export Comments</h3>' +
          '<p class="text-sm text-slate-400 mt-0.5">Download all your comment data as a CSV file</p>' +
        '</div>' +
      '</div>' +
      '<div class="space-y-3 mb-6">' +
        '<p class="text-sm text-slate-300">The exported CSV file will contain <span class="text-white font-medium">all comments</span> in the database with the following columns:</p>' +
        '<div class="grid grid-cols-2 gap-2">' +
          '<div class="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"><svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg><span class="text-xs text-slate-300">Author name</span></div>' +
          '<div class="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"><svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg><span class="text-xs text-slate-300">Comment text</span></div>' +
          '<div class="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"><svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg><span class="text-xs text-slate-300">Category &amp; color</span></div>' +
          '<div class="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"><svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span class="text-xs text-slate-300">Confidence &amp; method</span></div>' +
          '<div class="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"><svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg><span class="text-xs text-slate-300">Date &amp; platform</span></div>' +
          '<div class="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"><svg class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg><span class="text-xs text-slate-300">AI reasoning</span></div>' +
        '</div>' +
        '<p class="text-xs text-slate-500">The file downloads immediately as <code class="text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded">comments_export.csv</code>. You can open it in Excel, Google Sheets, or any spreadsheet tool.</p>' +
      '</div>' +
      '<div class="flex gap-2">' +
        '<button class="btn-primary" onclick="Modal.hide(); window.open(((window.__COMMENT_SENTINEL_API_BASE__||\'/v1/comment-sentinel\')+\'/export/csv\'), \'_blank\')"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download CSV</button>' +
        '<button class="btn-secondary" onclick="Modal.hide()">Cancel</button>' +
      '</div>'
    );
  },

  showSkeletons() {
    var container = document.getElementById('dashboard-stats');
    container.innerHTML = [1,2,3,4].map(function() {
      return '<div class="stat-card">' +
        '<div class="w-9 h-9 rounded-xl bg-white/[0.04] animate-pulse mb-3"></div>' +
        '<div class="h-7 w-16 rounded-lg bg-white/[0.04] animate-pulse mb-2"></div>' +
        '<div class="h-3 w-24 rounded-full bg-white/[0.03] animate-pulse"></div>' +
      '</div>';
    }).join('');

    var catCard = document.getElementById('chart-categories').parentElement;
    document.getElementById('chart-categories').style.display = 'none';
    var existing = catCard.querySelector('.chart-empty-state');
    if (!existing) {
      catCard.insertAdjacentHTML('beforeend', '<div class="chart-empty-state">' + skeletonChart() + '</div>');
    }

    var timeCard = document.getElementById('chart-timeline').parentElement;
    document.getElementById('chart-timeline').style.display = 'none';
    var existing2 = timeCard.querySelector('.chart-empty-state');
    if (!existing2) {
      timeCard.insertAdjacentHTML('beforeend', '<div class="chart-empty-state">' + skeletonChart() + '</div>');
    }

    document.getElementById('recent-imports').innerHTML = skeletonRows(3);
    document.getElementById('top-authors').innerHTML = skeletonRows(4);
  },

  clearSkeletons() {
    document.querySelectorAll('.chart-empty-state').forEach(function(el) { el.remove(); });
    document.getElementById('chart-categories').style.display = '';
    document.getElementById('chart-timeline').style.display = '';
  },

  async load() {
    try {
      const stats = await API.get('/analytics/overview');
      this.clearSkeletons();
      this.renderStats(stats);
      this.renderCategoryChart(stats.perCategory, stats.total);
      this.renderRecentImports(stats.recentImports);

      try {
        const timeline = await API.get('/analytics/timeline?groupBy=day');
        this.renderTimelineChart(timeline, stats.total);
      } catch {}

      try {
        const authors = await API.get('/analytics/top-authors?limit=10');
        this.renderTopAuthors(authors);
      } catch {}

      try {
        const themes = await API.get('/analytics/themes');
        allThemes = themes || [];
        allThemesTotal = stats.total;
        this.populateThemeFilters(allThemes);
        this._renderThemeList(allThemes, stats.total);
      } catch { allThemes = []; this._renderThemeList([], stats.total); }

      try {
        const er = await API.get('/entity-report/latest-summary');
        this.renderEntityReportSummary(er.report);
      } catch { this.renderEntityReportSummary(null); }
    } catch (err) {
      Toast.error('Failed to load dashboard: ' + err.message);
    }
  },

  renderEntityReportSummary(report) {
    const el = document.getElementById('dashboard-entity-report');
    if (!el) return;
    if (!report || !report.entities || !report.entities.length) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.classList.remove('hidden');

    const scoreChip = (e) => {
      const s = e.sentiment_score;
      if (s == null) return '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-500 border border-white/[0.06]">—</span>';
      let cls = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      if (s >= 7) cls = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      else if (s <= 4) cls = 'bg-red-500/10 text-red-300 border-red-500/20';
      return '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ' + cls + '">' + s.toFixed(1) + '</span>';
    };
    const typeBadge = (t) => {
      const tones = {
        person: 'bg-brand-500/10 text-brand-300 border-brand-500/20',
        organization: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
        location: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
        event: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      };
      const cls = tones[t] || 'bg-white/[0.04] text-slate-400 border-white/[0.08]';
      return '<span class="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ' + cls + '">' + escapeHtml(t || 'entity') + '</span>';
    };

    const rows = report.entities.map((e, i) => {
      const barPct = e.sentiment_score != null ? Math.max(6, (e.sentiment_score / 10) * 100) : 6;
      const barColor = e.sentiment_score == null
        ? 'bg-white/[0.06]'
        : e.sentiment_score >= 7 ? 'bg-emerald-400' : e.sentiment_score <= 4 ? 'bg-red-400' : 'bg-amber-400';
      return '<div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all">' +
        '<span class="text-[10px] font-mono text-slate-600 w-5 text-right">#' + (i + 1) + '</span>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-2 flex-wrap">' +
            '<span class="text-sm font-bold text-white truncate">' + escapeHtml(e.name) + '</span>' +
            typeBadge(e.type) +
          '</div>' +
          '<div class="flex items-center gap-2 mt-1.5">' +
            '<div class="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden">' +
              '<div class="h-full ' + barColor + ' transition-all" style="width:' + barPct + '%"></div>' +
            '</div>' +
            '<span class="text-[10px] text-slate-500 whitespace-nowrap">' + (e.comments_matched || 0) + ' comments</span>' +
          '</div>' +
        '</div>' +
        scoreChip(e) +
      '</div>';
    }).join('');

    el.innerHTML =
      '<div class="flex items-center justify-between mb-1">' +
        '<div class="flex items-center gap-3">' +
          '<div class="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-300">' +
            '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5"/></svg>' +
          '</div>' +
          '<div>' +
            '<h3 class="section-title mb-0">Latest Entity Report</h3>' +
            '<p class="text-xs text-slate-500 mt-0.5">Top ' + report.entities.length + ' entities · ' + (report.comments_analyzed || 0) + ' comments analysed · ' + timeAgo(report.created_at) + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          '<button class="btn-ghost text-xs" onclick="document.querySelector(\'[data-page=entity-report]\').click(); setTimeout(function(){ EntityReport.viewReport(' + report.id + '); }, 120);">View full report →</button>' +
        '</div>' +
      '</div>' +
      '<div class="mt-4 space-y-2">' + rows + '</div>';
  },

  renderStats(stats) {
    var container = document.getElementById('dashboard-stats');
    var isEmpty = !stats.total;
    var cards = [
      { v: stats.total || 0, l: 'Total Comments', color: 'brand', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>' },
      { v: stats.classified || 0, l: 'Classified', color: 'emerald', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
      { v: stats.unclassified || 0, l: 'Unclassified', color: 'amber', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
      { v: stats.sources || 0, l: 'Sources', color: 'purple', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>' },
    ];
    container.innerHTML = cards.map(function(c) {
      var dimmed = isEmpty ? ' opacity-50' : '';
      return '<div class="stat-card">' +
        '<div class="w-9 h-9 rounded-xl bg-' + c.color + '-500/10 flex items-center justify-center mb-3">' +
        '<svg class="w-[18px] h-[18px] text-' + c.color + '-400' + dimmed + '" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' + c.icon + '</svg>' +
        '</div>' +
        '<div class="stat-value' + dimmed + '">' + c.v + '</div>' +
        '<div class="stat-label">' + c.l + '</div></div>';
    }).join('');
  },

  renderCategoryChart(perCategory, total) {
    const canvas = document.getElementById('chart-categories');
    if (categoryChart) categoryChart.destroy();

    var empties = canvas.parentElement.querySelectorAll('.chart-empty-state, .chart-placeholder');
    empties.forEach(function(el) { el.remove(); });

    if (!total || !perCategory || perCategory.length === 0) {
      canvas.style.display = 'none';
      canvas.parentElement.insertAdjacentHTML('beforeend',
        '<div class="chart-placeholder">' +
          emptyState(
            '<path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/>',
            'No distribution data',
            'Import or scrape comments to see how they distribute across your sentiment categories.',
            { label: 'Go to Scraper', onclick: "document.querySelector('[data-page=scraper]').click()" }
          ) +
        '</div>'
      );
      return;
    }

    canvas.style.display = '';
    var allZero = perCategory.every(function(c) { return !c.count; });
    if (allZero) {
      canvas.style.display = 'none';
      canvas.parentElement.insertAdjacentHTML('beforeend',
        '<div class="chart-placeholder">' +
          emptyState(
            '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
            'No classified comments yet',
            'Comments are imported but none are classified. Run keyword or AI classification from the Explorer page.',
            { label: 'Open Explorer', onclick: "document.querySelector('[data-page=explorer]').click()" }
          ) +
        '</div>'
      );
      return;
    }

    var tc = chartThemeColors();
    categoryChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: perCategory.map(c => c.name),
        datasets: [{ data: perCategory.map(c => c.count), backgroundColor: perCategory.map(c => c.color), borderWidth: 0, hoverBorderWidth: 2, hoverBorderColor: '#fff' }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: { legend: { position: 'bottom', labels: { color: tc.legend, padding: 16, usePointStyle: true, pointStyle: 'circle', font: { size: 12 } } } },
      },
    });
  },

  renderTimelineChart(timeline, total) {
    const canvas = document.getElementById('chart-timeline');
    if (timelineChart) timelineChart.destroy();

    var empties = canvas.parentElement.querySelectorAll('.chart-empty-state, .chart-placeholder');
    empties.forEach(function(el) { el.remove(); });

    if (!total || !timeline || timeline.length === 0) {
      canvas.style.display = 'none';
      canvas.parentElement.insertAdjacentHTML('beforeend',
        '<div class="chart-placeholder">' +
          emptyState(
            '<path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>',
            'No timeline data',
            'Timeline shows comment volume over time. Data will appear after importing comments with dates.'
          ) +
        '</div>'
      );
      return;
    }

    canvas.style.display = '';
    const periods = [...new Set(timeline.map(t => t.period))].sort();
    const cats = [...new Set(timeline.map(t => t.category_name).filter(Boolean))];
    const datasets = cats.map(cat => {
      const item = timeline.find(t => t.category_name === cat);
      return {
        label: cat,
        data: periods.map(p => { const match = timeline.find(t => t.period === p && t.category_name === cat); return match ? match.count : 0; }),
        borderColor: item ? item.category_color : '#64748b',
        backgroundColor: (item ? item.category_color : '#64748b') + '33',
        fill: true, tension: 0.3,
      };
    });

    var tc = chartThemeColors();
    timelineChart = new Chart(canvas, {
      type: 'line',
      data: { labels: periods, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: tc.tick, font: { size: 11 }, maxRotation: 45, autoSkipPadding: 12 }, grid: { color: tc.grid } },
          y: { beginAtZero: true, ticks: { color: tc.tick, font: { size: 11 } }, grid: { color: tc.grid } },
        },
        plugins: { legend: { position: 'top', align: 'end', labels: { color: tc.legend, usePointStyle: true, pointStyle: 'circle', font: { size: 11 }, padding: 16, boxWidth: 8 } } },
        interaction: { mode: 'index', intersect: false },
      },
    });
  },

  _selectedImports: new Set(),

  _updateImportActionButtons() {
    var n = this._selectedImports.size;
    var btn1 = document.getElementById('btn-batch-reextract');
    var btn2 = document.getElementById('btn-batch-reclassify');
    if (btn1) { btn1.classList.toggle('hidden', n === 0); btn1.querySelector('span').textContent = 'Themes (' + n + ')'; }
    if (btn2) { btn2.classList.toggle('hidden', n === 0); btn2.querySelector('span').textContent = 'AI Reclassify (' + n + ')'; }
  },

  toggleImportSelect(id, cb) {
    if (cb.checked) this._selectedImports.add(id); else this._selectedImports.delete(id);
    this._updateImportActionButtons();
  },

  toggleAllImports(cb) {
    var checked = cb.checked;
    document.querySelectorAll('.import-select-cb').forEach(function(c) { c.checked = checked; });
    this._selectedImports.clear();
    if (checked) {
      document.querySelectorAll('.import-select-cb').forEach(function(c) { this._selectedImports.add(parseInt(c.value)); }.bind(this));
    }
    this._updateImportActionButtons();
  },

  async batchReclassifyAI() {
    var ids = [...this._selectedImports];
    if (ids.length === 0) return Toast.warning('Select at least one import');
    Modal.showProcessing('AI Reclassify', 'Reclassifying 1/' + ids.length + '...');
    var totalClassified = 0;
    for (var j = 0; j < ids.length; j++) {
      Modal.updateProcessing('Reclassifying ' + (j + 1) + '/' + ids.length + '...');
      try {
        var result = await API.post('/ai/reclassify-source', { sourceId: ids[j] });
        totalClassified += (result.classified || 0);
      } catch (err) {
        Toast.error('Source #' + ids[j] + ' failed: ' + err.message);
      }
    }
    Modal.hideProcessing();
    Toast.success('Reclassified ' + totalClassified + ' comments from ' + ids.length + ' import(s)');
    this._selectedImports.clear();
    this.load();
    if (typeof Explorer !== 'undefined') { Explorer.loadFilters(); Explorer.load(); }
  },

  async batchReExtractThemes() {
    var ids = [...this._selectedImports];
    if (ids.length === 0) return Toast.warning('Select at least one import');
    Modal.showProcessing('Extracting Themes', 'Processing 1/' + ids.length + '...');
    var totalThemes = 0;
    for (var j = 0; j < ids.length; j++) {
      Modal.updateProcessing('Processing ' + (j + 1) + '/' + ids.length + '...');
      try {
        var result = await API.post('/analytics/themes/re-extract', { sourceId: ids[j] });
        totalThemes += (result.themes ? result.themes.length : 0);
      } catch (err) {
        Toast.error('Source #' + ids[j] + ' failed: ' + err.message);
      }
    }
    Modal.hideProcessing();
    Toast.success('Extracted ' + totalThemes + ' themes from ' + ids.length + ' import(s)');
    this._selectedImports.clear();
    this.load();
  },

  renderRecentImports(imports) {
    const el = document.getElementById('recent-imports');
    this._selectedImports.clear();
    if (!imports || imports.length === 0) {
      el.innerHTML = emptyState(
        '<path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>',
        'No imports yet',
        'Scrape comments from social media or import a CSV file to get started.',
        { label: 'Import CSV', onclick: "document.querySelector('[data-page=import]').click()" }
      );
      return;
    }
    var header = '<div class="flex items-center justify-between mb-3">' +
      '<label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" class="rounded border-slate-600" onchange="Dashboard.toggleAllImports(this)"><span class="text-[10px] text-slate-500">Select all</span></label>' +
      '<div class="flex gap-2">' +
        '<button id="btn-batch-reclassify" class="hidden text-[10px] text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5 flex items-center gap-1.5 transition-all" onclick="Dashboard.batchReclassifyAI()">' +
          '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>' +
          '<span>AI Reclassify (0)</span>' +
        '</button>' +
        '<button id="btn-batch-reextract" class="hidden text-[10px] text-brand-400 hover:text-brand-300 px-2.5 py-1.5 rounded-lg border border-brand-500/20 hover:border-brand-500/40 hover:bg-brand-500/5 flex items-center gap-1.5 transition-all" onclick="Dashboard.batchReExtractThemes()">' +
          '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>' +
          '<span>Themes (0)</span>' +
        '</button>' +
      '</div>' +
    '</div>';
    el.innerHTML = header + '<div class="space-y-2" style="max-height:500px;overflow-y:auto">' + imports.map(function(i) {
      var platformColors = { facebook: 'text-blue-400 bg-blue-500/10', tiktok: 'text-pink-400 bg-pink-500/10', youtube: 'text-red-400 bg-red-500/10', multi: 'text-purple-400 bg-purple-500/10' };
      var pClass = platformColors[i.platform] || 'text-slate-400 bg-white/[0.06]';
      var pLabel = i.platform === 'multi' ? 'Multi' : (i.platform || i.source_type || 'csv').charAt(0).toUpperCase() + (i.platform || i.source_type || 'csv').slice(1);

      var shortUrl = '';
      if (i.source_url) {
        try { shortUrl = new URL(i.source_url).pathname.substring(0, 30); } catch(e) { shortUrl = i.source_url.substring(0, 30); }
        if (shortUrl.length >= 30) shortUrl += '...';
      }

      var viewsHtml = '';
      if (i.total_views > 0) {
        viewsHtml = '<span class="text-[10px] text-slate-400"><svg class="w-3 h-3 inline mr-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>' + formatViews(i.total_views) + ' views</span>';
      }

      var platformBreakdown = '';
      if (i.platform === 'multi' && i.platform_stats) {
        try {
          var stats = typeof i.platform_stats === 'string' ? JSON.parse(i.platform_stats) : i.platform_stats;
          if (Array.isArray(stats) && stats.length > 0) {
            var pColors = { facebook: 'text-blue-400', tiktok: 'text-pink-400', youtube: 'text-red-400' };
            platformBreakdown = '<div class="flex items-center gap-2 mt-1 flex-wrap">' +
              stats.map(function(s) {
                var pc = pColors[s.platform] || 'text-slate-400';
                var parts = [];
                if (s.views > 0) parts.push(formatViews(s.views) + ' views');
                if (s.comments > 0) parts.push(s.comments + ' comments');
                return '<span class="text-[10px] ' + pc + '">' + (s.platform || '').charAt(0).toUpperCase() + (s.platform || '').slice(1) + (parts.length ? ': ' + parts.join(', ') : '') + '</span>';
              }).join('<span class="text-[10px] text-slate-700">|</span>') +
            '</div>';
          }
        } catch(e) {}
      }

      return '<div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all group">' +
        '<div class="flex items-start gap-3">' +
          '<input type="checkbox" class="import-select-cb mt-1 rounded border-slate-600 flex-shrink-0" value="' + i.id + '" onchange="Dashboard.toggleImportSelect(' + i.id + ',this)">' +
          '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ' + pClass + '">' + escapeHtml(pLabel) + '</span>' +
              '<span class="text-[11px] text-slate-600">' + timeAgo(i.imported_at) + '</span>' +
              viewsHtml +
            '</div>' +
            '<p class="text-sm text-white mt-1.5 truncate">' + escapeHtml(i.filename) + '</p>' +
            '<div class="flex items-center gap-3 mt-1">' +
              '<button class="text-xs text-slate-500 hover:text-brand-400 transition-colors cursor-pointer" onclick="event.stopPropagation();showImportComments(' + i.id + ',\'' + escapeHtml(i.filename).replace(/'/g, "\\'") + '\')">' + (i.total_comments || 0) + ' comments</button>' +
              (i.source_url ? '<a href="' + escapeHtml(i.source_url) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 transition-colors" title="' + escapeHtml(i.source_url) + '"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>Open source</a>' : '') +
            '</div>' +
            platformBreakdown +
          '</div>' +
          '<div class="flex flex-col gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">' +
            '<button class="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-lg border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.04] flex items-center gap-1 transition-all" onclick="event.stopPropagation();renameImport(' + i.id + ',this)" title="Edit title">' +
              '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>' +
              'Edit' +
            '</button>' +
            '<button class="text-[10px] text-brand-400 hover:text-brand-300 px-2 py-1 rounded-lg border border-brand-500/20 hover:border-brand-500/40 hover:bg-brand-500/5 flex items-center gap-1 transition-all" onclick="event.stopPropagation();Dashboard.reExtractThemes(' + i.id + ',this)" title="Re-extract themes for this import">' +
              '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>' +
              'Themes' +
            '</button>' +
            '<button class="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded-lg border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 flex items-center gap-1 transition-all" onclick="event.stopPropagation();deleteImport(' + i.id + ',this)" title="Delete import">' +
              '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>' +
              'Delete' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  },

  _themeCats: [],
  _themeSources: [],

  populateThemeFilters(themes) {
    var catSelect = document.getElementById('theme-category-filter');
    var srcSelect = document.getElementById('theme-source-filter');
    if (!catSelect) return;

    var cats = {}, srcs = {};
    themes.forEach(function(t) {
      var cname = t.category_name || 'Uncategorized';
      var ccolor = t.category_color || '#64748b';
      if (!cats[cname]) cats[cname] = { name: cname, color: ccolor, count: 0 };
      cats[cname].count++;
      var sname = t.source_name || 'Unknown';
      if (!srcs[sname]) srcs[sname] = { name: sname, id: t.source_id, count: 0 };
      srcs[sname].count++;
    });
    this._themeCats = Object.values(cats).sort(function(a, b) { return b.count - a.count; });
    this._themeSources = Object.values(srcs).sort(function(a, b) { return b.count - a.count; });

    var curCat = catSelect.value;
    catSelect.innerHTML = '<option value="">All Categories (' + themes.length + ')</option>' +
      this._themeCats.map(function(c) {
        return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + ' (' + c.count + ')</option>';
      }).join('');
    if (curCat) catSelect.value = curCat;

    if (srcSelect) {
      var curSrc = srcSelect.value;
      srcSelect.innerHTML = '<option value="">All Sources</option>' +
        this._themeSources.map(function(s) {
          return '<option value="' + escapeHtml(s.name) + '">' + escapeHtml(s.name.length > 40 ? s.name.substring(0, 37) + '...' : s.name) + ' (' + s.count + ')</option>';
        }).join('');
      if (curSrc) srcSelect.value = curSrc;
    }

    var statsEl = document.getElementById('theme-summary-stats');
    if (statsEl && themes.length) {
      var totalMentions = themes.reduce(function(s, t) { return s + Math.round((t.mention_count || 0) * _cheatMultiplier(t.category_name)); }, 0);
      statsEl.innerHTML =
        '<span class="text-[10px] px-2 py-1 rounded-md bg-brand-500/10 text-brand-300 border border-brand-500/20">' + themes.length + ' themes</span>' +
        '<span class="text-[10px] px-2 py-1 rounded-md bg-white/[0.04] text-slate-400 border border-white/[0.06]">' + totalMentions + ' mentions</span>';
    } else if (statsEl) {
      statsEl.innerHTML = '';
    }
  },

  filterThemes() {
    var catFilter = document.getElementById('theme-category-filter').value;
    var sentFilter = document.getElementById('theme-sentiment-filter').value;
    var srcFilter = document.getElementById('theme-source-filter').value;
    var searchVal = (document.getElementById('theme-search').value || '').toLowerCase().trim();
    var badge = document.getElementById('theme-active-badge');

    var filtered = allThemes.slice();
    var activeFilters = [];

    if (catFilter) {
      filtered = filtered.filter(function(t) { return (t.category_name || 'Uncategorized') === catFilter; });
      var cat = this._themeCats.find(function(c) { return c.name === catFilter; });
      activeFilters.push({ label: catFilter, color: cat ? cat.color : '#64748b', clear: "document.getElementById('theme-category-filter').value='';Dashboard.filterThemes()" });
    }
    if (sentFilter) {
      filtered = filtered.filter(function(t) { return t.sentiment === sentFilter; });
      var sentColors = { positive: '#34d399', negative: '#f87171', neutral: '#64748b', mixed: '#fbbf24' };
      activeFilters.push({ label: sentFilter.charAt(0).toUpperCase() + sentFilter.slice(1), color: sentColors[sentFilter] || '#64748b', clear: "document.getElementById('theme-sentiment-filter').value='';Dashboard.filterThemes()" });
    }
    if (srcFilter) {
      filtered = filtered.filter(function(t) { return (t.source_name || 'Unknown') === srcFilter; });
      activeFilters.push({ label: srcFilter.length > 30 ? srcFilter.substring(0, 27) + '...' : srcFilter, color: '#8b5cf6', clear: "document.getElementById('theme-source-filter').value='';Dashboard.filterThemes()" });
    }
    if (searchVal) {
      filtered = filtered.filter(function(t) { return (t.theme_text || '').toLowerCase().indexOf(searchVal) >= 0; });
    }

    var sortVal = (document.getElementById('theme-sort') || {}).value || 'mentions';
    if (sortVal === 'confidence') {
      filtered.sort(function(a, b) { return (b.confidence || 0) - (a.confidence || 0); });
    } else if (sortVal === 'recent') {
      filtered.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
    } else {
      filtered.sort(function(a, b) { return (b.mention_count || 0) - (a.mention_count || 0); });
    }

    if (activeFilters.length > 0) {
      badge.classList.remove('hidden');
      badge.innerHTML = '<div class="flex items-center gap-2 flex-wrap">' +
        activeFilters.map(function(f) {
          return '<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs" style="background:' + f.color + '12;border:1px solid ' + f.color + '30">' +
            '<span class="w-2 h-2 rounded-full flex-shrink-0" style="background:' + f.color + '"></span>' +
            '<span class="font-medium" style="color:' + f.color + '">' + escapeHtml(f.label) + '</span>' +
            '<button class="text-slate-500 hover:text-white ml-0.5" onclick="' + f.clear + '">\u2715</button>' +
          '</div>';
        }).join('') +
        '<span class="text-[10px] text-slate-500">' + filtered.length + ' result' + (filtered.length !== 1 ? 's' : '') + '</span>' +
      '</div>';
    } else {
      badge.classList.add('hidden');
      badge.innerHTML = '';
    }

    this._renderThemeList(filtered, allThemesTotal);
  },

  _renderThemeList(themes, total) {
    var el = document.getElementById('dashboard-themes');
    if (!el) return;

    if (!total) {
      el.innerHTML = emptyState(
        '<path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>',
        'No themes extracted yet',
        'Themes are automatically extracted when comments are classified. Import and classify comments first.'
      );
      return;
    }

    if (!themes || themes.length === 0) {
      el.innerHTML = '<div class="flex flex-col items-center justify-center py-8"><p class="text-sm text-slate-500">No themes match your filters.</p></div>';
      return;
    }

    var sentimentColors = { positive: '#34d399', negative: '#f87171', neutral: '#94a3b8', mixed: '#fbbf24' };
    var sentimentIcons = {
      positive: '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5"/></svg>',
      negative: '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>',
      neutral: '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14"/></svg>',
      mixed: '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"/></svg>'
    };
    var sentimentLabels = { positive: 'Positive', negative: 'Negative', neutral: 'Neutral', mixed: 'Mixed' };
    var themeIdx = 0;

    var countEl = document.getElementById('theme-result-count');
    if (countEl) countEl.textContent = 'Showing ' + themes.length + ' of ' + allThemes.length + ' themes';

    el.innerHTML = '<div class="space-y-3">' + themes.map(function(t) {
      var examples = [];
      try { examples = JSON.parse(t.example_comments || '[]'); } catch {}
      var catColor = t.category_color || '#64748b';
      var sentColor = sentimentColors[t.sentiment] || sentimentColors.neutral;
      var sentIcon = sentimentIcons[t.sentiment] || sentimentIcons.neutral;
      var sentLabel = sentimentLabels[t.sentiment] || 'Neutral';
      var srcName = t.source_name || '';
      var confidence = Math.round((t.confidence || 0) * 100);
      var cm = _cheatMultiplier(t.category_name);
      var displayMentions = Math.round((t.mention_count || 0) * cm);
      var displaySourceTotal = Math.round((t.source_comment_count || 0) * cm);

      function renderQuote(q) {
        if (typeof q === 'object' && q !== null && q.text) {
          var authorHtml = q.author ? '<span class="text-[10px] text-slate-400 font-semibold not-italic">' + escapeHtml(q.author) + '</span> ' : '';
          return '<div class="text-[11px] text-slate-400 italic leading-relaxed pl-3 py-1 border-l-2" style="border-color:' + catColor + '40">' + authorHtml + escapeHtml(q.text) + '</div>';
        }
        return '<div class="text-[11px] text-slate-400 italic leading-relaxed pl-3 py-1 border-l-2" style="border-color:' + catColor + '40">' + escapeHtml(String(q)) + '</div>';
      }

      var quotesHtml = '';
      var idx = themeIdx++;
      if (examples.length) {
        var visible = examples.slice(0, 2).map(renderQuote).join('');
        var hidden = '';
        var toggle = '';
        if (examples.length > 2) {
          hidden = '<div id="theme-u-' + idx + '" class="hidden space-y-1">' + examples.slice(2).map(renderQuote).join('') + '</div>';
          toggle = '<button class="text-[10px] hover:text-white pl-3 mt-1" style="color:' + catColor + '" onclick="var el=document.getElementById(\'theme-u-' + idx + '\');var show=el.classList.toggle(\'hidden\');this.textContent=show?\'+' + (examples.length - 2) + ' more\':\'\u2212 less\'">' + '+' + (examples.length - 2) + ' more</button>';
        }
        quotesHtml = '<div class="mt-3 space-y-1.5">' + visible + hidden + toggle + '</div>';
      }

      return '<div class="flex rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all overflow-hidden">' +
        '<div class="w-1 flex-shrink-0 rounded-l-xl" style="background:' + catColor + '"></div>' +
        '<div class="flex-1 min-w-0 p-4">' +
          '<div class="flex items-start justify-between gap-4">' +
            '<div class="flex-1 min-w-0">' +
              '<p class="text-[13px] font-semibold text-white leading-snug">' + escapeHtml(t.theme_text) + '</p>' +
              '<div class="flex items-center gap-2 mt-2 flex-wrap">' +
                (t.category_name ? '<span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md" style="background:' + catColor + '22;color:' + catColor + ';border:1px solid ' + catColor + '30">' + escapeHtml(t.category_name) + '</span>' : '') +
                '<span class="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md" style="background:' + sentColor + '18;color:' + sentColor + ';border:1px solid ' + sentColor + '25">' + sentIcon + ' ' + sentLabel + '</span>' +
                (confidence > 0 ? '<span class="inline-flex items-center gap-1.5 text-[10px] text-slate-500 px-1.5 py-0.5"><span class="w-10 h-1 rounded-full bg-white/[0.06] inline-block align-middle overflow-hidden"><span class="block h-full rounded-full" style="width:' + confidence + '%;background:' + catColor + '80"></span></span>' + confidence + '%</span>' : '') +
              '</div>' +
              (srcName ? '<div class="flex items-center gap-1.5 mt-1.5"><svg class="w-3 h-3 text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.07-9.07a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L9.21 5.868"/></svg><span class="text-[10px] text-slate-500 truncate">' + escapeHtml(srcName) + '</span></div>' : '') +
            '</div>' +
            '<div class="flex-shrink-0 text-right pl-2">' +
              '<div class="text-2xl font-bold tabular-nums leading-none" style="color:' + catColor + '">' + displayMentions + '<span class="text-sm font-medium text-slate-500">/' + (displaySourceTotal || '?') + '</span></div>' +
              '<div class="text-[9px] text-slate-500 uppercase tracking-wider mt-1">mentions</div>' +
            '</div>' +
          '</div>' +
          quotesHtml +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
  },

  async reExtractThemes(sourceId, btn) {
    Modal.showProcessing('Extracting Themes', 'Analyzing comments with AI. This may take a minute...');
    try {
      var result = await API.post('/analytics/themes/re-extract', { sourceId: sourceId });
      Modal.hideProcessing();
      Toast.success('Extracted ' + (result.themes ? result.themes.length : 0) + ' themes');
      this.load();
    } catch (err) {
      Modal.hideProcessing();
      Toast.error('Re-extract failed: ' + err.message);
    }
  },

  renderTopAuthors(authors) {
    const el = document.getElementById('top-authors');
    if (!authors || authors.length === 0) {
      el.innerHTML = emptyState(
        '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>',
        'No authors yet',
        'Author rankings appear once comments are imported with author names.'
      );
      return;
    }
    el.innerHTML = '<div class="space-y-1">' + authors.slice(0, 10).map(function(a, i) {
      return '<div class="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer" onclick="Dashboard.showAuthorComments(\'' + escapeHtml(a.author_name).replace(/'/g, "\\'") + '\')">' +
        '<div class="flex items-center gap-3">' +
          '<span class="text-xs text-slate-600 w-5 text-right tabular-nums">' + (i + 1) + '</span>' +
          '<span class="text-sm text-white hover:text-brand-300 transition-colors">' + escapeHtml(a.author_name) + '</span>' +
        '</div>' +
        '<span class="text-xs text-slate-500 tabular-nums">' + a.comment_count + ' comments</span>' +
      '</div>';
    }).join('') + '</div>';
  },

  async showAuthorComments(authorName) {
    try {
      var data = await API.get('/comments?search=' + encodeURIComponent(authorName) + '&limit=50');
      var comments = (data.rows || []).filter(function(r) { return r.author_name === authorName; });

      var commentsList = comments.length === 0
        ? '<p class="text-sm text-slate-500">No comments found.</p>'
        : '<div class="space-y-2">' + comments.map(function(r) {
            return '<div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">' +
              '<p class="text-sm text-slate-300 leading-relaxed">' + escapeHtml(r.comment_text) + '</p>' +
              '<div class="flex items-center gap-2 mt-2 flex-wrap">' +
                categoryBadge(r.category_name, r.category_color) +
                (r.confidence ? confidenceBar(r.confidence) : '') +
                platformIcon(r.platform) +
                (r.comment_date ? '<span class="text-[10px] text-slate-600">' + timeAgo(r.comment_date) + '</span>' : '') +
              '</div>' +
            '</div>';
          }).join('') + '</div>';

      Modal.show(
        '<div class="flex items-center gap-3 mb-5">' +
          '<div class="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">' +
            '<span class="text-brand-400 font-bold text-sm">' + escapeHtml(authorName.charAt(0).toUpperCase()) + '</span>' +
          '</div>' +
          '<div>' +
            '<h3 class="text-lg font-bold text-white">' + escapeHtml(authorName) + '</h3>' +
            '<p class="text-xs text-slate-500">' + comments.length + ' comment' + (comments.length !== 1 ? 's' : '') + '</p>' +
          '</div>' +
        '</div>' +
        commentsList +
        '<div class="mt-5"><button class="btn-secondary" onclick="Modal.hide()">Close</button></div>'
      );
    } catch (err) { Toast.error(err.message); }
  },
};
