'use strict';

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const DOM = {
  // clock
  clock:       $('clock'),
  zone:        $('zone-name'),
  // money
  cash:        $('cash'),
  bank:        $('bank'),
  jobLabel:    $('job-label'),
  jobGrade:    $('job-grade'),
  // vitals
  healthBar:   $('health-bar'),  healthVal:  $('health-val'),
  armorBar:    $('armor-bar'),   armorVal:   $('armor-val'),
  hungerBar:   $('hunger-bar'),  hungerVal:  $('hunger-val'),
  thirstBar:   $('thirst-bar'),  thirstVal:  $('thirst-val'),
  rowHunger:   $('row-hunger'),  rowThirst:  $('row-thirst'),
  // vehicle
  speedometer: $('speedometer'),
  speedVal:    $('speed-value'),
  speedUnit:   $('speed-unit'),
  gearVal:     $('gear-val'),
  rpmFill:     $('rpm-fill'),
  // street / compass
  streetName:  $('street-name'),
  streetZone:  $('street-zone'),
  compassDir:  $('compass-dir'),
  // wanted
  wantedWrap:  $('wanted-wrap'),
  stars:       [null, $('s1'), $('s2'), $('s3'), $('s4'), $('s5')],
};

// ─── STATE ───────────────────────────────────────────────────────────────────
let state = {
  health: 100, armor: 0,
  hunger: 100, thirst: 100,
  hasStatus: false,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function setBar(bar, valEl, value, max = 100) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  bar.style.width = pct + '%';
  valEl.textContent = value;
  bar.classList.toggle('low', pct <= 25);
}

function formatMoney(n) {
  return '$' + Number(n).toLocaleString('it-IT');
}

// RPM arc: circumference = 2π*50 ≈ 314
const RPM_CIRC = 2 * Math.PI * 50;
function setRpm(rpm) {
  const filled = rpm * RPM_CIRC;
  DOM.rpmFill.style.strokeDasharray = `${filled} ${RPM_CIRC}`;
}

function setWanted(level) {
  const show = level > 0;
  DOM.wantedWrap.classList.toggle('hidden', !show);
  for (let i = 1; i <= 5; i++) {
    DOM.stars[i].classList.toggle('active', i <= level);
  }
}

// ─── NUI MESSAGE HANDLER ────────────────────────────────────────────────────
window.addEventListener('message', function(event) {
  const data = event.data;
  if (!data || !data.action) return;

  if (data.action === 'show') {
    document.body.style.display = '';
    return;
  }

  if (data.action === 'hide') {
    document.body.style.display = 'none';
    return;
  }

  if (data.action === 'status') {
    state.hasStatus = true;
    state.hunger = data.hunger ?? state.hunger;
    state.thirst = data.thirst ?? state.thirst;
    DOM.rowHunger.classList.remove('hidden');
    DOM.rowThirst.classList.remove('hidden');
    setBar(DOM.hungerBar, DOM.hungerVal, state.hunger);
    setBar(DOM.thirstBar, DOM.thirstVal, state.thirst);
    return;
  }

  if (data.action === 'update') {
    // ── Vitals ──
    setBar(DOM.healthBar, DOM.healthVal, data.health ?? state.health);
    setBar(DOM.armorBar,  DOM.armorVal,  data.armor  ?? state.armor);

    // Hide hunger/thirst rows if esx_status not detected
    if (!state.hasStatus) {
      DOM.rowHunger.classList.add('hidden');
      DOM.rowThirst.classList.add('hidden');
    }

    // ── Clock / Zone ──
    if (data.time)   DOM.clock.textContent = data.time;
    if (data.zone)   DOM.zone.textContent  = data.zone;

    // ── Money / Job ──
    if (data.cash  !== undefined) DOM.cash.textContent     = formatMoney(data.cash);
    if (data.bank  !== undefined) DOM.bank.textContent     = formatMoney(data.bank);
    if (data.job   !== undefined) DOM.jobLabel.textContent = data.job  || 'Disoccupato';
    if (data.grade !== undefined) DOM.jobGrade.textContent = data.grade || '';

    // ── Street / Compass ──
    if (data.street)  DOM.streetName.textContent = data.street;
    if (data.zone)    DOM.streetZone.textContent = data.zone;
    if (data.compass) DOM.compassDir.textContent = data.compass;

    // ── Vehicle ──
    if (data.inVehicle) {
      DOM.speedometer.classList.remove('hidden');
      DOM.speedVal.textContent = data.speed ?? 0;
      DOM.gearVal.textContent  = data.gear  ?? 1;
      setRpm(data.rpm ?? 0);
    } else {
      DOM.speedometer.classList.add('hidden');
    }

    // ── Wanted ──
    setWanted(data.wanted ?? 0);
  }
});

// ─── INIT: notify Lua the UI is ready ────────────────────────────────────────
fetch('https://hud/hudReady', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
}).catch(() => {});

// Hide hunger/thirst by default (shown only if esx_status sends data)
DOM.rowHunger.classList.add('hidden');
DOM.rowThirst.classList.add('hidden');
