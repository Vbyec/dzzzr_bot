var VoteQuestion = function (id, vote_object, text, variants, textarea, callback) {
	this.id = id;
	this.text = text;
	this.variants = variants;
	this.vote_object = vote_object;
	this.textarea = textarea;
	this.callback = callback;
	return this;
};

var DzzzrVoteQuestion = function (vote_object) {
	this.vote_object = vote_object;
	this.questions = [
		new VoteQuestion(0, vote_object, 'Что будем оценивать?', [[{text: 'Штаб', callback_data: '0'}, {text: 'Поле', callback_data: '1'}, {text: 'Штаб + поле', callback_data: '2'}]], false,
			function (chat_id, query_id, data) {
				return new Promise(resolve=> {
					switch (data) {
						case '0':
							this.vote_object.findChat(chat_id).current_question = 1;
							break;
						case '1':
							this.vote_object.findChat(chat_id).current_question = 2;
							break;
						case '2':
							this.vote_object.findChat(chat_id).current_question = 3;
							break;
						default :
							this.vote_object.sendAnswer(chat_id, query_id, "Неверное значение");
							break;
					}
					resolve();
				});
			}),
		new VoteQuestion(1, vote_object, 'Выставите оценку за Штаб <i>(Любое число от 0 до 40, можно воспользоваться клавиатурой или набрать самому)</i>', [[
				{text: '0', callback_data: '0'},
				{text: '10', callback_data: '10'},
				{text: '20', callback_data: '20'},
				{text: '30', callback_data: '30'},
				{text: '40', callback_data: '40'}
			]], true,
			function (chat_id, query_id, data) {
				return new Promise(resolve=> {
					let hq = parseInt(data);
					if (data >= 0 && data <= 40) {
						this.vote_object.findChat(chat_id).hq = hq;
						this.vote_object.findChat(chat_id).current_question = 5;
						resolve();
					} else {
						this.vote_object.sendAnswer(chat_id, query_id, "Оценка должна быть от 0 до 40.");
					}
				});
			}),
		new VoteQuestion(2, vote_object, 'Выставите оценку за Поле <i>(Любое число от 0 до 40, можно воспользоваться клавиатурой или набрать самому)</i>', [[
				{text: '0', callback_data: '0'},
				{text: '10', callback_data: '10'},
				{text: '20', callback_data: '20'},
				{text: '30', callback_data: '30'},
				{text: '40', callback_data: '40'}
			]], true,
			function (chat_id, query_id, data) {
				return new Promise(resolve=> {
					let field = parseInt(data);
					if (data >= 0 && data <= 40) {
						this.vote_object.findChat(chat_id).field = field;
						this.vote_object.findChat(chat_id).current_question = 5;
						resolve();
					} else {
						this.vote_object.sendAnswer(chat_id, query_id, "Оценка должна быть от 0 до 40.");
					}
				});
			}),
		new VoteQuestion(3, vote_object, 'Выставите оценку за Штаб <i>(Любое число от 0 до 40, можно воспользоваться клавиатурой или набрать самому)</i>', [[
				{text: '0', callback_data: '0'},
				{text: '10', callback_data: '10'},
				{text: '20', callback_data: '20'},
				{text: '30', callback_data: '30'},
				{text: '40', callback_data: '40'}
			]], true,
			function (chat_id, query_id, data) {
				return new Promise(resolve=> {
					let hq = parseInt(data);
					if (data >= 0 && data <= 40) {
						this.vote_object.findChat(chat_id).hq = hq;
						this.vote_object.findChat(chat_id).current_question = 2;
						resolve();
					} else {
						this.vote_object.sendAnswer(chat_id, query_id, "Оценка должна быть от 0 до 40.");
					}
				});
			}),
		new VoteQuestion(5, vote_object, 'Сколько заслужили авторы?', [[
				{text: '0', callback_data: '0'},
				{text: '50%', callback_data: '50'},
				{text: '100%', callback_data: '100'}
			]], false,
			function (chat_id, query_id, data) {
				return new Promise(resolve=> {
					let author_fee = parseInt(data);
					if (author_fee >= 0 && author_fee <= 100) {
						this.vote_object.findChat(chat_id).author_fee = author_fee;
						this.vote_object.findChat(chat_id).current_question = 6;
						resolve();
					} else {
						this.vote_object.sendAnswer(chat_id, query_id, "Взносы должны быть от 0 до 100.");
					}
				});
			}),
		new VoteQuestion(6, vote_object, 'Оставите комментарий к игре?', [[
				{text: 'Без комментариев', callback_data: 'null'}
			]], true,
			function (chat_id, query_id, data) {
				return new Promise(resolve=> {
					var current_chat = this.vote_object.findChat(chat_id);
					current_chat.comment = data == "null" ? null : data;
					current_chat.current_question = -1;
					this.vote_object.end(chat_id);
					resolve();
				});
			})
	];
	return this;
};

DzzzrVoteQuestion.prototype = {
	get: function () {
		return this.questions;
	}
};

module.exports = DzzzrVoteQuestion;