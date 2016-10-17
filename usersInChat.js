/**
 * Created by vbyec on 16.10.16.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

var UsersInChatSchema = new Schema({
    user_id: Number,
    chat_id: Number,
    user_name: String,
    first_name: String,
    last_name: String,
    voted: false
});

var UsersInChat = function (db_connection) {
    db_connection.model('UsersInChat', UsersInChatSchema);
    this.usersInChat = db_connection.model('UsersInChat');
    return this;
};

UsersInChat.prototype = {
    getUsersInChat: function (chat_id) {
        return new Promise(resolve=>this.usersInChat.find({chat_id: chat_id}).then(resolve));
    },
    save:function (NewData,chat_id,user_id) {
        this.usersInChat.findOneAndUpdate({chat_id: chat_id, user_id: user_id}, NewData, {upsert: true}, ()=>a = 1);
    }
};

module.exports = UsersInChat;