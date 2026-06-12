const EntityReport = {
  state: {
    accounts: { fb_account: '', tt_account: '', yt_account: '' },
    reports: [],
    currentReport: null,
    running: false,
  },

  async init() {
    document.getElementById('btn-save-er-accounts').addEventListener('click', () => this.saveAccounts());
    document.getElementById('btn-run-er-report').addEventListener('click', () => this.runReport());
    document.getElementById('btn-refresh-er-history').addEventListener('click', () => this.loadReports());
    document.getElementById('er-schedule-enabled').addEventListener('change', () => this.saveSchedule());
    document.getElementById('er-schedule-time').addEventListener('change', () => this.saveSchedule());
    ['er-fb-account', 'er-tt-account', 'er-yt-account'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => this.updateRunButton());
    });
    await this.loadAccounts();
    await this.loadSchedule();
    await this.loadReports();
    this.resumeRunLogIfRunning();
  },

  // If the server is mid-run when the page loads (e.g. user refreshed during a
  // long scheduled run), pop the live log open and subscribe to the stream.
  async resumeRunLogIfRunning() {
    try {
      const snap = await API.get('/entity-report/run/progress/snapshot');
      if (!snap.running) return;
      this.state.running = true;
      const runBtn = document.getElementById('btn-run-er-report');
      if (runBtn) runBtn.classList.add('opacity-50', 'pointer-events-none');
      this.openRunLog();
      if (snap.runStartedAt) this._runLogStartedAt = snap.runStartedAt;
    } catch {}
  },

  async loadSchedule() {
    try {
      const data = await API.get('/entity-report/schedule');
      document.getElementById('er-schedule-enabled').checked = !!data.enabled;
      document.getElementById('er-schedule-time').value = data.time || '';
      this.renderScheduleStatus(data);
    } catch (err) {
      Toast.error('Failed to load schedule: ' + err.message);
    }
  },

  renderScheduleStatus(data) {
    const el = document.getElementById('er-schedule-status');
    const card = document.getElementById('er-schedule-card');
    if (!el) return;

    let html = '';
    if (data.run_in_flight) {
      html = '<span class="inline-flex items-center gap-1.5 text-amber-300"><svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg> Run in progress…</span>';
    } else if (data.enabled && data.time) {
      const next = nextRunDescriptor(data.time);
      html = '<span class="inline-flex items-center gap-1.5 text-emerald-300"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Next run <span class="text-white font-semibold">' + escapeHtml(data.time) + '</span> <span class="text-slate-500">·</span> <span class="text-slate-400">' + escapeHtml(next) + '</span></span>';
    } else if (data.time) {
      html = '<span class="text-slate-500">Toggle on to run daily at ' + escapeHtml(data.time) + '. Skips videos already analysed in previous runs.</span>';
    } else {
      html = '<span class="text-slate-500">Pick a time and toggle on to auto-generate a report each day.</span>';
    }
    if (data.last_fired_at) {
      html += ' <span class="text-slate-600">·</span> <span class="text-slate-500">last fired ' + timeAgo(data.last_fired_at) + '</span>';
    }
    el.innerHTML = html;

    if (card) {
      card.classList.toggle('border-brand-500/20', !!data.enabled);
      card.classList.toggle('bg-brand-500/[0.04]', !!data.enabled);
    }
  },

  async saveSchedule() {
    const enabled = document.getElementById('er-schedule-enabled').checked;
    const time = document.getElementById('er-schedule-time').value.trim();
    if (enabled && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      Toast.warning('Pick a time before enabling the schedule');
      document.getElementById('er-schedule-enabled').checked = false;
      return;
    }
    try {
      const res = await API.put('/entity-report/schedule', { enabled, time });
      this.renderScheduleStatus({
        enabled: !!res.enabled,
        time: res.time || time,
        run_in_flight: res.run_in_flight,
        last_fired_at: res.last_fired_at,
      });
      Toast.success(enabled ? 'Schedule enabled' : 'Schedule updated');
    } catch (err) {
      Toast.error('Save schedule failed: ' + err.message);
      await this.loadSchedule();
    }
  },

  async loadAccounts() {
    try {
      const data = await API.get('/entity-report/accounts');
      this.state.accounts = {
        fb_account: data.fb_account || '',
        tt_account: data.tt_account || '',
        yt_account: data.yt_account || '',
      };
      document.getElementById('er-fb-account').value = this.state.accounts.fb_account;
      document.getElementById('er-tt-account').value = this.state.accounts.tt_account;
      document.getElementById('er-yt-account').value = this.state.accounts.yt_account;
      this.updateRunButton();
    } catch (err) {
      Toast.error('Failed to load accounts: ' + err.message);
    }
  },

  updateRunButton() {
    const fb = document.getElementById('er-fb-account').value.trim();
    const tt = document.getElementById('er-tt-account').value.trim();
    const yt = document.getElementById('er-yt-account').value.trim();
    const btn = document.getElementById('btn-run-er-report');
    const anyConfigured = !!(fb || tt || yt);
    if (anyConfigured) {
      btn.classList.remove('opacity-50', 'pointer-events-none');
    } else {
      btn.classList.add('opacity-50', 'pointer-events-none');
    }
    this.renderAccountStatus({ fb, tt, yt });
  },

  renderAccountStatus({ fb, tt, yt }) {
    const setBadge = (id, configured, accent) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (configured) {
        el.textContent = 'Active';
        el.className = 'text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ' + accent;
      } else {
        el.textContent = 'Not set';
        el.className = 'text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-500 border border-white/[0.06]';
      }
    };
    setBadge('er-fb-status', !!fb, 'bg-blue-500/15 text-blue-300 border-blue-400/30');
    setBadge('er-tt-status', !!tt, 'bg-pink-500/15 text-pink-300 border-pink-400/30');
    setBadge('er-yt-status', !!yt, 'bg-red-500/15 text-red-300 border-red-400/30');

    const summary = document.getElementById('er-account-summary');
    if (summary) {
      const n = [fb, tt, yt].filter(Boolean).length;
      summary.innerHTML = n === 3
        ? '<span class="inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span><span class="text-emerald-300 font-semibold">All 3 platforms configured</span></span>'
        : n > 0
          ? '<span class="text-slate-400">' + n + ' of 3 platforms configured</span>'
          : '<span class="text-slate-500">Configure at least one platform to generate a report</span>';
    }
  },

  async saveAccounts() {
    const fb = document.getElementById('er-fb-account').value.trim();
    const tt = document.getElementById('er-tt-account').value.trim();
    const yt = document.getElementById('er-yt-account').value.trim();
    try {
      await API.put('/entity-report/accounts', { fb_account: fb, tt_account: tt, yt_account: yt });
      this.state.accounts = { fb_account: fb, tt_account: tt, yt_account: yt };
      Toast.success('Accounts saved');
      this.updateRunButton();
    } catch (err) {
      Toast.error('Save failed: ' + err.message);
    }
  },

  async runReport() {
    if (this.state.running) return;
    const fb = document.getElementById('er-fb-account').value.trim();
    const tt = document.getElementById('er-tt-account').value.trim();
    const yt = document.getElementById('er-yt-account').value.trim();
    if (!fb && !tt && !yt) {
      Toast.warning('Configure at least one account first');
      return;
    }

    if (fb !== this.state.accounts.fb_account || tt !== this.state.accounts.tt_account || yt !== this.state.accounts.yt_account) {
      try { await API.put('/entity-report/accounts', { fb_account: fb, tt_account: tt, yt_account: yt }); this.state.accounts = { fb_account: fb, tt_account: tt, yt_account: yt }; }
      catch (err) { Toast.error('Save failed: ' + err.message); return; }
    }

    this.state.running = true;
    const runBtn = document.getElementById('btn-run-er-report');
    if (runBtn) { runBtn.classList.add('opacity-50', 'pointer-events-none'); }
    this.openRunLog();

    try {
      const data = await API.post('/entity-report/run', { fb_account: fb, tt_account: tt, yt_account: yt });
      this.finishRunLog('complete', 'Report generated (' + (data.entities || []).length + ' entities)');
      Toast.success('Report generated (' + (data.entities || []).length + ' entities)');
      this.state.running = false;
      this.updateRunButton();
      await this.loadReports();
      if (data.reportId) {
        await this.viewReport(data.reportId);
      }
    } catch (err) {
      this.finishRunLog('failed', 'Run failed: ' + err.message);
      this.state.running = false;
      this.updateRunButton();
      Toast.error('Run failed: ' + err.message);
      await this.loadReports();
    }
  },

  // ─── Live run log (SSE) ─────────────────────────────────────────────────────

  openRunLog() {
    const panel = document.getElementById('er-run-log');
    const stream = document.getElementById('er-run-log-stream');
    const icon = document.getElementById('er-run-log-icon');
    const title = document.getElementById('er-run-log-title');
    const subtitle = document.getElementById('er-run-log-subtitle');
    panel.classList.remove('hidden');
    panel.classList.remove('border-emerald-500/20', 'bg-emerald-500/[0.04]', 'border-red-500/20', 'bg-red-500/[0.04]');
    panel.classList.add('border-brand-500/20', 'bg-brand-500/[0.03]');
    icon.classList.add('animate-spin');
    icon.classList.remove('text-emerald-300', 'text-red-300');
    icon.classList.add('text-brand-300');
    title.textContent = 'Generating report…';
    subtitle.textContent = 'Live progress from the scraping and analysis pipeline.';
    stream.innerHTML = '';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (this._runLogEs) { try { this._runLogEs.close(); } catch {} this._runLogEs = null; }
    if (this._runLogTimer) { clearInterval(this._runLogTimer); this._runLogTimer = null; }

    this._runLogStartedAt = Date.now();
    this._runLogSeen = new Set();
    this._runLogFinalized = false;
    document.getElementById('er-run-log-elapsed').textContent = '0s';
    this._runLogTimer = setInterval(() => {
      const s = Math.round((Date.now() - this._runLogStartedAt) / 1000);
      const el = document.getElementById('er-run-log-elapsed');
      if (!el) return;
      el.textContent = s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    }, 1000);

    try {
      var _csBase = (typeof window !== 'undefined' && window.__COMMENT_SENTINEL_API_BASE__) || '/v1/comment-sentinel';
      var _esUrl = _csBase + '/entity-report/run/progress';
      var es = _csBase.indexOf('http') === 0
        ? new EventSource(_esUrl, { withCredentials: true })
        : new EventSource(_esUrl);
      this._runLogEs = es;
      es.onmessage = (ev) => {
        try { this.appendRunLogEvent(JSON.parse(ev.data)); } catch {}
      };
      es.onerror = () => { /* keep open; browser auto-reconnects */ };
    } catch (err) {
      this.appendRunLogEvent({ level: 'warn', msg: 'Live progress stream unavailable: ' + err.message });
    }
  },

  appendRunLogEvent(evt) {
    if (!evt || evt.level === 'snapshot') return;
    const stream = document.getElementById('er-run-log-stream');
    if (!stream) return;

    // Dedup by ts+msg (snapshot replay + live stream can overlap)
    const sig = (evt.ts || 0) + '|' + (evt.msg || '');
    if (this._runLogSeen && this._runLogSeen.has(sig)) return;
    if (this._runLogSeen) this._runLogSeen.add(sig);

    if (evt.level === 'start' && this._runLogStartedAt) {
      this._runLogStartedAt = evt.ts || Date.now();
    }

    // After a page refresh mid-run, the HTTP POST that originally launched the
    // run is gone, so the SSE channel is the only thing that can transition
    // the UI out of "running" state when the server emits done/error.
    if (evt.level === 'done' || evt.level === 'error') {
      this._runLogFinalize(evt);
    }

    const t = new Date(evt.ts || Date.now());
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    const stamp = hh + ':' + mm + ':' + ss;

    let dot = 'bg-slate-500';
    let textCls = 'text-slate-300';
    if (evt.level === 'warn') { dot = 'bg-amber-400'; textCls = 'text-amber-200'; }
    else if (evt.level === 'error') { dot = 'bg-red-400'; textCls = 'text-red-200'; }
    else if (evt.level === 'done') { dot = 'bg-emerald-400'; textCls = 'text-emerald-200'; }
    else if (evt.level === 'start') { dot = 'bg-brand-400'; textCls = 'text-brand-200'; }
    else if (evt.level === 'info') { dot = 'bg-brand-400/70'; textCls = 'text-slate-300'; }

    const line = document.createElement('div');
    line.className = 'flex items-start gap-2 ' + textCls;
    line.innerHTML =
      '<span class="text-slate-600 select-none">' + stamp + '</span>' +
      '<span class="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ' + dot + '"></span>' +
      '<span class="flex-1 break-words">' + escapeHtml(evt.msg || '') + '</span>';
    stream.appendChild(line);
    stream.scrollTop = stream.scrollHeight;
  },

  _runLogFinalize(evt) {
    if (this._runLogFinalized) return;
    this._runLogFinalized = true;
    const status = evt.level === 'done' ? 'complete' : 'failed';
    const summary = evt.msg || (status === 'complete' ? 'Run complete' : 'Run failed');
    this.finishRunLog(status, summary);
    this.state.running = false;
    this.updateRunButton();
    const reportId = evt.reportId || evt.report_id || null;
    this.loadReports().then(() => {
      if (status === 'complete' && reportId) {
        return this.viewReport(reportId);
      }
    }).catch(() => {});
  },

  finishRunLog(status, summary) {
    const panel = document.getElementById('er-run-log');
    const icon = document.getElementById('er-run-log-icon');
    const title = document.getElementById('er-run-log-title');
    const subtitle = document.getElementById('er-run-log-subtitle');
    if (this._runLogEs) { try { this._runLogEs.close(); } catch {} this._runLogEs = null; }
    if (this._runLogTimer) { clearInterval(this._runLogTimer); this._runLogTimer = null; }
    if (!panel) return;
    icon.classList.remove('animate-spin', 'text-brand-300');
    if (status === 'complete') {
      panel.classList.remove('border-brand-500/20', 'bg-brand-500/[0.03]');
      panel.classList.add('border-emerald-500/20', 'bg-emerald-500/[0.04]');
      icon.classList.add('text-emerald-300');
      icon.innerHTML = '<path stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>';
      title.textContent = 'Report complete';
    } else {
      panel.classList.remove('border-brand-500/20', 'bg-brand-500/[0.03]');
      panel.classList.add('border-red-500/20', 'bg-red-500/[0.04]');
      icon.classList.add('text-red-300');
      icon.innerHTML = '<path stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>';
      title.textContent = 'Run failed';
    }
    if (summary) subtitle.textContent = summary;
  },

  async loadReports() {
    try {
      const data = await API.get('/entity-report/reports');
      this.state.reports = data.reports || [];
      this.renderHistory();
      this.renderHeroStats();
    } catch (err) {
      Toast.error('Failed to load history: ' + err.message);
    }
  },

  renderHeroStats() {
    const el = document.getElementById('er-hero-stats');
    if (!el) return;
    const reports = this.state.reports || [];
    const complete = reports.filter(r => r.status === 'complete');
    const last = complete[0];
    const chip = (label, value, tone) => {
      const tones = {
        slate: 'bg-white/[0.04] border-white/[0.06] text-slate-300',
        brand: 'bg-brand-500/10 border-brand-500/20 text-brand-200',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200',
      };
      return '<div class="flex flex-col items-end px-3 py-2 rounded-xl border ' + (tones[tone] || tones.slate) + '">' +
        '<span class="text-[9px] uppercase tracking-wider font-bold opacity-70">' + label + '</span>' +
        '<span class="text-sm font-bold mt-0.5">' + value + '</span>' +
      '</div>';
    };
    let html = chip('Reports', complete.length || '—', complete.length ? 'brand' : 'slate');
    if (last) html += chip('Last run', timeAgo(last.created_at), 'emerald');
    el.innerHTML = html;
  },

  renderHistory() {
    const el = document.getElementById('er-history-list');
    if (!this.state.reports.length) {
      el.innerHTML = '<p class="text-sm text-slate-500 py-4 text-center">No reports yet. Run your first report above.</p>';
      return;
    }

    el.innerHTML = this.state.reports.map(r => {
      const statusBadge = r.status === 'complete'
        ? '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Complete</span>'
        : r.status === 'failed'
          ? '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20" title="' + escapeHtml(r.error_message || '') + '">Failed</span>'
          : '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Running</span>';
      const accounts = [
        r.fb_account ? '<span title="Facebook">' + platformIcon('facebook') + '</span>' : '',
        r.tt_account ? '<span title="TikTok">' + platformIcon('tiktok') + '</span>' : '',
        r.yt_account ? '<span title="YouTube">' + platformIcon('youtube') + '</span>' : '',
      ].filter(Boolean).join('');

      return '<div class="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all group flex items-center gap-3">' +
        '<div class="flex items-center gap-1.5 flex-shrink-0">' + accounts + '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="flex items-center gap-2 flex-wrap">' +
            statusBadge +
            '<span class="text-[11px] text-slate-600">' + timeAgo(r.created_at) + '</span>' +
            '<span class="text-[11px] text-slate-500">' + (r.videos_scanned || 0) + ' videos &middot; ' + (r.comments_analyzed || 0) + ' comments</span>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-1 flex-shrink-0">' +
          (r.status === 'complete' ? '<button class="btn-ghost text-[11px]" onclick="EntityReport.viewReport(\'' + r.id + '\')">View</button>' : '') +
          (r.status === 'complete' ? '<button class="btn-ghost text-[11px]" title="Download PDF" onclick="EntityReport.downloadPdf(\'' + r.id + '\')"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>' : '') +
          '<button class="btn-ghost text-[11px] text-red-400 hover:text-red-300" onclick="EntityReport.deleteReport(\'' + r.id + '\')">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
  },

  async viewReport(id) {
    try {
      const data = await API.get('/entity-report/reports/' + id);
      const r = data.report;
      this.state.currentReport = r;
      this.renderReport(r);
      document.getElementById('er-current-report').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      Toast.error('Failed to load report: ' + err.message);
    }
  },

  async ingestReport(id) {
    if (!confirm('Copy this report\'s videos & comments into the main DB? Existing entries with the same URL/text may duplicate.')) return;
    try {
      const data = await API.post('/entity-report/reports/' + id + '/ingest', {});
      Toast.success('Ingested ' + (data.totalInserted || 0) + ' comments across ' + (data.sourcesCreated || 0) + ' source(s)');
    } catch (err) {
      Toast.error('Ingest failed: ' + err.message);
    }
  },

  async reanalyzeReport(id) {
    if (this.state.running) return;
    if (!confirm('Re-analyze this report using the current OpenAI model? Existing entities/scores will be replaced.')) return;
    this.state.running = true;
    Modal.showProcessing('Re-analyzing Report', 'Re-running entity extraction and sentiment scoring on stored videos & comments...');
    try {
      const data = await API.post('/entity-report/reports/' + id + '/reanalyze', {});
      Modal.hideProcessing();
      this.state.running = false;
      Toast.success('Re-analysis complete' + (data.model_used ? ' (model: ' + data.model_used + ')' : ''));
      await this.loadReports();
      await this.viewReport(id);
    } catch (err) {
      Modal.hideProcessing();
      this.state.running = false;
      Toast.error('Re-analyze failed: ' + err.message);
    }
  },

  async deleteReport(id) {
    if (!confirm('Delete this report?')) return;
    try {
      await API.del('/entity-report/reports/' + id);
      Toast.success('Deleted');
      const cur = this.state.currentReport;
      if (cur && cur.id === id) {
        this.state.currentReport = null;
        document.getElementById('er-current-report').classList.add('hidden');
      }
      await this.loadReports();
    } catch (err) {
      Toast.error('Delete failed: ' + err.message);
    }
  },

  scoreColor(score) {
    if (score == null) return 'bg-slate-500';
    if (score <= 2) return 'bg-red-500';
    if (score <= 4) return 'bg-orange-500';
    if (score < 6) return 'bg-amber-500';
    if (score < 8) return 'bg-lime-500';
    return 'bg-emerald-500';
  },

  scoreTextColor(score) {
    if (score == null) return 'text-slate-400';
    if (score <= 2) return 'text-red-300';
    if (score <= 4) return 'text-orange-300';
    if (score < 6) return 'text-amber-300';
    if (score < 8) return 'text-lime-300';
    return 'text-emerald-300';
  },

  typeBadge(type) {
    const colors = {
      person: 'bg-brand-500/10 text-brand-300 border-brand-500/20',
      institution: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
      organization: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
      city: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      other: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    };
    const cls = colors[type] || colors.other;
    return '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded border ' + cls + '">' + escapeHtml(type || 'other') + '</span>';
  },

  renderReport(r) {
    const container = document.getElementById('er-current-report');
    container.classList.remove('hidden');

    const data = r.report_data || {};
    // Hide entities with no scoreable data (older reports may still contain them).
    const entities = (data.entities || []).filter(e => e.sentiment_score != null);
    const platformStats = data.platform_stats || {};

    const ps = ['facebook', 'tiktok', 'youtube'].map(p => {
      const s = platformStats[p] || { videos: 0, comments: 0 };
      return '<div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">' +
        platformIcon(p) +
        '<div class="flex flex-col">' +
          '<span class="text-[10px] text-slate-500 uppercase tracking-wide">' + p + '</span>' +
          '<span class="text-xs font-semibold text-white">' + (s.videos || 0) + ' videos &middot; ' + (s.comments || 0) + ' comments</span>' +
        '</div>' +
      '</div>';
    }).join('');

    const summary = '<div class="flex items-center gap-4 flex-wrap mb-5">' +
      '<div class="flex items-center gap-2">' +
        '<span class="text-2xl font-extrabold text-white">' + (r.videos_scanned || 0) + '</span>' +
        '<span class="text-xs text-slate-500 uppercase tracking-wider font-medium">Videos</span>' +
      '</div>' +
      '<div class="w-px h-6 bg-white/[0.08]"></div>' +
      '<div class="flex items-center gap-2">' +
        '<span class="text-2xl font-extrabold text-white">' + (r.comments_analyzed || 0) + '</span>' +
        '<span class="text-xs text-slate-500 uppercase tracking-wider font-medium">Comments</span>' +
      '</div>' +
      '<div class="w-px h-6 bg-white/[0.08]"></div>' +
      '<div class="flex items-center gap-2">' +
        '<span class="text-2xl font-extrabold text-white">' + entities.length + '</span>' +
        '<span class="text-xs text-slate-500 uppercase tracking-wider font-medium">Entities</span>' +
      '</div>' +
      '<div class="w-px h-6 bg-white/[0.08]"></div>' +
      '<span class="text-xs text-slate-500">Window: <span class="text-slate-300 font-semibold">' + (data.time_window || '72h') + '</span></span>' +
      '<span class="text-xs text-slate-500 ml-auto">' + timeAgo(r.created_at) + '</span>' +
    '</div>';

    let entitiesHtml = '';
    if (!entities.length) {
      entitiesHtml = '<p class="text-sm text-slate-500 py-6 text-center">' + escapeHtml(data.message || 'No entities found') + '</p>';
    } else {
      entitiesHtml = '<div class="space-y-3">' + entities.map((e, idx) => {
        const score = e.sentiment_score;
        const scoreDisplay = score != null ? score.toFixed(1) : '—';
        const barWidth = score != null ? (score / 10) * 100 : 0;
        const colorBar = this.scoreColor(score);
        const colorText = this.scoreTextColor(score);

        const examplesHtml = (e.example_comments || []).length
          ? '<div class="mt-3 pt-3 border-t border-white/[0.04] space-y-1.5">' +
              '<div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Example comments</div>' +
              e.example_comments.map(c =>
                '<div class="text-xs text-slate-400 p-2 rounded-lg bg-white/[0.02] border border-white/[0.03] flex items-start gap-2">' +
                  (c.platform ? '<span class="flex-shrink-0 mt-0.5">' + platformIcon(c.platform) + '</span>' : '') +
                  '<span class="flex-1">"' + escapeHtml(truncate(c.text || '', 280)) + '"</span>' +
                '</div>'
              ).join('') +
            '</div>'
          : '';

        const videoCount = e.videos_in_context || 0;
        const videosClickable = videoCount > 0 && Array.isArray(e.videos) && e.videos.length > 0;
        const videosBadge = videosClickable
          ? '<button class="text-[11px] text-brand-300 hover:text-brand-200 underline decoration-dotted underline-offset-2 transition-colors" onclick="EntityReport.showEntityVideos(' + idx + ')" title="See the videos where ' + escapeHtml(e.name) + ' appears">' + videoCount + ' video' + (videoCount === 1 ? '' : 's') + '</button>'
          : '<span class="text-[11px] text-slate-500">' + videoCount + ' video' + (videoCount === 1 ? '' : 's') + '</span>';

        return '<div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all">' +
          '<div class="flex items-start gap-3 flex-wrap">' +
            '<div class="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-400">#' + (idx + 1) + '</div>' +
            '<div class="flex-1 min-w-0">' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<h4 class="text-sm font-bold text-white">' + escapeHtml(e.name) + '</h4>' +
                this.typeBadge(e.type) +
                '<span class="text-[11px] text-slate-500">' + (e.mentions || 0) + ' mentions &middot; ' + (e.direct_mentions || 0) + ' named + ' + (e.indirect_from_videos || 0) + ' contextual &middot;</span>' +
                videosBadge +
              '</div>' +
              '<p class="text-xs text-slate-400 mt-1.5 leading-relaxed">' + escapeHtml(e.justification || '') + '</p>' +
            '</div>' +
            '<div class="flex flex-col items-end gap-1.5 flex-shrink-0 min-w-[180px]">' +
              '<div class="flex items-center gap-2">' +
                '<span class="text-2xl font-extrabold ' + colorText + ' tabular-nums">' + scoreDisplay + '</span>' +
                '<span class="text-[10px] text-slate-500 uppercase tracking-wider">/10</span>' +
              '</div>' +
              '<div class="w-[140px] h-2 bg-white/[0.04] rounded-full overflow-hidden">' +
                '<div class="' + colorBar + ' h-full rounded-full transition-all" style="width:' + barWidth + '%"></div>' +
              '</div>' +
              '<span class="text-[10px] font-semibold ' + colorText + ' uppercase tracking-wider">' + escapeHtml(e.sentiment_label || 'unknown') + '</span>' +
            '</div>' +
          '</div>' +
          examplesHtml +
        '</div>';
      }).join('') + '</div>';
    }

    const modelTag = data.model_used
      ? '<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.06]" title="Model used for this analysis">' + escapeHtml(data.model_used) + (data.reanalyzed ? ' &middot; re-run' : '') + '</span>'
      : '';
    const reanalyzeBtn = r.has_raw_data
      ? '<button class="btn-ghost text-xs" onclick="EntityReport.reanalyzeReport(\'' + r.id + '\')" title="Re-run entity extraction & sentiment using the model currently set in Settings, on the videos/comments stored with this report">Re-analyze</button>'
      : '<span class="text-[10px] text-slate-500 italic" title="This report predates re-analyze support">no stored data</span>';
    const ingestBtn = r.has_raw_data
      ? '<button class="btn-ghost text-xs" onclick="EntityReport.ingestReport(\'' + r.id + '\')" title="Copy this report\'s videos & comments into the main DB so they appear in Explorer / Dashboard / AI Training">Push to main DB</button>'
      : '';
    const pdfBtn = '<button class="btn-secondary text-xs" onclick="EntityReport.downloadPdf(\'' + r.id + '\')" title="Download this report as a styled PDF">' +
      '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>' +
      'PDF</button>';

    container.innerHTML = '<div class="card">' +
      '<div class="flex items-center justify-between mb-2 flex-wrap gap-2">' +
        '<div class="flex items-center gap-2 flex-wrap">' +
          '<h3 class="section-title mb-0">Report #' + r.id + '</h3>' +
          modelTag +
          '<p class="text-xs text-slate-500 mt-0.5 w-full">Generated ' + timeAgo(r.created_at) + '</p>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          pdfBtn +
          ingestBtn +
          reanalyzeBtn +
          '<button class="btn-ghost text-xs" onclick="document.getElementById(\'er-current-report\').classList.add(\'hidden\')">Close</button>' +
        '</div>' +
      '</div>' +
      summary +
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-5">' + ps + '</div>' +
      entitiesHtml +
    '</div>';
  },

  downloadPdf(id) {
    Toast.info('Preparing PDF…');
    // Use a real navigation so the browser handles the file download dialog natively.
    const a = document.createElement('a');
      var _pdfBase = (typeof window !== 'undefined' && window.__COMMENT_SENTINEL_API_BASE__) || '/v1/comment-sentinel';
      a.href = _pdfBase + '/entity-report/reports/' + id + '/pdf';
    a.rel = 'noopener';
    a.target = '_blank';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); } catch {} }, 1000);
  },

  showEntityVideos(entityIdx) {
    const r = this.state.currentReport;
    if (!r || !r.report_data) return;
    const entity = (r.report_data.entities || [])[entityIdx];
    if (!entity) return;
    const videos = Array.isArray(entity.videos) ? entity.videos : [];

    const platformChip = (p) => {
      const tones = {
        facebook: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
        tiktok: 'bg-pink-500/10 text-pink-300 border-pink-500/20',
        youtube: 'bg-red-500/10 text-red-300 border-red-500/20',
      };
      const cls = tones[p] || 'bg-white/[0.04] text-slate-400 border-white/[0.06]';
      return '<span class="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ' + cls + '">' +
        (p ? platformIcon(p) : '') + escapeHtml(p || 'unknown') +
      '</span>';
    };

    const rows = videos.length
      ? videos.map((v, i) => {
          const title = v.title || '(no title)';
          const date = v.publishTime ? new Date(v.publishTime * 1000).toLocaleDateString() : '';
          return '<a href="' + escapeHtml(v.url) + '" target="_blank" rel="noopener" class="block p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-brand-500/30 hover:bg-brand-500/[0.04] transition-all group">' +
            '<div class="flex items-start gap-3">' +
              '<span class="text-[10px] font-mono text-slate-600 w-5 text-right pt-0.5">#' + (i + 1) + '</span>' +
              '<div class="flex-1 min-w-0">' +
                '<div class="flex items-center gap-2 flex-wrap">' +
                  platformChip(v.platform) +
                  (date ? '<span class="text-[10px] text-slate-500">' + escapeHtml(date) + '</span>' : '') +
                '</div>' +
                '<p class="text-sm text-white font-medium mt-1.5 leading-snug group-hover:text-brand-200 transition-colors">' + escapeHtml(title) + '</p>' +
                '<p class="text-[10px] text-slate-500 font-mono mt-1 truncate">' + escapeHtml(v.url || '') + '</p>' +
              '</div>' +
              '<svg class="w-4 h-4 text-slate-500 group-hover:text-brand-300 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>' +
            '</div>' +
          '</a>';
        }).join('')
      : '<p class="text-sm text-slate-500 py-4 text-center">No video details available for this entity.</p>';

    Modal.show(
      '<div class="flex items-start gap-3 mb-4">' +
        '<div class="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-300 flex-shrink-0">' +
          '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<h3 class="text-lg font-bold text-white tracking-tight">Videos mentioning <span class="text-brand-300">' + escapeHtml(entity.name) + '</span></h3>' +
          '<p class="text-xs text-slate-500 mt-0.5">' + videos.length + ' video' + (videos.length === 1 ? '' : 's') + ' contributed comments analyzed for this entity</p>' +
        '</div>' +
        '<button class="btn-ghost text-xs flex-shrink-0" onclick="Modal.hide()">Close</button>' +
      '</div>' +
      '<div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">' + rows + '</div>'
    );
  },
};

document.addEventListener('input', function(e) {
  if (e.target && (e.target.id === 'er-fb-account' || e.target.id === 'er-tt-account' || e.target.id === 'er-yt-account')) {
    EntityReport.updateRunButton();
  }
});
