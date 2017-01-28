/**
 * Created by vbyec on 1/28/17.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    db_connection = mongoose.createConnection('mongodb://localhost/Global'),
    fs = require('fs');
mongoose.Promise = global.Promise;


var TeamsSchema = new Schema({
    token: String,
    admin_user: [{id: Number, username: String}],
    registered_chat_ids: Array,
    bot_name: String,
    light: {
        pin: String
    },
    classic: {
        login: String,
        city: String,
        password: String,
        http_login: String,
        pin: String
    },
    mera: {
        login: String,
        password: String
    },
    log_path: {type: String, default: "/var/log/dzzzr_telegram"},
    engine: String
});

db_connection.model('Teams', TeamsSchema);
var TeamsInDB = db_connection.model('Teams');
var settings = JSON.parse(fs.readFileSync('team_settings.json', 'utf8'));
TeamsInDB.findOneAndUpdate({token: settings.token}, settings, {upsert: true}, ()=>a = 1);