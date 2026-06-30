local ESX = nil

local settings = {
    hudDisabled   = Config.Defaults.hudDisabled,
    cinematicMode = Config.Defaults.cinematicMode,
    hideRadar     = Config.Defaults.hideRadar,
    minimapCircle = Config.Defaults.minimapCircle,
}

-- ─── Init ────────────────────────────────────────────────────────────────────
Citizen.CreateThread(function()
    ESX = exports['es_extended']:getSharedObject()

    ESX.ShowNotification = function(msg, notifType, length)
        SendNUIMessage({
            action    = 'notification',
            notifType = notifType or 'info',
            msg       = msg,
            duration  = length and (length * 1000) or Config.NotifDuration,
        })
    end

    local saved = GetResourceKvpString('hud_settings')
    if saved then
        local ok, decoded = pcall(json.decode, saved)
        if ok and decoded then
            for k, v in pairs(decoded) do settings[k] = v end
        end
    end

    pcall(SetMinimapClipType, settings.minimapCircle and 1 or 0)

    Wait(800)

    SendNUIMessage({
        action           = 'loadConfig',
        speedUnit        = Config.SpeedUnit == 'mph' and 'mph' or 'km/h',
        vignetteLow      = Config.VignetteLow,
        vignetteCritical = Config.VignetteCritical,
        engineGood       = Config.EngineGood,
        engineWarn       = Config.EngineWarn,
        lowBarThreshold  = Config.LowBarThreshold,
        notifDuration    = Config.NotifDuration,
        notifMax         = Config.NotifMax,
        showPlayerId     = Config.ShowPlayerId,
    })
    SendNUIMessage({ action = 'loadSettings', settings = settings })
    SendNUIMessage({ action = 'show' })

    if Config.ShowPlayerId then
        SendNUIMessage({ action = 'playerInfo', serverId = GetPlayerServerId(PlayerId()) })
    end
end)

AddEventHandler('esx:playerLoaded', function()
    ESX = exports['es_extended']:getSharedObject()
    ESX.ShowNotification = function(msg, notifType, length)
        SendNUIMessage({
            action    = 'notification',
            notifType = notifType or 'info',
            msg       = msg,
            duration  = length and (length * 1000) or Config.NotifDuration,
        })
    end
end)

AddEventHandler('onClientResourceStart', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'show' })
end)

-- ─── Export notifiche ────────────────────────────────────────────────────────
exports('showNotification', function(msg, notifType, duration)
    SendNUIMessage({
        action    = 'notification',
        notifType = notifType or 'info',
        msg       = msg,
        duration  = duration or Config.NotifDuration,
    })
end)

exports('setStress', function(value)
    if Config.StressEnabled then
        SendNUIMessage({ action = 'stress', value = math.max(0, math.min(100, math.floor(tonumber(value) or 0))) })
    end
end)

-- ─── Voice events ────────────────────────────────────────────────────────────
local vs = Config.VoiceSystem

if vs == 'auto' or vs == 'pma-voice' then
    AddEventHandler('pma-voice:setTalkingMode', function(mode)
        SendNUIMessage({ action = 'voiceState', mode = mode })
    end)
    AddEventHandler('pma-voice:proximityChanged', function(range)
        SendNUIMessage({ action = 'voiceRange', range = range })
    end)
end

if vs == 'auto' or vs == 'mumble-voip' then
    AddEventHandler('mumble-voip:talking', function(isTalking)
        SendNUIMessage({ action = 'voiceState', mode = isTalking and 1 or 0 })
    end)
end

if vs == 'auto' or vs == 'saltychat' then
    AddEventHandler('SaltyChat_TalkStateChanged', function(isTalking)
        SendNUIMessage({ action = 'voiceState', mode = isTalking and 1 or 0 })
    end)
end

-- ─── Stress event custom ─────────────────────────────────────────────────────
if Config.StressEnabled and Config.StressEvent then
    AddEventHandler(Config.StressEvent, function(value)
        SendNUIMessage({ action = 'stress', value = math.max(0, math.min(100, math.floor(tonumber(value) or 0))) })
    end)
end

-- ─── Comando impostazioni ────────────────────────────────────────────────────
RegisterCommand(Config.SettingsCommand, function()
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'openSettings', settings = settings })
end, false)

-- ─── Tasto screenshot ────────────────────────────────────────────────────────
RegisterKeyMapping('+hud_screenshot', 'HUD: Modalità Screenshot (nascondi/mostra HUD)', 'keyboard', Config.ScreenshotKey)
RegisterCommand('+hud_screenshot', function()
    SendNUIMessage({ action = 'toggleScreenshot' })
end, false)
RegisterCommand('-hud_screenshot', function() end, false)

-- ─── NUI Callbacks ───────────────────────────────────────────────────────────
RegisterNUICallback('closeSettings', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)
RegisterNUICallback('enterDragMode', function(_, cb) cb('ok') end)
RegisterNUICallback('exitDragMode', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)
RegisterNUICallback('applySettings', function(data, cb)
    settings.hudDisabled   = data.hudDisabled   or false
    settings.cinematicMode = data.cinematicMode or false
    settings.hideRadar     = data.hideRadar     or false
    settings.minimapCircle = data.minimapCircle or false
    SetResourceKvp('hud_settings', json.encode(settings))
    pcall(SetMinimapClipType, settings.minimapCircle and 1 or 0)
    cb('ok')
end)
RegisterNUICallback('hudReady', function(_, cb) cb('ok') end)

-- ─── Every-frame: enforce display flags ──────────────────────────────────────
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        local hideHud = settings.hudDisabled or settings.cinematicMode
        DisplayHud(not hideHud)
        DisplayRadar(not (settings.hideRadar or settings.cinematicMode))
    end
end)

-- ─── Main update loop ────────────────────────────────────────────────────────
Citizen.CreateThread(function()
    local speedMult = Config.SpeedUnit == 'mph' and 2.237 or 3.6

    -- Warning cooldown trackers
    local lastHealthWarn = -math.huge
    local lastFuelWarn   = -math.huge
    local lastEngineWarn = -math.huge

    -- Death state tracker
    local wasDead = false

    while true do
        Citizen.Wait(Config.UpdateInterval)

        local ped    = PlayerPedId()
        local player = PlayerId()

        local health  = math.max(0, math.floor(GetEntityHealth(ped) - 100))
        local armor   = math.floor(GetPedArmour(ped))
        local stamina = math.floor(GetPlayerSprintStaminaRemaining(player))

        local vehicle   = GetVehiclePedIsIn(ped, false)
        local inVehicle = vehicle ~= 0
        local speed, gear, rpm = 0, 0, 0.0
        local engineHealth, fuelLevel, seatbelt = 100, 100, false

        if inVehicle then
            speed        = math.floor(GetEntitySpeed(vehicle) * speedMult)
            gear         = GetVehicleCurrentGear(vehicle)
            rpm          = GetVehicleCurrentRpm(vehicle)
            engineHealth = math.max(0, math.floor(GetVehicleEngineHealth(vehicle) / 10))
            fuelLevel    = math.max(0, math.floor(GetVehicleFuelLevel(vehicle)))
            seatbelt     = not GetPedConfigFlag(ped, 32, true)
        end

        -- Death detection
        local isDead = IsEntityDead(ped)
        if isDead ~= wasDead then
            wasDead = isDead
            SendNUIMessage({ action = isDead and 'death' or 'alive' })
        end

        -- Auto warnings (solo se vivo)
        if Config.Warnings.enabled and not isDead then
            local now = GetGameTimer()
            if health <= Config.Warnings.healthThreshold and (now - lastHealthWarn) >= Config.Warnings.cooldown then
                lastHealthWarn = now
                SendNUIMessage({ action = 'notification', notifType = 'error',
                    msg = '❤ Salute critica! Cerca assistenza medica.', duration = 5500 })
            end
            if inVehicle then
                if fuelLevel <= Config.Warnings.fuelThreshold and (now - lastFuelWarn) >= Config.Warnings.cooldown then
                    lastFuelWarn = now
                    SendNUIMessage({ action = 'notification', notifType = 'warning',
                        msg = '⛽ Carburante quasi esaurito!', duration = 5000 })
                end
                if engineHealth <= Config.Warnings.engineThreshold and (now - lastEngineWarn) >= Config.Warnings.cooldown then
                    lastEngineWarn = now
                    SendNUIMessage({ action = 'notification', notifType = 'error',
                        msg = '🔧 Motore gravemente danneggiato!', duration = 5500 })
                end
            end
        end

        local x, y, z      = table.unpack(GetEntityCoords(ped))
        local streetHash, _ = GetStreetNameAtCoord(x, y, z)
        local streetName    = GetStreetNameFromHashKey(streetHash)
        local zoneName      = GetNameOfZone(x, y, z)
        local compass       = headingToCompass(math.floor(GetEntityHeading(ped)))

        local h = GetClockHours()
        local m = GetClockMinutes()
        local timeStr = string.format('%02d:%02d', h, m)

        local cash, bank, jobLabel, jobGrade = 0, 0, '', ''
        if ESX then
            local xPlayer = ESX.GetPlayerData()
            if xPlayer then
                cash     = xPlayer.money or 0
                bank     = xPlayer.bank  or 0
                jobLabel = (xPlayer.job and xPlayer.job.label)       or ''
                jobGrade = (xPlayer.job and xPlayer.job.grade_label) or ''
            end
        end

        SendNUIMessage({
            action       = 'update',
            health       = health,    armor    = armor,  stamina = stamina,
            speed        = speed,     gear     = gear,   rpm     = rpm,
            inVehicle    = inVehicle,
            engineHealth = engineHealth,
            fuelLevel    = fuelLevel,
            seatbelt     = seatbelt,
            street       = streetName, zone    = zoneName,
            compass      = compass,
            time         = timeStr,
            cash         = cash,      bank     = bank,
            job          = jobLabel,  grade    = jobGrade,
        })
    end
end)

function headingToCompass(h)
    h = h % 360
    if h < 0 then h = h + 360 end
    local dirs = { 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW' }
    return dirs[math.floor((h + 22.5) / 45) % 8 + 1]
end

-- ─── esx_status ──────────────────────────────────────────────────────────────
if Config.StatusResource then
    AddEventHandler('esx_status:onTick', function(statuses)
        local hunger, thirst, stress = 100, 100, 0
        for _, s in ipairs(statuses) do
            if     s.name == 'hunger' then hunger = math.floor(s.percent * 100)
            elseif s.name == 'thirst' then thirst = math.floor(s.percent * 100)
            elseif s.name == 'stress' and Config.StressEnabled then
                stress = math.floor(s.percent * 100)
            end
        end
        SendNUIMessage({ action = 'status', hunger = hunger, thirst = thirst })
        if Config.StressEnabled then
            SendNUIMessage({ action = 'stress', value = stress })
        end
    end)
end
