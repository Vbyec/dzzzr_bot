var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    db_connection = mongoose.createConnection('mongodb://localhost/Test'),
    TeamsSchema = new Schema({
        token: String,
        admin_user: Array,
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
mongoose.Promise = global.Promise;
db_connection.model('TeamSettings', TeamsSchema);
var TeamsInDB = db_connection.model('TeamSettings');


var Team = function () {
    return this;
};

Team.prototype = {
    getClassic: function () {
        return this.getConfiguration().then(team=>new require('../engines/dzzzr_classic')(team))
    },
    getConfiguration:function () {
        return TeamsInDB.findOne().exec();
    }
};

module.exports = Team;