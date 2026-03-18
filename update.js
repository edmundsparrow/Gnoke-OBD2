/**
 * update.js — Gnoke OBD2
 * Checks the live GitHub repository for the latest version and
 * renders a result badge inside #update-card on the About page.
 *
 * Strategy:
 *   1. Fetch raw README.md from the GitHub repo (no auth, no CORS issues)
 *   2. Parse the first "v{semver}" string found
 *   3. Fallback: GitHub Releases API if README parse fails
 *   4. Compare against APP_VERSION
 *
 * Public API:
 *   Updater.check()   → manually trigger a version check
 *   Updater.init()    → wires #btn-check-update (called automatically)
 */

const Updater = (() => {

  /* ── Config ─────────────────────────────────────────────── */
  const REPO_OWNER  = 'edmundsparrow';
  const REPO_NAME   = 'Gnoke-OBD2';
  const APP_VERSION = 'v2.5';

  const README_URL   = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/README.md`;
  const RELEASES_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

  /* ── Semver helpers ──────────────────────────────────────── */
  function _parse(str) {
    const clean = String(str || '').replace(/^v/i, '').trim();
    const parts = clean.split('.').map(n => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
  }

  function _compare(a, b) {
    for (let i = 0; i < 3; i++) {
      if (a[i] > b[i]) return  1;
      if (a[i] < b[i]) return -1;
    }
    return 0;
  }

  /* ── Fetch strategies ────────────────────────────────────── */
  async function _fromReadme() {
    const res  = await fetch(README_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`README ${res.status}`);
    const text = await res.text();
    const m    = text.match(/\bv(\d+\.\d+(?:\.\d+)?)\b/i);
    if (!m) throw new Error('Version not found in README');
    return `v${m[1]}`;
  }

  async function _fromReleases() {
    const res  = await fetch(RELEASES_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`Releases API ${res.status}`);
    const data = await res.json();
    if (!data.tag_name) throw new Error('No tag_name in release');
    return data.tag_name;
  }

  /* ── Button state ────────────────────────────────────────── */
  function _setBtnState(btn, loading) {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<span class="upd-spinner"></span> Checking&hellip;`
      : `&#128260; Check for Updates`;
  }

  /* ── Result rendering ────────────────────────────────────── */
  function _renderResult(card, { status, current, latest, releaseUrl }) {
    card.querySelector('.upd-result')?.remove();

    const div = document.createElement('div');
    div.className = 'upd-result';

    if (status === 'up-to-date') {
      div.innerHTML = `
        <div class="upd-badge upd-ok">
          <span class="upd-icon">&#9989;</span>
          <div>
            <strong>You&rsquo;re up to date</strong>
            <span class="upd-meta">Running ${current} &mdash; latest is ${latest}</span>
          </div>
        </div>`;
    } else if (status === 'update-available') {
      div.innerHTML = `
        <div class="upd-badge upd-new">
          <span class="upd-icon">&#128640;</span>
          <div>
            <strong>Update available: ${latest}</strong>
            <span class="upd-meta">You&rsquo;re on ${current}</span>
            ${releaseUrl
              ? `<a class="upd-link" href="${releaseUrl}" target="_blank" rel="noopener">
                   View release &rarr;
                 </a>`
              : ''}
          </div>
        </div>`;
    } else {
      div.innerHTML = `
        <div class="upd-badge upd-err">
          <span class="upd-icon">&#9888;&#65039;</span>
          <div>
            <strong>Couldn&rsquo;t check for updates</strong>
            <span class="upd-meta">${latest}</span>
          </div>
        </div>`;
    }

    card.appendChild(div);
  }

  /* ── Injected styles ──────────────────────────────────────── */
  function _injectStyles() {
    if (document.getElementById('upd-styles')) return;
    const s = document.createElement('style');
    s.id = 'upd-styles';
    s.textContent = `
      .upd-spinner {
        display: inline-block; width: 11px; height: 11px;
        border: 2px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: upd-spin .7s linear infinite;
        vertical-align: middle;
      }
      @keyframes upd-spin { to { transform: rotate(360deg); } }

      .upd-result {
        margin-top: 14px;
        animation: upd-in .22s ease;
      }
      @keyframes upd-in {
        from { opacity: 0; transform: translateY(5px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .upd-badge {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 14px; border-radius: 10px; border: 1.5px solid;
      }
      .upd-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
      .upd-badge > div { display: flex; flex-direction: column; gap: 3px; }
      .upd-badge strong {
        font-size: .85rem; font-weight: 600; color: var(--text);
      }
      .upd-meta {
        font-family: var(--font-mono, monospace);
        font-size: .64rem; letter-spacing: .05em; color: var(--muted);
      }
      .upd-link {
        display: inline-block; margin-top: 4px;
        font-size: .75rem; font-weight: 600; color: var(--accent);
        text-decoration: none; transition: opacity .15s;
      }
      .upd-link:hover { opacity: .7; }

      .upd-ok  {
        background: var(--green-lt, rgba(74,107,58,.12));
        border-color: rgba(74,107,58,.30);
      }
      .upd-new {
        background: var(--accent-lt);
        border-color: var(--accent-dim);
      }
      .upd-err {
        background: var(--red-lt, rgba(158,42,28,.10));
        border-color: rgba(158,42,28,.30);
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Core check ───────────────────────────────────────────── */
  async function check() {
    const btn  = document.getElementById('btn-check-update');
    const card = document.getElementById('update-card');
    if (!btn || !card) return;

    _setBtnState(btn, true);

    try {
      let latestRaw;
      try        { latestRaw = await _fromReadme();   }
      catch (_)  { latestRaw = await _fromReleases(); }

      const cmp = _compare(_parse(latestRaw), _parse(APP_VERSION));

      _renderResult(card, {
        status     : cmp > 0 ? 'update-available' : 'up-to-date',
        current    : APP_VERSION,
        latest     : latestRaw,
        releaseUrl : `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
      });

      if (typeof System !== 'undefined') {
        System.log('Updater',
          cmp > 0
            ? `Update available: ${latestRaw}`
            : `App is up to date (${APP_VERSION})`
        );
      }

    } catch (err) {
      console.warn('[Updater]', err);
      _renderResult(card, {
        status  : 'error',
        current : APP_VERSION,
        latest  : 'No internet connection or repository unavailable.',
      });
      if (typeof System !== 'undefined') {
        System.log('Updater', `Check failed: ${err.message}`);
      }
    } finally {
      _setBtnState(btn, false);
    }
  }

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    _injectStyles();
    const btn = document.getElementById('btn-check-update');
    if (btn) btn.addEventListener('click', check);
  }

  return { init, check };

})();

/* Auto-wire on DOM ready */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Updater.init);
} else {
  Updater.init();
}
