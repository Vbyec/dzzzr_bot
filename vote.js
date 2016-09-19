require('./functions');

var mongoose = require('mongoose'),
	DzzzrVoteQuestion = require('./dzzzr_vote_question'),
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
	hq: {type: String, 'default': null},
	field: {type: String, 'default': null},
	author_fee: Number,
	comment: String
});

mongoose.model('Vote', VoteSchema);
mongoose.model('UserVote', UserVoteSchema);

var VoteDB = mongoose.model('Vote');
var UserVoteDB = mongoose.model('UserVote');

var VoteClass = function (telegram_class, bot_name) {
	this.questions = new DzzzrVoteQuestion(this).get();
	this.telegram_class = telegram_class;
	this.bot_name = bot_name;
	this.chats = [];
	return this;
};

VoteClass.prototype = {
	create: function (name) {
		return new Promise(resolve => {
			var Vote = new VoteDB();
			Vote.name = name;
			Vote.active = true;
			Vote.save().then(record=> resolve(record.id));
		})
	},
	get: function (id) {
		return new Promise((resolve, reject) =>VoteDB.findById(id).then(record=>record.active ? resolve(record) : reject("Выставление оценок уже завершено")).catch(record=>reject("Не удалось найти такой опрос")));
	},
	start: function (chat_id, user_name, first_name, last_name, vote_id) {
		this.chats.findIndex(el=>el.id == chat_id) > -1 && this.chats.splice(this.chats.findIndex(el=>el.id == chat_id), 1);
		this.chats.push({id: chat_id, user_id: chat_id, user_name: user_name, first_name: first_name, last_name: last_name, current_question: 0, message_id: 0, vote_id: vote_id, field: null, hq: null});
		this.nextQuestion(chat_id);
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
		UserVoteDB.findOneAndUpdate({vote_id: current_chat.vote_id, user_id: current_chat.id}, NewData, {upsert: true}, ()=>a = 1);
		let text =
			"<b>Спасибо за участие в выставлении оценок!\n</b>" +
			"<pre>Вы оценили игру так:\n" +
			(current_chat.hq ? `Штаб: ${current_chat.hq}\n` : "") +
			(current_chat.field ? `Поле: ${current_chat.field}\n` : "") +
			`Взнос авторам: ${current_chat.author_fee}%\n` +
			(current_chat.comment != null ? `Комментарий: ${current_chat.comment}\n` : "") +
			"\nЕсли хотите поменять свое мнение - перейдите по ссылке и пройдите опрос еще раз.</pre>\n" +
			`https://telegram.me/${this.bot_name}?start=${current_chat.vote_id}`;
		this.telegram_class.editMessageText(text, {chat_id: chat_id, message_id: current_chat.message_id, reply_markup: null, parse_mode: 'HTML', disable_web_page_preview: true});
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
		this.telegram_class.sendMessage(chat_id, question.text, {reply_markup: {inline_keyboard: question.variants}}).then(a=>this.findChat(chat_id).message_id = a.message_id);
	},
	updateQuestion: function (chat_id) {
		let question = this.findCurrentQuestion(chat_id);
		let message_id = this.findChat(chat_id).message_id;
		this.telegram_class.editMessageText(question.text, {chat_id: chat_id, message_id: message_id, reply_markup: question.variants ? {inline_keyboard: question.variants} : null, parse_mode: 'HTML'});
	},
	haveTextArea: function (chat_id) {
		return this.findChat(chat_id) && this.findCurrentQuestion(chat_id) && this.findCurrentQuestion(chat_id).textarea;
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
				UserVoteDB.find({vote_id: vote_id}).then(a=> {
					a.forEach(el=> {
							list.push({
								hq: el.hq == null ? '--' : el.hq,
								field: el.field == null ? '--' : el.field,
								author_fee: el.author_fee,
								first_name: el.first_name,
								last_name: el.last_name,
								user_name: el.user_name
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
	}
};

module.exports = VoteClass;