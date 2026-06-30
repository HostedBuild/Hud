'use strict';

// ─── DOM ─────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
  clock: $('clock'), zone: $('zone-name'),
  cash:  $('cash'),  bank: $('bank'),
  jobLabel: $('job-label'), jobGrade: $('job-grade'),
  healthBar: $('health-bar'), healthVal: $('health-val'),
  armorBar:  $('armor-bar'),  armorVal:  $('armor-val'),
  hungerBar: $('hunger-bar'), hungerVal: $('hunger-val'),
  thirstBar: $('thirst-bar'), thirstVal: $('thirst-val'),
  rowHunger: $('row-hunger'), rowThirst: $('row-thirst'),
  speedometer: $('speedometer'),
  speedVal: $('speed-value'), gearVal: $('gear-val'), rpmFill: $('rpm-fill'),
  streetName: $('street-name'), streetZone: $('street-zone'),
  compassDir: $('compass-dir'),
  // panels
  topLeft:     $('top-left'),
  topRight:    $('top-right'),
  bottomLeft:  $('bottom-left'),
  bottomRight: $('bottom-right'),
  // settings
  overlay:   $('settings-overlay'),
  panel:     $('settings-panel'),
  // cinematic
  cinTop:    $('cinematic-top'),
  cinBot:    $('cinematic-bottom'),
  // vignette / notifications / voice
  vignette:  $('health-vignette'),
  notifWrap: $('notif-wrap'),
  rowVoice:  $('row-voice'),
  voiceLabel: $('voice-state-label'),
  // drag
  dragBanner: $('drag-banner'),
};

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  hasStatus: false,
  inVehicle: false,
  iconStyle: 1,

  // persisted via localStorage
  vis: {
    health: true, armor: true,
    hunger: true, thirst: true,
    money:  true, job:   true,
    clock:  true, compass: true,
    street: true, speed: true,
  },
  minimapCircle: false,
  hideRadar:     false,
  hudDisabled:   false,
  cinematic:     false,
  positions:     {},   // { 'top-left': { top: '20px', left: '20px' }, ... }
};

// ─── DRAGGABLE CONFIG ────────────────────────────────────────────────────────
const DRAGGABLE_IDS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function setBar(bar, valEl, value, max = 100) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  bar.style.width  = pct + '%';
  valEl.textContent = value;
  bar.classList.toggle('low', pct <= 25);
}

function formatMoney(n) {
  return '$' + Number(n).toLocaleString('it-IT');
}

const RPM_CIRC = 2 * Math.PI * 50; // ≈ 314
function setRpm(rpm) {
  const filled = Math.min(1, rpm) * RPM_CIRC;
  DOM.rpmFill.style.strokeDasharray = `${filled} ${RPM_CIRC}`;
}


function nuiPost(callback, data = {}) {
  return fetch(`https://hud/${callback}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

// ─── VISIBILITY APPLY ────────────────────────────────────────────────────────
const VIS_MAP = {
  health:  el => $('health').closest ? document.querySelector('[data-hud="health"]') : document.querySelector('.stat-row[data-hud="health"]'),
  armor:   () => document.querySelector('.stat-row[data-hud="armor"]'),
  hunger:  () => DOM.rowHunger,
  thirst:  () => DOM.rowThirst,
  money:   () => DOM.topRight,
  job:     () => $('job-card'),
  clock:   () => DOM.topLeft,
  compass: () => $('compass-wrap'),
  street: () => $('street-info'),
  speed:  null, // handled differently (vehicle-gated)
};

function applyVisibility() {
  const v = state.vis;

  toggleEl(document.querySelector('.stat-row[data-hud="health"]'), v.health);
  toggleEl(document.querySelector('.stat-row[data-hud="armor"]'),  v.armor);
  if (state.hasStatus) {
    toggleEl(DOM.rowHunger, v.hunger);
    toggleEl(DOM.rowThirst, v.thirst);
  }
  toggleEl(DOM.topRight, v.money);
  toggleEl($('job-card'),  v.job);
  toggleEl(DOM.topLeft,   v.clock);
  toggleEl($('compass-wrap'), v.compass);
  toggleEl($('street-info'),  v.street);
  // speed: only visible when in vehicle AND vis.speed is on
  if (!v.speed) {
    DOM.speedometer.classList.add('hidden');
  } else if (state.inVehicle) {
    DOM.speedometer.classList.remove('hidden');
  }
}

function toggleEl(el, visible) {
  if (!el) return;
  el.style.opacity = visible ? '' : '0';
  el.style.pointerEvents = visible ? '' : 'none';
}

// ─── CINEMATIC MODE ──────────────────────────────────────────────────────────
function setCinematic(on) {
  document.body.classList.toggle('cinematic', on);
}

// ─── HEALTH VIGNETTE ─────────────────────────────────────────────────────────
function updateVignette(health) {
  const v = DOM.vignette;
  if (health > 40) {
    v.className = '';
  } else if (health > 20) {
    const intensity = ((40 - health) / 40 * 0.55 + 0.1).toFixed(2);
    v.style.setProperty('--vig-op', intensity);
    v.className = 'low';
  } else {
    const intensity = Math.min(0.75, 0.45 + (20 - health) / 40).toFixed(2);
    v.style.setProperty('--vig-op', intensity);
    v.className = 'low critical';
  }
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
const NOTIF_MAX = 5;
const NOTIF_ICONS = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
const NOTIF_TITLES = { success: 'Successo', error: 'Errore', info: 'Info', warning: 'Attenzione' };

function addNotification(type, msg, duration) {
  duration = duration || 4500;
  type = ['success','error','info','warning'].includes(type) ? type : 'info';

  // Trim oldest if at max
  const existing = DOM.notifWrap.querySelectorAll('.notif');
  if (existing.length >= NOTIF_MAX) dismissNotif(existing[existing.length - 1]);

  const el = document.createElement('div');
  el.className = `notif notif-${type}`;
  el.innerHTML = `
    <div class="notif-icon-wrap">${NOTIF_ICONS[type]}</div>
    <div class="notif-body">
      <div class="notif-title">${NOTIF_TITLES[type]}</div>
      <div class="notif-msg">${msg}</div>
    </div>
    <button class="notif-close" aria-label="Chiudi">✕</button>
    <div class="notif-progress"></div>
  `;

  DOM.notifWrap.prepend(el);

  // Animate progress bar
  const bar = el.querySelector('.notif-progress');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transition = `width ${duration}ms linear`;
    bar.style.width = '0%';
  }));

  el.querySelector('.notif-close').addEventListener('click', e => {
    e.stopPropagation();
    dismissNotif(el);
  });
  el.addEventListener('click', () => dismissNotif(el));

  el._timer = setTimeout(() => dismissNotif(el), duration);
}

function dismissNotif(el) {
  if (!el || !el.parentNode) return;
  clearTimeout(el._timer);
  el.classList.add('notif-out');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// ─── VOICE INDICATOR ─────────────────────────────────────────────────────────
const VOICE_LABELS = { 0: '—', 1: 'PARLA', 2: 'RADIO' };

function setVoiceState(mode) {
  const row = DOM.rowVoice;
  row.classList.remove('talking', 'radio');
  if (mode === 1) row.classList.add('talking');
  if (mode === 2) row.classList.add('radio');
  DOM.voiceLabel.textContent = VOICE_LABELS[mode] || '—';
}

// ─── ICON STYLE ──────────────────────────────────────────────────────────────
function applyIconStyle(n) {
  state.iconStyle = n;
  document.body.dataset.iconStyle = n;
  document.querySelectorAll('.icon-style-card').forEach(card => {
    card.classList.toggle('active', parseInt(card.dataset.style) === n);
  });
}

// ─── PERSISTENCE (localStorage) ──────────────────────────────────────────────
function saveLocal() {
  try {
    localStorage.setItem('hud_vis',       JSON.stringify(state.vis));
    localStorage.setItem('hud_options',   JSON.stringify({
      minimapCircle: state.minimapCircle,
      hideRadar:     state.hideRadar,
      hudDisabled:   state.hudDisabled,
      cinematic:     state.cinematic,
      iconStyle:     state.iconStyle,
    }));
    localStorage.setItem('hud_positions', JSON.stringify(state.positions));
  } catch (_) {}
}

function loadLocal() {
  try {
    const vis  = JSON.parse(localStorage.getItem('hud_vis')     || '{}');
    const opts = JSON.parse(localStorage.getItem('hud_options') || '{}');
    const pos  = JSON.parse(localStorage.getItem('hud_positions') || '{}');

    Object.assign(state.vis, vis);
    if (opts.iconStyle) state.iconStyle = opts.iconStyle;
    Object.assign(state, opts);
    state.positions = pos;
  } catch (_) {}
}

function restorePositions() {
  DRAGGABLE_IDS.forEach(id => {
    const el  = $(id); if (!el) return;
    const pos = state.positions[id];
    if (pos) {
      el.style.top    = pos.top;
      el.style.left   = pos.left;
      el.style.bottom = 'auto';
      el.style.right  = 'auto';
    }
  });
}

function resetPositions() {
  state.positions = {};
  DRAGGABLE_IDS.forEach(id => {
    const el = $(id); if (!el) return;
    el.style.top    = '';
    el.style.left   = '';
    el.style.bottom = '';
    el.style.right  = '';
  });
  saveLocal();
}

// ─── DRAG MODE ───────────────────────────────────────────────────────────────
let dragModeActive = false;
const dragCleanup  = new Map();

function enableDragMode() {
  dragModeActive = true;
  document.body.classList.add('drag-mode');
  DOM.dragBanner.classList.remove('hidden');

  DRAGGABLE_IDS.forEach(id => {
    const el = $(id); if (!el) return;

    // Convert to top/left positioning so we can track movement uniformly
    const rect = el.getBoundingClientRect();
    el.style.position = 'fixed';
    el.style.top      = rect.top  + 'px';
    el.style.left     = rect.left + 'px';
    el.style.bottom   = 'auto';
    el.style.right    = 'auto';

    const onDown = function(e) {
      if (!dragModeActive) return;
      e.preventDefault();
      e.stopPropagation();

      const startX    = e.clientX;
      const startY    = e.clientY;
      const startLeft = parseFloat(el.style.left) || 0;
      const startTop  = parseFloat(el.style.top)  || 0;
      const elW = el.offsetWidth;
      const elH = el.offsetHeight;

      function onMove(e) {
        let newLeft = startLeft + (e.clientX - startX);
        let newTop  = startTop  + (e.clientY - startY);
        newLeft = Math.max(0, Math.min(window.innerWidth  - elW, newLeft));
        newTop  = Math.max(0, Math.min(window.innerHeight - elH, newTop));
        el.style.left = newLeft + 'px';
        el.style.top  = newTop  + 'px';
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        // Save position
        state.positions[id] = { top: el.style.top, left: el.style.left };
        saveLocal();
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    };

    el.addEventListener('mousedown', onDown);
    dragCleanup.set(id, () => el.removeEventListener('mousedown', onDown));
  });

  nuiPost('enterDragMode');
}

function disableDragMode() {
  dragModeActive = false;
  document.body.classList.remove('drag-mode');
  DOM.dragBanner.classList.add('hidden');

  dragCleanup.forEach(fn => fn());
  dragCleanup.clear();

  nuiPost('exitDragMode');
}

// ─── SETTINGS PANEL ──────────────────────────────────────────────────────────
let settingsOpen = false;

// Saved snapshot for "Cancel"
let snapshot = {};

function openSettings(luaSettings) {
  // Sync with Lua-side settings if provided
  if (luaSettings) {
    state.minimapCircle = luaSettings.minimapCircle || false;
    state.hideRadar     = luaSettings.hideRadar     || false;
    state.hudDisabled   = luaSettings.hudDisabled   || false;
    state.cinematic     = luaSettings.cinematicMode || false;
  }

  // Snapshot for cancel
  snapshot = {
    vis: { ...state.vis },
    minimapCircle: state.minimapCircle,
    hideRadar:     state.hideRadar,
    hudDisabled:   state.hudDisabled,
    cinematic:     state.cinematic,
    iconStyle:     state.iconStyle,
  };

  syncPanelToState();
  DOM.overlay.classList.remove('hidden');
  settingsOpen = true;
}

function closeSettings() {
  DOM.overlay.classList.add('hidden');
  settingsOpen = false;
  nuiPost('closeSettings');
}

function cancelSettings() {
  // Restore snapshot
  Object.assign(state.vis, snapshot.vis);
  state.minimapCircle = snapshot.minimapCircle;
  state.hideRadar     = snapshot.hideRadar;
  state.hudDisabled   = snapshot.hudDisabled;
  state.cinematic     = snapshot.cinematic;
  applyIconStyle(snapshot.iconStyle);

  applyVisibility();
  setCinematic(state.cinematic);
  closeSettings();
}

function saveSettings() {
  saveLocal();
  nuiPost('applySettings', {
    minimapCircle: state.minimapCircle,
    hideRadar:     state.hideRadar,
    hudDisabled:   state.hudDisabled,
    cinematicMode: state.cinematic,
  });
  closeSettings();
}

function syncPanelToState() {
  const v = state.vis;
  $('v-health').checked    = v.health;
  $('v-armor').checked     = v.armor;
  $('v-hunger').checked    = v.hunger;
  $('v-thirst').checked    = v.thirst;
  $('v-money').checked     = v.money;
  $('v-job').checked       = v.job;
  $('v-clock').checked     = v.clock;
  $('v-compass').checked   = v.compass;
  $('v-street').checked    = v.street;
  $('v-speed').checked     = v.speed;
  $('v-hideradar').checked = state.hideRadar;
  $('v-huddisabled').checked = state.hudDisabled;
  $('v-cinematic').checked   = state.cinematic;

  $('shape-square').classList.toggle('active', !state.minimapCircle);
  $('shape-circle').classList.toggle('active',  state.minimapCircle);
  $('cinema-preview').classList.toggle('hidden', !state.cinematic);
  applyIconStyle(state.iconStyle);
}

// ─── PANEL EVENT WIRING ──────────────────────────────────────────────────────
function wireSettings() {
  // Tabs
  document.querySelectorAll('.sp-tab').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.sp-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sp-tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Visibility toggles — instant preview
  const visToggles = {
    'v-health': 'health', 'v-armor': 'armor',
    'v-hunger': 'hunger', 'v-thirst': 'thirst',
    'v-money':  'money',  'v-job':    'job',
    'v-clock':  'clock',  'v-compass': 'compass',
    'v-street': 'street', 'v-speed': 'speed',
  };
  Object.entries(visToggles).forEach(([id, key]) => {
    $(id).addEventListener('change', function() {
      state.vis[key] = this.checked;
      applyVisibility();
    });
  });

  // Hide radar toggle
  $('v-hideradar').addEventListener('change', function() {
    state.hideRadar = this.checked;
  });

  // Disable HUD
  $('v-huddisabled').addEventListener('change', function() {
    state.hudDisabled = this.checked;
  });

  // Cinematic — instant preview
  $('v-cinematic').addEventListener('change', function() {
    state.cinematic = this.checked;
    setCinematic(state.cinematic);
    $('cinema-preview').classList.toggle('hidden', !state.cinematic);
  });

  // Map shape
  $('shape-square').addEventListener('click', function() {
    state.minimapCircle = false;
    $('shape-square').classList.add('active');
    $('shape-circle').classList.remove('active');
  });
  $('shape-circle').addEventListener('click', function() {
    state.minimapCircle = true;
    $('shape-circle').classList.add('active');
    $('shape-square').classList.remove('active');
  });

  // Drag buttons
  $('btn-enable-drag').addEventListener('click', function() {
    if (dragModeActive) {
      disableDragMode();
      this.classList.remove('active');
      this.textContent = '⠿  Abilita Trascinamento';
    } else {
      enableDragMode();
      this.classList.add('active');
      this.textContent = '✓  Trascinamento Attivo';
      // Close settings so the user can drag
      DOM.overlay.classList.add('hidden');
      settingsOpen = false;
      // Don't call closeSettings() — keeps NUI focus for dragging
    }
  });

  $('btn-reset-pos').addEventListener('click', resetPositions);

  // Icon style cards — instant preview
  document.querySelectorAll('.icon-style-card').forEach(card => {
    card.addEventListener('click', function() {
      applyIconStyle(parseInt(this.dataset.style));
    });
  });

  // Close / save / cancel
  $('sp-close').addEventListener('click',  cancelSettings);
  $('sp-cancel').addEventListener('click', cancelSettings);
  $('sp-save').addEventListener('click',   saveSettings);

  // Drag exit banner
  $('drag-exit-btn').addEventListener('click', function() {
    disableDragMode();
    $('btn-enable-drag').classList.remove('active');
    $('btn-enable-drag').innerHTML = '<span>⠿</span> Abilita Trascinamento';
  });

  // ESC to close
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (dragModeActive) {
        disableDragMode();
        $('btn-enable-drag').classList.remove('active');
        $('btn-enable-drag').innerHTML = '<span>⠿</span> Abilita Trascinamento';
      } else if (settingsOpen) {
        cancelSettings();
      }
    }
  });

  // Click overlay backdrop to cancel
  DOM.overlay.addEventListener('click', function(e) {
    if (e.target === DOM.overlay) cancelSettings();
  });
}

// ─── NUI MESSAGE HANDLER ────────────────────────────────────────────────────
window.addEventListener('message', function(e) {
  const data = e.data;
  if (!data || !data.action) return;

  switch (data.action) {

    case 'show':
      document.body.style.visibility = 'visible';
      break;

    case 'hide':
      document.body.style.visibility = 'hidden';
      break;

    case 'openSettings':
      openSettings(data.settings);
      break;

    case 'loadSettings':
      // Apply Lua-saved settings on resource start
      if (data.settings) {
        state.minimapCircle = data.settings.minimapCircle || false;
        state.hideRadar     = data.settings.hideRadar     || false;
        state.hudDisabled   = data.settings.hudDisabled   || false;
        state.cinematic     = data.settings.cinematicMode || false;
        setCinematic(state.cinematic);
      }
      break;

    case 'status':
      state.hasStatus = true;
      setBar(DOM.hungerBar, DOM.hungerVal, data.hunger ?? 100);
      setBar(DOM.thirstBar, DOM.thirstVal, data.thirst ?? 100);
      if (state.vis.hunger) DOM.rowHunger.classList.remove('hidden');
      if (state.vis.thirst) DOM.rowThirst.classList.remove('hidden');
      break;

    case 'notification':
      addNotification(data.notifType || 'info', data.msg || '', data.duration);
      break;

    case 'voiceState':
      setVoiceState(data.mode ?? 0);
      break;

    case 'voiceRange':
      // Optional: update label with proximity range name
      if (DOM.rowVoice.classList.contains('talking')) break;
      DOM.voiceLabel.textContent = data.range ? `Rng ${data.range}` : '—';
      break;

    case 'update': {
      updateVignette(data.health ?? 100);
      setBar(DOM.healthBar, DOM.healthVal, data.health ?? 100);
      setBar(DOM.armorBar,  DOM.armorVal,  data.armor  ?? 0);

      if (data.time)   DOM.clock.textContent     = data.time;
      if (data.zone)   DOM.zone.textContent       = data.zone;
      if (data.cash  !== undefined) DOM.cash.textContent     = formatMoney(data.cash);
      if (data.bank  !== undefined) DOM.bank.textContent     = formatMoney(data.bank);
      if (data.job   !== undefined) DOM.jobLabel.textContent = data.job || 'Disoccupato';
      if (data.grade !== undefined) DOM.jobGrade.textContent = data.grade || '';
      if (data.street)  DOM.streetName.textContent = data.street;
      if (data.zone)    DOM.streetZone.textContent = data.zone;
      if (data.compass) DOM.compassDir.textContent = data.compass;

      state.inVehicle = !!data.inVehicle;
      if (data.inVehicle && state.vis.speed) {
        DOM.speedometer.classList.remove('hidden');
        DOM.speedVal.textContent = data.speed ?? 0;
        DOM.gearVal.textContent  = data.gear  ?? 1;
        setRpm(data.rpm ?? 0);
      } else {
        DOM.speedometer.classList.add('hidden');
      }

      // Hide hunger/thirst if no esx_status
      if (!state.hasStatus) {
        DOM.rowHunger.classList.add('hidden');
        DOM.rowThirst.classList.add('hidden');
      }
      break;
    }
  }
});

// ─── INIT ────────────────────────────────────────────────────────────────────
loadLocal();
applyVisibility();
setCinematic(state.cinematic);
applyIconStyle(state.iconStyle);
restorePositions();
wireSettings();

// Hide hunger/thirst until esx_status sends data
DOM.rowHunger.classList.add('hidden');
DOM.rowThirst.classList.add('hidden');

nuiPost('hudReady').catch(() => {});
