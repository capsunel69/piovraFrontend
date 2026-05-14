/** Resolves Piovra origin from `?pio=` (set by Capsuna iframe) or legacy global. */
function resolvePiovraBaseUrl() {
  try {
    const u = new URL(window.location.href);
    const p = u.searchParams.get('pio');
    if (p) return decodeURIComponent(p).replace(/\/$/, '');
  } catch (_) {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.__PIOVRA_BASE_URL__) {
    return String(window.__PIOVRA_BASE_URL__).replace(/\/$/, '');
  }
  return '';
}

const PIOVRA = resolvePiovraBaseUrl();
const API_BASE = PIOVRA ? `${PIOVRA}/v1/comment-sentinel` : '/v1/comment-sentinel';
if (typeof window !== 'undefined') {
  window.__COMMENT_SENTINEL_API_BASE__ = API_BASE;
}

const fetchOpts = { credentials: 'include' };

const API = {
  async get(url) {
    const res = await fetch(API_BASE + url, { ...fetchOpts });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(API_BASE + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      ...fetchOpts,
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(API_BASE + url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      ...fetchOpts,
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  },
  async patch(url, data) {
    const res = await fetch(API_BASE + url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      ...fetchOpts,
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  },
  async del(url) {
    const res = await fetch(API_BASE + url, { method: 'DELETE', ...fetchOpts });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  },
  async upload(url, formData) {
    const res = await fetch(API_BASE + url, { method: 'POST', body: formData, ...fetchOpts });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || res.statusText); }
    return res.json();
  },
};
