'use strict';

/* ══════════════════════════════════════════
   CONFIG
══════════════════════════════════════════ */
const GAMES_JSON = 'games.json';
const GAMES_DIR  = '';
const MAX_RECENTS = 20;

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let allGames     = [];
let activeFilter = 'all';
let activeSort   = 'default';
let currentGame  = null;
let panicKey     = 'Escape';
let panicTarget  = 'https://classroom.google.com';
let listeningKey = false;

/* persisted state (localStorage) */
function loadStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveStore(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

let favorites = loadStore('jub_favs', []);    // array of slugs
let recents   = loadStore('jub_recents', []); // array of {slug, ts}
let playedToday = loadStore('jub_today', { date: '', count: 0 });

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
const $  = id  => document.getElementById(id);
const el = tag => document.createElement(tag);

function toast(msg, duration = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

function isFav(slug) { return favorites.includes(slug); }

function toggleFav(slug) {
  if (isFav(slug)) {
    favorites = favorites.filter(s => s !== slug);
    toast('Removed from favorites');
  } else {
    favorites.unshift(slug);
    toast('❤ Added to favorites');
  }
  saveStore('jub_favs', favorites);
  refreshFavBtns(slug);
  renderFavsPanel();
}

function addRecent(game) {
  recents = recents.filter(r => r.slug !== game.slug);
  recents.unshift({ slug: game.slug, ts: Date.now() });
  if (recents.length > MAX_RECENTS) recents = recents.slice(0, MAX_RECENTS);
  saveStore('jub_recents', recents);
  updatePlayedToday();
  renderRecentStrip();
  renderRecentsPanel();
}

function updatePlayedToday() {
  const today = new Date().toDateString();
  if (playedToday.date !== today) playedToday = { date: today, count: 0 };
  playedToday.count++;
  saveStore('jub_today', playedToday);
  const statEl = $('statPlayed');
  if (statEl) statEl.textContent = playedToday.count;
}

function refreshFavBtns(slug) {
  document.querySelectorAll(`[data-slug="${slug}"]`).forEach(btn => {
    btn.classList.toggle('is-fav', isFav(slug));
  });
  // also game viewer button
  if (currentGame?.slug === slug) {
    $('gvFav').classList.toggle('is-fav', isFav(slug));
  }
}

/* ══════════════════════════════════════════
   GAME VIEWER
══════════════════════════════════════════ */
function openGame(game) {
  currentGame = game;
  $('gameFrame').src = `${GAMES_DIR}/${game.slug}/index.html`;
  $('gvTitle').textContent = game.name;
  $('gvFav').classList.toggle('is-fav', isFav(game.slug));
  $('gameViewer').classList.add('open');
  document.body.style.overflow = 'hidden';
  addRecent(game);
}

function closeGame() {
  $('gameViewer').classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { $('gameFrame').src = ''; currentGame = null; }, 260);
}

function initViewer() {
  $('gvClose').addEventListener('click', closeGame);
  $('gvFav').addEventListener('click', () => currentGame && toggleFav(currentGame.slug));
  $('gvFullscreen').addEventListener('click', () => {
    const f = $('gameFrame');
    (f.requestFullscreen || f.webkitRequestFullscreen || (() => {})).call(f);
  });
  $('gvPopout').addEventListener('click', () => {
    if (!currentGame) return;
    const url = `${location.origin}${location.pathname.replace('index.html','')}${GAMES_DIR}/${currentGame.slug}/index.html`;
    window.open(url, '_blank', 'width=1024,height=768,menubar=no,toolbar=no,location=no');
  });
}

/* ══════════════════════════════════════════
   CARD BUILDER
══════════════════════════════════════════ */
function buildCard(game, idx) {
  const card = el('div');
  const sizeClass = game.size === 'wide' ? ' wide' : game.size === 'tall' ? ' tall' : '';
  card.className = `game-card${sizeClass}${!game.img ? ' no-img' : ''}`;
  card.style.animationDelay = `${Math.min(idx * 18, 400)}ms`;

  // image wrapper
  const wrap = el('div');
  wrap.className = 'card-img-wrap';
  if (game.img) {
    const img = el('img');
    img.src = game.img;
    img.alt = game.name;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => { wrap.remove(); card.classList.add('no-img'); };
    wrap.appendChild(img);
    card.appendChild(wrap);
  }

  // badge
  if (game.badge) {
    const b = el('div');
    b.className = `badge badge-${game.badge}`;
    b.textContent = game.badge === 'hot' ? '🔥 Hot' : '✦ New';
    card.appendChild(b);
  }

  // fav button
  const favBtn = el('button');
  favBtn.className = `card-fav-btn${isFav(game.slug) ? ' is-fav' : ''}`;
  favBtn.dataset.slug = game.slug;
  favBtn.title = 'Favorite';
  favBtn.innerHTML = `<svg viewBox="0 0 20 20" fill="${isFav(game.slug) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 16s-7-4.5-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 17 7c0 4.5-7 9-7 9z"/></svg>`;
  favBtn.addEventListener('click', e => { e.stopPropagation(); toggleFav(game.slug); updateFavBtnStyle(favBtn, game.slug); });
  card.appendChild(favBtn);

  // overlay
  const ov = el('div');
  ov.className = 'card-overlay';
  ov.innerHTML = `
    <div class="card-name">${game.name}</div>
    <div class="card-tags">${(game.tags || []).slice(0,2).join(' · ')}</div>
    <div class="card-play-pill"><svg viewBox="0 0 10 10"><path d="M3 2l5 3-5 3V2z"/></svg>Play</div>`;
  card.appendChild(ov);

  card.addEventListener('click', () => openGame(game));
  return card;
}

function updateFavBtnStyle(btn, slug) {
  const fav = isFav(slug);
  btn.classList.toggle('is-fav', fav);
  btn.innerHTML = `<svg viewBox="0 0 20 20" fill="${fav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 16s-7-4.5-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 17 7c0 4.5-7 9-7 9z"/></svg>`;
}

/* ══════════════════════════════════════════
   GRID RENDER
══════════════════════════════════════════ */
function getFiltered() {
  let list = activeFilter === 'all'
    ? [...allGames]
    : allGames.filter(g => (g.tags || []).includes(activeFilter));
  switch (activeSort) {
    case 'az':  list.sort((a,b) => a.name.localeCompare(b.name)); break;
    case 'za':  list.sort((a,b) => b.name.localeCompare(a.name)); break;
    case 'hot': list.sort((a,b) => (b.badge==='hot'?1:0)-(a.badge==='hot'?1:0)); break;
    case 'new': list.sort((a,b) => (b.badge==='new'?1:0)-(a.badge==='new'?1:0)); break;
  }
  return list;
}

function renderGrid() {
  const grid = $('gameGrid');
  const noR  = $('noResults');
  const cnt  = $('gameCount');
  grid.innerHTML = '';

  const list = getFiltered();
  cnt.textContent = `${list.length} game${list.length !== 1 ? 's' : ''}`;

  if (!list.length) {
    noR.style.display = 'flex';
  } else {
    noR.style.display = 'none';
    list.forEach((g, i) => grid.appendChild(buildCard(g, i)));
  }

  // ✅ FIX: null-guard so missing statGames element doesn't crash the script
  const statGamesEl = $('statGames');
  if (statGamesEl) statGamesEl.textContent = `${allGames.length}+`;
}

/* ══════════════════════════════════════════
   RECENTLY PLAYED STRIP
══════════════════════════════════════════ */
function renderRecentStrip() {
  const strip = $('recentStrip');
  const row   = $('recentStripRow');
  if (!recents.length) { strip.style.display = 'none'; return; }
  strip.style.display = '';
  row.innerHTML = '';
  recents.slice(0, 8).forEach(r => {
    const g = allGames.find(x => x.slug === r.slug);
    if (!g) return;
    const card = el('div');
    card.className = 'strip-card';
    card.title = g.name;
    if (g.img) {
      const img = el('img');
      img.src = g.img; img.alt = g.name; img.loading = 'lazy';
      img.onerror = () => img.remove();
      card.appendChild(img);
    }
    const label = el('div');
    label.className = 'strip-card-name';
    label.textContent = g.name;
    card.appendChild(label);
    card.addEventListener('click', () => openGame(g));
    row.appendChild(card);
  });
}

/* ══════════════════════════════════════════
   RECENTS PANEL
══════════════════════════════════════════ */
function renderRecentsPanel() {
  const body = $('recentsList');
  if (!recents.length) {
    body.innerHTML = '<p class="sp-empty">No games played yet. Go play something!</p>';
    return;
  }
  body.innerHTML = '';
  recents.forEach(r => {
    const g = allGames.find(x => x.slug === r.slug);
    if (!g) return;
    const ago = timeAgo(r.ts);
    body.appendChild(buildPanelItem(g, ago));
  });
}

function renderFavsPanel() {
  const body = $('favsList');
  if (!favorites.length) {
    body.innerHTML = '<p class="sp-empty">No favorites yet. Click ♥ on a game card to save it.</p>';
    return;
  }
  body.innerHTML = '';
  favorites.forEach(slug => {
    const g = allGames.find(x => x.slug === slug);
    if (!g) return;
    body.appendChild(buildPanelItem(g, '♥ Saved'));
  });
}

function buildPanelItem(game, sub) {
  const item = el('div');
  item.className = 'sp-game-item';
  const thumb = el('div');
  thumb.className = 'sp-game-thumb';
  if (game.img) {
    const img = el('img'); img.src = game.img; img.alt = game.name; img.loading = 'lazy';
    img.onerror = () => img.remove();
    thumb.appendChild(img);
  }
  const info = el('div');
  info.innerHTML = `<div class="sp-game-name">${game.name}</div><div class="sp-game-sub">${sub}</div>`;
  item.appendChild(thumb);
  item.appendChild(info);
  item.addEventListener('click', () => openGame(game));
  return item;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)  return 'Just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

/* ══════════════════════════════════════════
   SEARCH
══════════════════════════════════════════ */
function openSearch() {
  $('searchBackdrop').classList.add('open');
  setTimeout(() => $('searchInput').focus(), 40);
}
function closeSearch() {
  $('searchBackdrop').classList.remove('open');
  $('searchInput').value = '';
  $('searchResults').innerHTML = '<p class="sm-hint">Start typing to search across all games</p>';
}

function renderSearchResults(q) {
  const c = $('searchResults');
  if (!q) { c.innerHTML = '<p class="sm-hint">Start typing to search across all games</p>'; return; }
  const hits = allGames.filter(g =>
    g.name.toLowerCase().includes(q) ||
    (g.tags||[]).some(t => t.toLowerCase().includes(q))
  );
  if (!hits.length) { c.innerHTML = `<div class="sm-empty">No results for "<strong>${q}</strong>"</div>`; return; }
  c.innerHTML = '';
  hits.forEach(g => {
    const item = el('div');
    item.className = 'sr-item';
    item.innerHTML = `
      <div class="sr-thumb">${g.img ? `<img src="${g.img}" alt="" loading="lazy">` : '🎮'}</div>
      <div>
        <div class="sr-name">${highlight(g.name, q)}</div>
        <div class="sr-tags">${(g.tags||[]).slice(0,3).join(' · ')}</div>
      </div>`;
    item.addEventListener('click', () => { closeSearch(); openGame(g); });
    c.appendChild(item);
  });
}

function highlight(str, q) {
  const i = str.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return str;
  return str.slice(0,i) + `<mark style="background:rgba(255,255,255,0.15);border-radius:2px;color:inherit">${str.slice(i,i+q.length)}</mark>` + str.slice(i+q.length);
}

function initSearch() {
  $('navSearch').addEventListener('click', openSearch);
  $('heroSearch').addEventListener('click', openSearch);
  $('searchClose').addEventListener('click', closeSearch);
  $('searchBackdrop').addEventListener('click', e => { if (e.target === $('searchBackdrop')) closeSearch(); });
  $('searchInput').addEventListener('input', e => renderSearchResults(e.target.value.trim().toLowerCase()));
  document.addEventListener('keydown', e => {
    if (listeningKey) return;
    if ((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); openSearch(); }
    if (e.key==='Escape' && $('searchBackdrop').classList.contains('open')) closeSearch();
  });
}

/* ══════════════════════════════════════════
   CATEGORIES + SORT
══════════════════════════════════════════ */
function initCategories() {
  document.querySelectorAll('.cat').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.cat;
      renderGrid();
      window.scrollTo({ top: document.querySelector('.categories').offsetTop - 80, behavior: 'smooth' });
    });
  });
}

function filterCat(cat) {
  document.querySelectorAll('.cat').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.cat[data-cat="${cat}"]`);
  if (btn) btn.classList.add('active');
  activeFilter = cat;
  renderGrid();
}
window.filterCat = filterCat;

function initSort() {
  $('sortSelect').addEventListener('change', e => {
    activeSort = e.target.value;
    renderGrid();
  });
}

/* ══════════════════════════════════════════
   RANDOM GAME
══════════════════════════════════════════ */
function playRandom() {
  if (!allGames.length) return;
  const g = allGames[Math.floor(Math.random() * allGames.length)];
  openGame(g);
}

/* ══════════════════════════════════════════
   SIDE PANELS (recents / favs)
══════════════════════════════════════════ */
function initPanels() {
  // recents
  $('navRecents').addEventListener('click', () => {
    renderRecentsPanel();
    $('recentsPanel').classList.add('open');
    $('recentsBackdrop').classList.add('open');
  });
  $('recentsClose').addEventListener('click', () => {
    $('recentsPanel').classList.remove('open');
    $('recentsBackdrop').classList.remove('open');
  });
  $('recentsBackdrop').addEventListener('click', () => {
    $('recentsPanel').classList.remove('open');
    $('recentsBackdrop').classList.remove('open');
  });
  $('recentStripMore').addEventListener('click', () => {
    renderRecentsPanel();
    $('recentsPanel').classList.add('open');
    $('recentsBackdrop').classList.add('open');
  });

  // favs
  $('navFavs').addEventListener('click', () => {
    renderFavsPanel();
    $('favsPanel').classList.add('open');
    $('favsBackdrop').classList.add('open');
  });
  $('favsClose').addEventListener('click', () => {
    $('favsPanel').classList.remove('open');
    $('favsBackdrop').classList.remove('open');
  });
  $('favsBackdrop').addEventListener('click', () => {
    $('favsPanel').classList.remove('open');
    $('favsBackdrop').classList.remove('open');
  });
  $('footerFavs').addEventListener('click', e => {
    e.preventDefault();
    renderFavsPanel();
    $('favsPanel').classList.add('open');
    $('favsBackdrop').classList.add('open');
  });
}

/* ══════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════ */
function openSettings() {
  $('settingsDrawer').classList.add('open');
  $('drawerBackdrop').classList.add('open');
}
function closeSettings() {
  $('settingsDrawer').classList.remove('open');
  $('drawerBackdrop').classList.remove('open');
}

function initSettings() {
  $('navSettings').addEventListener('click', openSettings);
  $('settingsClose').addEventListener('click', closeSettings);
  $('drawerBackdrop').addEventListener('click', closeSettings);
  $('footerSettings').addEventListener('click', e => { e.preventDefault(); openSettings(); });
  $('footerCloak').addEventListener('click', e => { e.preventDefault(); openSettings(); });
  $('footerRandom').addEventListener('click', e => { e.preventDefault(); playRandom(); });

  // Cloak presets
  document.querySelectorAll('.preset-btn[data-title]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn[data-title]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyCloak(btn.dataset.title, btn.dataset.icon||'');
    });
  });

  // Custom cloak
  $('cloakApply').addEventListener('click', () => {
    const t = $('cloakTitle').value.trim();
    const i = $('cloakIcon').value.trim();
    if (t) { document.querySelectorAll('.preset-btn[data-title]').forEach(b => b.classList.remove('active')); applyCloak(t,i); toast('Tab cloaked ✓'); }
  });

  // Blank tab
  $('blankTabBtn').addEventListener('click', () => {
    $('footerBlank').click();
  });
  $('footerBlank').addEventListener('click', e => {
    e.preventDefault();
    const w = window.open('about:blank','_blank');
    if (!w) { alert('Allow popups.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><title>${document.title}</title><style>*{margin:0;padding:0}iframe{width:100vw;height:100vh;border:none;display:block;background:#0e0e0e}</style></head><body><iframe src="${location.href}"></iframe></body></html>`);
    w.document.close();
  });

  // Panic key
  $('panicUrl').addEventListener('change', () => { panicTarget = $('panicUrl').value.trim(); });
  $('panicKeyBtn').addEventListener('click', () => {
    if (listeningKey) return;
    listeningKey = true;
    $('panicKeyBtn').innerHTML = 'Press any key…';
    const h = e => {
      e.preventDefault();
      panicKey = e.key;
      $('panicKeyLabel').textContent = panicKey;
      $('panicKeyBtn').innerHTML = `Key: <span id="panicKeyLabel">${panicKey}</span>`;
      listeningKey = false;
      window.removeEventListener('keydown', h, true);
    };
    window.addEventListener('keydown', h, true);
  });

  // Themes
  const themes = { themeDefault:'', themeAsh:'theme-ash', themeMidnight:'theme-midnight' };
  Object.entries(themes).forEach(([id, cls]) => {
    $(id)?.addEventListener('click', () => {
      document.body.className = document.body.className.replace(/theme-\S+/g,'').trim();
      if (cls) document.body.classList.add(cls);
      document.querySelectorAll('#themeDefault,#themeAsh,#themeMidnight').forEach(b => b.classList.remove('active'));
      $(id).classList.add('active');
      saveStore('jub_theme', cls);
      toast('Theme applied ✓');
    });
  });

  // Card sizes
  const sizes = { sizeSmall:'size-small', sizeMedium:'', sizeLarge:'size-large' };
  Object.entries(sizes).forEach(([id, cls]) => {
    $(id)?.addEventListener('click', () => {
      document.body.className = document.body.className.replace(/size-\S+/g,'').trim();
      if (cls) document.body.classList.add(cls);
      document.querySelectorAll('#sizeSmall,#sizeMedium,#sizeLarge').forEach(b => b.classList.remove('active'));
      $(id).classList.add('active');
      saveStore('jub_size', cls);
    });
  });

  // Clear data
  $('clearDataBtn').addEventListener('click', () => {
    if (!confirm('Clear all history and favorites? This cannot be undone.')) return;
    favorites = []; recents = [];
    saveStore('jub_favs', []); saveStore('jub_recents', []);
    renderGrid();
    renderRecentStrip();
    toast('Data cleared ✓');
  });

  // Panic key fire
  document.addEventListener('keydown', e => {
    if (listeningKey) return;
    if (!$('searchBackdrop').classList.contains('open') && e.key === panicKey && panicKey !== '') {
      location.href = panicTarget;
    }
  });

  // Restore saved prefs
  const savedTheme = loadStore('jub_theme','');
  if (savedTheme) { document.body.classList.add(savedTheme); }
  const savedSize = loadStore('jub_size','');
  if (savedSize) { document.body.classList.add(savedSize); }
}

/* ══════════════════════════════════════════
   TAB CLOAK
══════════════════════════════════════════ */
const DEFAULT_FAV = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23141414'/><text x='16' y='23' text-anchor='middle' font-size='18'>🐆</text></svg>";

function applyCloak(title, iconUrl) {
  document.title = title;
  $('favicon').href = iconUrl || DEFAULT_FAV;
}

/* ══════════════════════════════════════════
   FAQ
══════════════════════════════════════════ */
function initFaq() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(o => o.classList.remove('open'));
      if (!open) item.classList.add('open');
    });
  });
}

/* ══════════════════════════════════════════
   KEYBOARD SHORTCUTS
══════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (listeningKey) return;
    if (e.target.tagName === 'INPUT') return;
    // R = random
    if (e.key === 'r' || e.key === 'R') playRandom();
  });
}

/* ══════════════════════════════════════════
   FOOTER BUILD STAMP
══════════════════════════════════════════ */
function setBuildStamp() {
  const b = $('footerBuild');
  if (b) b.textContent = `v2026.04 · ${allGames.length} games`;
}

/* ══════════════════════════════════════════
   TODAY STAT INIT
══════════════════════════════════════════ */
function initStats() {
  const today = new Date().toDateString();
  if (playedToday.date !== today) { playedToday = { date: today, count: 0 }; saveStore('jub_today', playedToday); }
  // ✅ FIX: null-guard so missing statPlayed element doesn't crash the script
  const statEl = $('statPlayed');
  if (statEl) statEl.textContent = playedToday.count;
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
async function init() {
  // Load games
  try {
    const res = await fetch(GAMES_JSON);
    allGames  = await res.json();
  } catch {
    allGames = [
      { name:"Slope",             slug:"slope",            tags:["racing","3d"],           badge:"hot",  size:"wide" },
      { name:"1v1.LOL",           slug:"1v1lol",           tags:["shooting","action"],      badge:"hot"               },
      { name:"Cookie Clicker",    slug:"cookie-clicker",   tags:["idle","clicker"],         badge:null                },
      { name:"Among Us",          slug:"among-us",         tags:["multiplayer","social"],   badge:"hot",  size:"wide" },
      { name:"Drift Hunters",     slug:"drift-hunters",    tags:["racing","drift"],         badge:"hot"               },
      { name:"2048",              slug:"2048",              tags:["puzzle","numbers"],       badge:null                },
      { name:"Doodle Jump",       slug:"doodle-jump",      tags:["platform","jump"],        badge:null                },
      { name:"Chrome Dino",       slug:"chrome-dino",      tags:["endless","runner"],       badge:null                },
      { name:"Bad Ice Cream",     slug:"bad-ice-cream",    tags:["puzzle","arcade"],        badge:null                },
      { name:"Bloons TD",         slug:"bloonstd",         tags:["strategy"],               badge:null                },
      { name:"Basketball Stars",  slug:"basketball-stars", tags:["sports"],                 badge:null,   size:"wide" },
      { name:"Cluster Rush",      slug:"cluster-rush",     tags:["action"],                 badge:"hot"               },
      { name:"Drift Boss",        slug:"drift-boss",       tags:["racing"],                 badge:null                },
      { name:"BitLife",           slug:"bitlife",          tags:["simulation"],             badge:null                },
      { name:"10 Min Till Dawn",  slug:"10-minutes-till-dawn", tags:["action","roguelike"], badge:"new"               },
      { name:"Death Run 3D",      slug:"death-run-3d",     tags:["racing","3d"],            badge:null                },
      { name:"HexGL",             slug:"HexGL",            tags:["racing","futuristic"],    badge:null                },
      { name:"Crossy Road",       slug:"crossyroad",       tags:["arcade"],                 badge:null                },
      { name:"A Dark Room",       slug:"adarkroom",        tags:["idle","rpg"],             badge:null                },
      { name:"Baldi's Basics",    slug:"baldis-basics",    tags:["horror","puzzle"],        badge:null                },
    ];
  }

  renderGrid();
  renderRecentStrip();
  initStats();
  initSearch();
  initCategories();
  initSort();
  initPanels();
  initSettings();
  initViewer();
  initFaq();
  initKeyboard();
  setBuildStamp();

  // hero random button
  $('heroPlay').addEventListener('click', playRandom);

  // Update navbar fav/recent badges live
  $('navFavs').classList.toggle('active', favorites.length > 0);
}

document.addEventListener('DOMContentLoaded', init);
