let BotClass = require('./bot'),
    DataStore = require('nedb-promise'),
    TeamsInDB = new DataStore({filename: 'db/TeamSettings', autoload: true});
function save() {
    TeamsInDB.update({_id: this._id}, this)
}
TeamsInDB.find({}).then(teams => teams.forEach(team_config => {
    team_config.save = save;
    new BotClass(team_config)
}));