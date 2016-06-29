var BotClass = require('./bot');

require('fs').readdir('team_config/', (error, files) => files.forEach(file => file.match(/.*.json$/) && new BotClass('team_config/' + file)));