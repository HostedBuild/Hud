local ESX = nil
local hudVisible = true
local updateInterval = 500

AddEventHandler('esx:playerLoaded', function(xPlayer)
    ESX = exports['es_extended']:getSharedObject()
end)

Citizen.CreateThread(function()
    ESX = exports['es_extended']:getSharedObject()
end)

-- Show/hide HUD on resource start
AddEventHandler('onClientResourceStart', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'show' })
end)

-- Main HUD update loop
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(updateInterval)
        if not hudVisible then goto continue end

        local ped = PlayerPedId()
        local player = PlayerId()

        -- Core vitals
        local health = math.max(0, math.floor((GetEntityHealth(ped) - 100) / 1.0))
        local armor  = math.floor(GetPedArmour(ped))

        -- Stamina (running)
        local stamina = math.floor(GetPlayerSprintStaminaRemaining(player))

        -- Speed (km/h)
        local vehicle = GetVehiclePedIsIn(ped, false)
        local speed, gear, rpm = 0, 0, 0
        local inVehicle = vehicle ~= 0
        if inVehicle then
            speed = math.floor(GetEntitySpeed(vehicle) * 3.6)
            gear  = GetVehicleCurrentGear(vehicle)
            rpm   = GetVehicleCurrentRpm(vehicle)
        end

        -- Zone / street
        local x, y, z = table.unpack(GetEntityCoords(ped))
        local streetHash, _ = GetStreetNameAtCoord(x, y, z)
        local streetName = GetStreetNameFromHashKey(streetHash)
        local zoneName = GetNameOfZone(x, y, z)

        -- Heading
        local heading = math.floor(GetEntityHeading(ped))
        local compass = headingToCompass(heading)

        -- Time
        local h = GetClockHours()
        local m = GetClockMinutes()
        local timeStr = string.format('%02d:%02d', h, m)

        -- Money & job (ESX)
        local cash, bank, jobLabel, jobGrade = 0, 0, '', ''
        if ESX then
            local xPlayer = ESX.GetPlayerData()
            if xPlayer then
                cash     = xPlayer.money or 0
                bank     = xPlayer.bank or 0
                jobLabel = (xPlayer.job and xPlayer.job.label) or ''
                jobGrade = (xPlayer.job and xPlayer.job.grade_label) or ''
            end
        end

        -- Wanted level
        local wanted = GetPlayerWantedLevel(player)

        SendNUIMessage({
            action    = 'update',
            health    = health,
            armor     = armor,
            stamina   = stamina,
            speed     = speed,
            gear      = gear,
            rpm       = rpm,
            inVehicle = inVehicle,
            street    = streetName,
            zone      = zoneName,
            compass   = compass,
            time      = timeStr,
            cash      = cash,
            bank      = bank,
            job       = jobLabel,
            grade     = jobGrade,
            wanted    = wanted,
        })

        ::continue::
    end
end)

-- ESX money/job events
RegisterNetEvent('esx:setAccountMoney')
AddEventHandler('esx:setAccountMoney', function(account)
    -- handled by poll loop
end)

-- Hunger / thirst via esx_status (optional)
RegisterNUICallback('hudReady', function(data, cb)
    cb('ok')
end)

function headingToCompass(h)
    h = h % 360
    if h < 0 then h = h + 360 end
    local dirs = { 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW' }
    local idx = math.floor((h + 22.5) / 45) % 8
    return dirs[idx + 1]
end

-- esx_status integration (hunger/thirst)
local hunger, thirst = 100, 100

AddEventHandler('esx_status:onTick', function(statuses)
    for _, status in ipairs(statuses) do
        if status.name == 'hunger' then
            hunger = math.floor(status.percent * 100)
        elseif status.name == 'thirst' then
            thirst = math.floor(status.percent * 100)
        end
    end
    SendNUIMessage({ action = 'status', hunger = hunger, thirst = thirst })
end)
