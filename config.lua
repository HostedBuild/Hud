-- ════════════════════════════════════════════════════════════════
--  CONFIG.LUA — Impostazioni globali dell'HUD
--  Modifica qui senza toccare il codice principale.
-- ════════════════════════════════════════════════════════════════
Config = {}

-- ── Aggiornamento ────────────────────────────────────────────────────────────
-- Frequenza in ms con cui vengono aggiornati i dati dell'HUD.
-- Valori consigliati: 300–1000. Non scendere sotto 200.
Config.UpdateInterval = 500

-- ── Comando impostazioni ──────────────────────────────────────────────────────
-- Comando chat per aprire il pannello impostazioni HUD.
Config.SettingsCommand = 'hd'

-- ── Unità di velocità ─────────────────────────────────────────────────────────
-- 'kmh'  → km/h  (moltiplicatore 3.6)
-- 'mph'  → mph   (moltiplicatore 2.237)
Config.SpeedUnit = 'kmh'

-- ── Sistema voce ─────────────────────────────────────────────────────────────
-- Plugin voce installato sul server.
-- 'auto'        → rileva automaticamente tutti e tre (sconsigliato in prod)
-- 'pma-voice'   → usa solo pma-voice
-- 'mumble-voip' → usa solo mumble-voip
-- 'saltychat'   → usa solo SaltyChat
Config.VoiceSystem = 'auto'

-- ── ID Giocatore ──────────────────────────────────────────────────────────────
-- Mostra l'ID server del giocatore nell'orologio in alto a sinistra.
Config.ShowPlayerId = true

-- ── Risorsa stato (fame / sete) ───────────────────────────────────────────────
-- Nome della risorsa esx_status. Imposta nil per disabilitare fame e sete.
Config.StatusResource = 'esx_status'

-- ── Notifiche ─────────────────────────────────────────────────────────────────
-- Durata predefinita delle notifiche in ms (usata se non specificata).
Config.NotifDuration = 4500
-- Numero massimo di notifiche mostrate contemporaneamente.
Config.NotifMax = 5

-- ── Soglie vignette (avviso salute bassa) ────────────────────────────────────
-- Sotto Config.VignetteLow:      la vignette rossa diventa visibile.
-- Sotto Config.VignetteCritical: la vignette inizia a pulsare.
Config.VignetteLow      = 40
Config.VignetteCritical = 20

-- ── Soglie colore motore ──────────────────────────────────────────────────────
-- Sopra EngineGood: barra verde.
-- Tra EngineWarn e EngineGood: barra arancione.
-- Sotto EngineWarn: barra rossa.
Config.EngineGood = 70
Config.EngineWarn = 40

-- ── Soglia barra critica ──────────────────────────────────────────────────────
-- Percentuale sotto la quale le barre iniziano a pulsare (salute, armatura ecc).
Config.LowBarThreshold = 25

-- ── Valori predefiniti delle impostazioni player ─────────────────────────────
-- Questi valori vengono usati solo se il player non ha ancora salvato
-- preferenze personali (primo avvio). Successivamente prevalgono le
-- preferenze salvate del giocatore.
Config.Defaults = {
    hudDisabled   = false,
    cinematicMode = false,
    hideRadar     = false,
    minimapCircle = false,
    iconStyle     = 1,          -- stile icone predefinito: 1–5
    theme         = 'indaco',   -- tema colore: indaco | rosso | verde | viola | oro | ciano
}

-- ── Visibilità predefinita degli elementi HUD ─────────────────────────────────
-- Stato iniziale di ogni elemento al primo avvio (prima che il player
-- salvi le proprie preferenze).
Config.DefaultVisibility = {
    health  = true,
    armor   = true,
    hunger  = true,
    thirst  = true,
    money   = true,
    job     = true,
    clock   = true,
    compass = true,
    street  = true,
    speed   = true,
}
