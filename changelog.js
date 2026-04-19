'use strict';

/* ══════════════════════════════════════════
   JAGUAR CHANGELOG SYSTEM
   Drop this script tag into index.html:
   <script src="changelog.js" defer></script>
   ══════════════════════════════════════════ */

(async function initChangelog() {

  const STORE_KEY = 'jub_changelog_seen'; // localStorage key
  const JSON_PATH = 'changelog.json';

  /* ── Load changelog data ── */
  let data;
  try {
    const res = await fetch(JSON_PATH + '?t=' + Date.now()); // bust cache
    data = await res.json();
  } catch (e) {
    console.warn('[Changelog] Could not load changelog.json', e);
    return;
  }

  /* ── Guard: disabled in JSON ── */
  if (!data.enabled) return;

  /* ── Guard: user already saw this version ── */
  let seen;
  try { seen = JSON.parse(localStorage.getItem(STORE_KEY)) ?? {}; } catch { seen = {}; }
  if (seen.version === data.version) return;

  /* ── Build popup HTML ── */
  const type_meta = {
    new:  { label: 'New',  color: 'rgba(255,255,255,0.10)', dot: '#7eb8f7' },
    hot:  { label: 'Hot',  color: 'rgba(200,48,28,0.18)',   dot: '#e05030' },
    fix:  { label: 'Fix',  color: 'rgba(255,255,255,0.05)', dot: '#666'    },
  };

  function buildEntries(entries) {
    // Only show the most recent entry in the popup
    return [entries[0]].map(entry => `
      <div class="cl-entry">
        <div class="cl-entry-head">
          <span class="cl-version">${entry.version}</span>
          <span class="cl-date">${entry.date}</span>
          <span class="cl-entry-title">${entry.title}</span>
        </div>
        <ul class="cl-list">
          ${entry.changes.map(c => {
            const m = type_meta[c.type] || type_meta.fix;
            return `<li class="cl-item" style="--dot:${m.dot};--bg:${m.color}">
              <span class="cl-tag">${m.label}</span>
              <span class="cl-text">${c.text}</span>
            </li>`;
          }).join('')}
        </ul>
      </div>
    `).join('<div class="cl-divider"></div>');
  }

  const popup = document.createElement('div');
  popup.id = 'clPopupWrap';
  popup.innerHTML = `
    <div class="cl-backdrop" id="clBackdrop"></div>
    <div class="cl-popup" id="clPopup" role="dialog" aria-modal="true" aria-label="What's new">
      <div class="cl-header">
        <div class="cl-header-left">
          <span class="cl-jaguar">🐆</span>
          <div>
            <div class="cl-popup-title">What's New</div>
            <div class="cl-popup-sub">JaguarUBG · ${data.version}</div>
          </div>
        </div>
        <button class="cl-close" id="clClose" aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/>
          </svg>
        </button>
      </div>
      <div class="cl-body">
        ${buildEntries(data.entries)}
      </div>
      <div class="cl-footer">
        <a class="cl-link" href="changelog.html" target="_blank">Full changelog →</a>
        <button class="cl-dismiss" id="clDismiss">Got it</button>
      </div>
    </div>
  `;

  /* ── Styles ── */
  const style = document.createElement('style');
  style.textContent = `
    #clPopupWrap * { box-sizing: border-box; margin: 0; padding: 0; }

    .cl-backdrop {
      position: fixed; inset: 0;
      background: rgba(6,6,6,0.88);
      backdrop-filter: blur(12px);
      z-index: 3000;
      animation: clFadeIn .2s ease both;
    }

    .cl-popup {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) scale(0.96);
      z-index: 3001;
      width: min(460px, calc(100vw - 32px));
      max-height: min(600px, calc(100vh - 48px));
      background: #141414;
      border: 1px solid #2c2c2c;
      border-radius: 18px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04) inset;
      display: flex; flex-direction: column;
      overflow: hidden;
      animation: clSlideIn .25s cubic-bezier(.34,1.3,.64,1) both;
      font-family: 'Space Grotesk', sans-serif;
      color: #e8e8e8;
    }

    @keyframes clFadeIn  { from { opacity: 0 } to { opacity: 1 } }
    @keyframes clSlideIn { from { opacity: 0; transform: translate(-50%,-48%) scale(0.94) } to { opacity:1; transform: translate(-50%,-50%) scale(1) } }

    .cl-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 20px 16px;
      border-bottom: 1px solid #222;
      flex-shrink: 0;
    }
    .cl-header-left { display: flex; align-items: center; gap: 12px; }
    .cl-jaguar { font-size: 28px; line-height: 1; }
    .cl-popup-title { font-size: 15px; font-weight: 700; letter-spacing: -0.4px; }
    .cl-popup-sub { font-size: 10px; color: #555; font-weight: 500; margin-top: 1px; letter-spacing: 0.3px; }

    .cl-close {
      width: 28px; height: 28px;
      border-radius: 7px;
      background: #1e1e1e;
      border: 1px solid #2a2a2a;
      color: #555;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: color .12s, background .12s;
      flex-shrink: 0;
    }
    .cl-close:hover { color: #e8e8e8; background: #262626; }
    .cl-close svg { width: 13px; height: 13px; }

    .cl-body {
      overflow-y: auto; flex: 1;
      padding: 16px 20px;
      scrollbar-width: thin;
      scrollbar-color: #2a2a2a transparent;
    }
    .cl-body::-webkit-scrollbar { width: 4px; }
    .cl-body::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }

    .cl-entry { }
    .cl-entry-head {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 10px;
    }
    .cl-version {
      font-family: 'Space Mono', monospace;
      font-size: 10px; font-weight: 700;
      color: #e8e8e8;
      background: #222; border: 1px solid #2e2e2e;
      border-radius: 5px; padding: 2px 7px;
      letter-spacing: 0;
    }
    .cl-date { font-size: 10px; color: #444; font-weight: 500; }
    .cl-entry-title { font-size: 11px; font-weight: 600; color: #666; margin-left: auto; }

    .cl-list { list-style: none; display: flex; flex-direction: column; gap: 5px; }

    .cl-item {
      display: flex; align-items: flex-start; gap: 9px;
      background: var(--bg);
      border-radius: 7px;
      padding: 7px 10px;
      border: 1px solid rgba(255,255,255,0.04);
    }
    .cl-tag {
      font-size: 8px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--dot);
      background: var(--bg);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 4px; padding: 2px 6px;
      flex-shrink: 0; margin-top: 1px;
      white-space: nowrap;
    }
    .cl-text { font-size: 12px; font-weight: 400; color: #aaa; line-height: 1.5; }

    .cl-divider { height: 1px; background: #1e1e1e; margin: 14px 0; }

    .cl-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px;
      border-top: 1px solid #1e1e1e;
      flex-shrink: 0;
    }
    .cl-link {
      font-size: 11px; font-weight: 600; color: #555;
      text-decoration: none; transition: color .12s;
    }
    .cl-link:hover { color: #e8e8e8; }

    .cl-dismiss {
      background: #e8e8e8; color: #0e0e0e;
      border: none; border-radius: 8px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 12px; font-weight: 700;
      padding: 9px 22px;
      cursor: pointer;
      transition: opacity .15s, transform .15s;
      letter-spacing: 0.1px;
    }
    .cl-dismiss:hover { opacity: .85; transform: translateY(-1px); }

    .cl-popup.closing {
      animation: clSlideOut .18s ease forwards;
    }
    .cl-backdrop.closing { animation: clFadeOut .18s ease forwards; }
    @keyframes clSlideOut { to { opacity: 0; transform: translate(-50%,-52%) scale(0.95) } }
    @keyframes clFadeOut  { to { opacity: 0 } }

    @media (max-width: 480px) {
      .cl-popup { border-radius: 14px 14px 0 0; top: auto; bottom: 0; left: 0; right: 0; width: 100%; transform: none; max-height: 85vh; }
      @keyframes clSlideIn { from { opacity: 0; transform: translateY(20px) } to { opacity:1; transform: translateY(0) } }
      @keyframes clSlideOut { to { opacity: 0; transform: translateY(20px) } }
    }
  `;

  /* ── Mount ── */
  document.head.appendChild(style);
  document.body.appendChild(popup);

  /* ── Dismiss logic ── */
  function dismiss() {
    document.getElementById('clPopup')?.classList.add('closing');
    document.getElementById('clBackdrop')?.classList.add('closing');
    setTimeout(() => { popup.remove(); style.remove(); }, 200);
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ version: data.version })); } catch {}
  }

  document.getElementById('clClose').addEventListener('click', dismiss);
  document.getElementById('clDismiss').addEventListener('click', dismiss);
  document.getElementById('clBackdrop').addEventListener('click', dismiss);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') dismiss(); }, { once: true });

})();
