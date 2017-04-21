let DataStore = require('nedb-promise'),
    usersInChatDB = new DataStore({filename: 'db/UsersInChat', autoload: true});

let UsersInChat = function () {
    return this;
};

UsersInChat.prototype = {
    getUsersInChat: function (chat_id) {
        return usersInChatDB.find({chat_id: chat_id});
    },
    save: function (data) {
        usersInChatDB.update({chat_id: data.chat_id, user_id: data.user_id}, data, {upsert: true});
    }
};

module.exports = UsersInChat;