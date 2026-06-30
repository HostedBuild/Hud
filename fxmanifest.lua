fx_version 'cerulean'
game 'gta5'

author 'Custom HUD'
description 'Professional ESX HUD'
version '1.0.0'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/css/style.css',
    'html/js/app.js',
}

client_scripts {
    '@es_extended/imports.lua',
    'config.lua',
    'client/main.lua',
}

dependencies {
    'es_extended',
}
