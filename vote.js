require('./functions');

var mongoose = require('mongoose'),
    DzzzrVoteQuestion = require('./dzzzr_vote_question'),
    UsersInChatClass = require('./usersInChat'),
    Schema = mongoose.Schema;
mongoose.Promise = global.Promise;

var VoteSchema = new Schema({
    name: String,
    active: Boolean
});

var UserVoteSchema = new Schema({
    user_id: Number,
    chat_id: Number,
    user_name: String,
    first_name: String,
    last_name: String,
    hq: {type: Number, 'default': null},
    field: {type: Number, 'default': null},
    author_fee: {type: Number, 'default': null},
    comment: String
});

var VoteClass = function (telegram_class, bot_name, db_connection) {
    this.questions = new DzzzrVoteQuestion(this).get();
    this.telegram_class = telegram_class;
    this.bot_name = bot_name;
    this.chats = [];
    this.name = "";
    this.usersInChat = new UsersInChatClass(db_connection);

    db_connection.model('Vote', VoteSchema);
    db_connection.model('UserVote', UserVoteSchema);

    this.VoteDB = db_connection.model('Vote');
    this.UserVoteDB = db_connection.model('UserVote');

    return this;
};

VoteClass.prototype = {
    create: function (name) {
        return new Promise(resolve => {
            var Vote = new this.VoteDB();
            this.name = name;
            Vote.name = name;
            Vote.active = true;
            Vote.save().then(record=> resolve(record.id));
        })
    },
    close: function (id) {
        return new Promise(resolve=>this.VoteDB.findByIdAndUpdate(id, {$set: {active: false}}, {'new': true}, msg=>resolve()));
    },
    get: function (id) {
        return new Promise((resolve, reject) =>this.VoteDB.findById(id).then(record=>record.active ? resolve(record) : reject("Выставление оценок уже завершено")).catch(record=>reject("Не удалось найти такой опрос")));
    },
    getActiveVoteId: function () {
        return this.getActiveVote().then(vote=>vote.id);
    },
    getActiveVote: function () {
        return new Promise((resolve, reject) =>this.VoteDB.findOne({active: true}).then(record=> {
            record ? resolve(record) : reject("Не удалось найти активного опроса")
        }));
    },
    start: function (chat_id, user_name, first_name, last_name, vote_id) {
        this.chats.findIndex(el=>el.id == chat_id) > -1 && this.chats.splice(this.chats.findIndex(el=>el.id == chat_id), 1);
        this.chats.push({
            id: chat_id,
            user_id: chat_id,
            user_name: user_name,
            first_name: first_name,
            last_name: last_name,
            current_question: 0,
            message_id: 0,
            vote_id: vote_id,
            field: null,
            hq: null,
            author_fee: null
        });
        this.nextQuestion(chat_id);
    },
    getVoteName: function (id) {
        return new Promise(resolve=> {
            if (!this.name) {
                this.get(id)
                    .then(vote=> {
                        this.name = vote.name;
                        resolve(this.name);
                    })
            }
            else {
                resolve(this.name);
            }
        })
    },
    end: function (chat_id) {
        let current_chat = this.findChat(chat_id);
        let NewData = {
            user_id: current_chat.id,
            chat_id: current_chat.id,
            user_name: current_chat.user_name,
            first_name: current_chat.first_name,
            last_name: current_chat.last_name,
            hq: current_chat.hq,
            field: current_chat.field,
            author_fee: current_chat.author_fee,
            comment: current_chat.comment,
            vote_id: current_chat.vote_id
        };
        this.UserVoteDB.findOneAndUpdate({
            vote_id: current_chat.vote_id,
            user_id: current_chat.id
        }, NewData, {upsert: true}, ()=>a = 1);
        let text =
            `<b>${this.name}</b>\n\n` +
            "<b>Спасибо за участие в выставлении оценок!\n</b>" +
            "<pre>Вы оценили игру так:\n" +
            (current_chat.hq != null ? `Штаб: ${current_chat.hq}\n` : "") +
            (current_chat.field != null ? `Поле: ${current_chat.field}\n` : "") +
            `Взнос авторам: ${current_chat.author_fee}%\n` +
            (current_chat.comment != null ? `Комментарий: ${current_chat.comment}\n` : "") +
            "</pre>/vote_start -- Если хотите поменять свое мнение";
        this.telegram_class.editMessageText(text, {
            chat_id: chat_id,
            message_id: current_chat.message_id,
            reply_markup: null,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    },
    nextQuestion: function (chat_id) {
        if (this.findChat(chat_id).current_question >= 0) this.findChat(chat_id).message_id ? this.updateQuestion(chat_id) : this.sendNewQuestion(chat_id);
    },
    findCurrentQuestion: function (chat_id) {
        return this.questions.find(el=>el.id == this.findChat(chat_id).current_question);
    },
    findChat: function (chat_id) {
        return this.chats.find(el=>el.id == chat_id);
    },
    sendAnswer: function (chat_id, query_id, text) {
        query_id ? this.telegram_class.answerCallbackQuery(query_id, text) : this.telegram_class.sendMessage(chat_id, text);
    },
    setAnswer: function (chat_id, query_id, data, message_id = null) {
        if (message_id && this.findChat(chat_id) === undefined || message_id && this.findChat(chat_id).message_id != message_id) return false;
        this.findCurrentQuestion(chat_id).callback(chat_id, query_id, data).then(a=>this.nextQuestion(chat_id));
    },
    sendNewQuestion: function (chat_id) {
        let question = this.findCurrentQuestion(chat_id);
        this.getVoteName(this.findChat(chat_id).vote_id)
            .then(msg=>this.telegram_class.sendMessage(chat_id, `<b>${this.name}</b>\n\n` + question.text, {
                reply_markup: {inline_keyboard: question.variants},
                parse_mode: 'HTML'
            }).then(a=>this.findChat(chat_id).message_id = a.message_id));
    },
    updateQuestion: function (chat_id) {
        let question = this.findCurrentQuestion(chat_id);
        let message_id = this.findChat(chat_id).message_id;
        this.getVoteName(this.findChat(chat_id).vote_id)
            .then(this.telegram_class.editMessageText(`<b>${this.name}</b>\n\n` + question.text, {
                chat_id: chat_id,
                message_id: message_id,
                reply_markup: question.variants ? {inline_keyboard: question.variants} : null,
                parse_mode: 'HTML'
            }));
    },
    haveTextArea: function (chat_id) {
        return this.findChat(chat_id) && this.findCurrentQuestion(chat_id) && this.findCurrentQuestion(chat_id).textarea;
    },
    getUnvotedUsers: function (chat_id) {
        return new Promise(resolve=> {
            let users_in_chat = [];
            this.usersInChat.getUsersInChat(chat_id)
                .then(a=> {
                    users_in_chat = a;
                    return this.getActiveVoteId();
                })
                .then(id=> this.getStat(id))
                .then(function (vote_stats) {
                    let result =users_in_chat.filter(user=>vote_stats.list.findIndex(voted_user=>voted_user.user_id==user.user_id)==-1).map(user=>user.user_name?"@"+user.user_name:`${user.first_name} ${user.last_name}`);
                    resolve(result);
                })
        });
    },
    getStat: function (vote_id) {
        let list = [];
        let result = {
            total: 0,
            hq: {count: 0, summary: 0},
            field: {count: 0, summary: 0},
            author_fee: {
                0: 0,
                50: 0,
                100: 0
            }
        };
        let reviews = [];
        return new Promise(resolve=> {
                this.UserVoteDB.find({vote_id: vote_id.toObjectId()}).then(a=> {
                    a.forEach(el=> {
                            list.push({
                                hq: el.hq,
                                field: el.field,
                                author_fee: el.author_fee,
                                first_name: el.first_name,
                                last_name: el.last_name,
                                user_name: el.user_name,
                                user_id: el.user_id
                            });
                            el.comment && reviews.push({
                                comment: el.comment,
                                first_name: el.first_name,
                                last_name: el.last_name,
                                user_name: el.user_name
                            });
                            result.total++;
                            if (el.hq != null) {
                                result.hq.count++;
                                result.hq.summary += parseInt(el.hq);
                            }
                            if (el.field != null) {
                                result.field.count++;
                                result.field.summary += parseInt(el.field);
                            }
                            result.author_fee[el.author_fee]++;
                        }
                    );
                    resolve({list: list, result: result, reviews: reviews})
                });
            }
        )
    },
    getStatMessages: function (vote_id) {
        return new Promise(resolve=> {
            this.getStat(vote_id).then(stat=> {

                let list_message = "<b>Список</b>\n<pre># штаб поле авторам\n";
                stat.list.forEach((el, index)=> {
                    let number = index + 1;
                    let hq = el.hq == null ? "--" : el.hq;
                    let field = el.field == null ? "--" : el.field;
                    let author_fee = el.author_fee == null ? "--" : el.author_fee;
                    let first_name = el.first_name == null ? "" : el.first_name;
                    let last_name = el.last_name == null ? "" : " " + el.last_name;
                    let user_name = el.user_name == null ? "" : ` (@${el.user_name})`;
                    list_message += number + " ".repeat(2 - number.toString().length + 1);
                    list_message += hq + " ".repeat(2 - hq.toString().length + 3);
                    list_message += field + " ".repeat(2 - field.toString().length + 4);
                    list_message += author_fee + " ".repeat(3 - author_fee.toString().length + 3);
                    list_message += "— ";
                    list_message += `${first_name}${last_name}${user_name}`;
                    list_message += '\n';
                });
                list_message += "</pre>";

                let result_message = "<b>Результаты:</b>\n" +
                    `Всего проголосовало ${stat.result.total} человек\n` +
                    `За <i>штаб</i> выставлено ${stat.result.hq.count} оценок с средним балом ${stat.result.hq.count ? (stat.result.hq.summary / stat.result.hq.count).toFixed(1) : "-"}\n` +
                    `За <i>поле</i> выставлено ${stat.result.field.count} оценок с средним балом ${ stat.result.field.count ? (stat.result.field.summary / stat.result.field.count).toFixed(1) : "-"}\n` +
                    `Средний между полем и штабом: ${stat.result.hq.count && stat.result.field.count ? (((stat.result.hq.count ? (stat.result.hq.summary / stat.result.hq.count) : 0) + (stat.result.field.count ? (stat.result.field.summary / stat.result.field.count) : 0)) / (~~!!stat.result.field.count + ~~!!stat.result.hq.count)).toFixed(1) : "-"}\n` +
                    "Гонорар авторам:\n" +
                    `- 0% ${stat.result.author_fee[0]} голосов\n` +
                    `- 50% ${stat.result.author_fee[50]} голосов\n` +
                    `- 100% ${stat.result.author_fee[100]} голосов`;

                let reviews_message = "<b>Отзывы:</b>\n";
                stat.reviews.forEach(el=> {
                    let first_name = el.first_name == null ? "" : el.first_name;
                    let last_name = el.last_name == null ? "" : " " + el.last_name;
                    let user_name = el.user_name == null ? "" : ` (@${el.user_name})`;
                    reviews_message += `«${el.comment}» — ${first_name}${last_name}${user_name}\n\n`;
                });
                resolve([list_message, result_message, reviews_message]);
            });
        })
    }
};

module.exports = VoteClass;