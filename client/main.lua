local ESX = nil

local settings = {
    hudDisabled   = false,
    cinematicMode = false,
    hideRadar     = false,
    minimapCircle = false,
}

-- ─── Init ────────────────────────────────────────────────────────────────────
Citizen.CreateThread(function()
    ESX = exports['es_extended']:getSharedObject()

    local saved = GetResourceKvpString('hud_settings')
    if saved then
        local ok, decoded = pcall(json.decode, saved)
        if ok and decoded then
            for k, v in pairs(decoded) do settings[k] = v end
        end
    end

    pcall(SetMinimapClipType, settings.minimapCircle and 1 or 0)

    Wait(800)
    SendNUIMessage({ action = 'loadSettings', settings = settings })
    SendNUIMessage({ action = 'show' })
end)

AddEventHandler('esx:playerLoaded', function()
    ESX = exports['es_extended']:getSharedObject()
end)

AddEventHandler('onClientResourceStart', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'show' })
end)

-- ─── /hd command ─────────────────────────────────────────────────────────────
RegisterCommand('hd', function()
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'openSettings', settings = settings })
end, false)

-- ─── NUI Callbacks ───────────────────────────────────────────────────────────
RegisterNUICallback('closeSettings', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('enterDragMode', function(_, cb)
    -- NUI focus stays on so the mouse cursor works for dragging
    cb('ok')
end)

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
    while true do
        Citizen.Wait(500)

        local ped    = PlayerPedId()
        local player = PlayerId()

        local health  = math.max(0, math.floor(GetEntityHealth(ped) - 100))
        local armor   = math.floor(GetPedArmour(ped))
        local stamina = math.floor(GetPlayerSprintStaminaRemaining(player))

        local vehicle   = GetVehiclePedIsIn(ped, false)
        local inVehicle = vehicle ~= 0
        local speed, gear, rpm = 0, 0, 0.0
        if inVehicle then
            speed = math.floor(GetEntitySpeed(vehicle) * 3.6)
            gear  = GetVehicleCurrentGear(vehicle)
            rpm   = GetVehicleCurrentRpm(vehicle)
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
            action    = 'update',
            health    = health,    armor     = armor,  stamina = stamina,
            speed     = speed,     gear      = gear,   rpm     = rpm,
            inVehicle = inVehicle,
            street    = streetName, zone     = zoneName,
            compass   = compass,
            time      = timeStr,
            cash      = cash,      bank      = bank,
            job       = jobLabel,  grade     = jobGrade,
        })
    end
end)

function headingToCompass(h)
    h = h % 360
    if h < 0 then h = h + 360 end
    local dirs = { 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW' }
    return dirs[math.floor((h + 22.5) / 45) % 8 + 1]
end

-- ─── esx_status (optional) ───────────────────────────────────────────────────
AddEventHandler('esx_status:onTick', function(statuses)
    local hunger, thirst = 100, 100
    for _, s in ipairs(statuses) do
        if s.name == 'hunger' then hunger = math.floor(s.percent * 100)
        elseif s.name == 'thirst' then thirst = math.floor(s.percent * 100)
        end
    end
    SendNUIMessage({ action = 'status', hunger = hunger, thirst = thirst })
end)
