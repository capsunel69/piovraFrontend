const Toast = {
  show(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    var configs = {
      success: { bg: 'bg-emerald-500/90', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' },
      error: { bg: 'bg-red-500/90', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' },
      info: { bg: 'bg-brand-500/90', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' },
      warning: { bg: 'bg-amber-500/90', icon: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' },
    };
    var c = configs[type] || configs.info;
    var el = document.createElement('div');
    el.className = 'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-2xl backdrop-blur-xl ' + c.bg + ' animate-slide-in-right border border-white/10';
    el.innerHTML = '<span class="flex-shrink-0">' + c.icon + '</span><span class="flex-1">' + message + '</span><button class="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity ml-2" onclick="this.parentElement.remove()"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>';
    container.appendChild(el);
    setTimeout(function() { el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; el.style.transition = 'all 0.3s ease'; setTimeout(function() { el.remove(); }, 300); }, 4000);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning'); },
};

const Modal = {
  _locked: false,
  show(html) {
    this._locked = false;
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-backdrop').classList.remove('hidden');
  },
  hide() {
    if (this._locked) return;
    document.getElementById('modal-backdrop').classList.add('hidden');
    document.getElementById('modal-content').innerHTML = '';
  },
  showProcessing(title, subtitle) {
    this._locked = true;
    document.getElementById('modal-content').innerHTML =
      '<div class="text-center py-4">' +
        '<div class="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto mb-5">' +
          '<svg class="w-8 h-8 text-brand-400 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.2"/><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="40 63"/></svg>' +
        '</div>' +
        '<h3 class="text-lg font-bold text-white mb-1">' + (title || 'Processing...') + '</h3>' +
        '<p id="processing-subtitle" class="text-sm text-slate-400">' + (subtitle || 'This may take a minute. Please wait.') + '</p>' +
      '</div>';
    document.getElementById('modal-backdrop').classList.remove('hidden');
  },
  updateProcessing(subtitle) {
    var el = document.getElementById('processing-subtitle');
    if (el) el.textContent = subtitle;
  },
  hideProcessing() {
    this._locked = false;
    this.hide();
  },
};

document.getElementById('modal-backdrop').addEventListener('click', function(e) {
  if (e.target === this) Modal.hide();
});

function categoryBadge(name, color) {
  if (!name) return '<span class="badge bg-white/[0.06] text-slate-400 border border-white/[0.06] whitespace-nowrap">Unclassified</span>';
  return '<span class="badge text-white border border-white/10 whitespace-nowrap" style="background:' + color + '">' + escapeHtml(name) + '</span>';
}

function confidenceBar(val) {
  val = val || 0;
  var pct = Math.round(val * 100);
  var clr = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return '<div class="flex items-center gap-2"><div class="w-14 bg-white/[0.06] rounded-full h-1"><div class="' + clr + ' h-1 rounded-full transition-all" style="width:' + pct + '%"></div></div><span class="text-[11px] text-slate-500 tabular-nums">' + pct + '%</span></div>';
}

function platformIcon(platform) {
  var icons = { facebook: '<svg class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>', tiktok: '<svg class="w-4 h-4 text-pink-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>', youtube: '<svg class="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>' };
  return icons[platform] || '';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, len) {
  len = len || 100;
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function formatViews(n) {
  if (!n || n <= 0) return '';
  if (n < 1000) return String(n);
  if (n < 1000000) {
    var k = n / 1000;
    return (k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')) + 'K';
  }
  var m = n / 1000000;
  return (m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')) + 'M';
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  var normalized = dateStr;
  if (!/[TZ+\-]/.test(dateStr.slice(10))) {
    normalized = dateStr.replace(' ', 'T') + 'Z';
  }
  var d = new Date(normalized);
  if (isNaN(d.getTime())) return '';
  var diff = Date.now() - d.getTime();
  if (diff < 0) diff = 0;
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return d.toLocaleDateString();
}

function nextRunDescriptor(hhmm) {
  if (!hhmm || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) return '';
  var parts = hhmm.split(':');
  var now = new Date();
  var target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  var diffMs = target.getTime() - now.getTime();
  var totalMin = Math.max(1, Math.round(diffMs / 60000));
  var h = Math.floor(totalMin / 60);
  var m = totalMin % 60;
  if (h <= 0) return 'in ' + m + 'm';
  if (h < 24) return 'in ' + h + 'h ' + m + 'm';
  return 'tomorrow';
}
