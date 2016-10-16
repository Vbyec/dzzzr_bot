var BotClass = function (configuration) {
	this.configuration = configuration;
// Подгружаем необходимые require
	require('./functions');
	var fs = require('fs'),
		log4js = require('log4js'),
		mongoose = require('mongoose'),
		TelegramBot = require('node-telegram-bot-api'),
		Command = require('./command'),
		Schema = mongoose.Schema,
		Vote = require('./vote'),
		db_connection = mongoose.createConnection('mongodb://localhost/Dzzzr_' + configuration.bot_name);
	mongoose.Promise = global.Promise;
	this.telegram_class = new TelegramBot(configuration.token, {polling: true});
	this.current_vote = new Vote(this.telegram_class, configuration.bot_name, db_connection);
	log4js.loadAppender('file');
	log4js.addAppender(log4js.appenders.file(configuration.log_path + "/" + configuration.bot_name + ".log"), configuration.bot_name);
	var logger = new log4js.getLogger(configuration.bot_name);
	this.logger = logger;
	this.chats = {};
	// catch all exceptions
	process.on('uncaughtException', function (err) {
		logger.fatal('Caught exception: ' + err + '\n' + err.stack);
	});

	var UsersInChatSchema = new Schema({
		user_id: Number,
		chat_id: Number,
		user_name: String,
		first_name: String,
		last_name: String,
		voted: false
	});
	db_connection.model('UsersInChat', UsersInChatSchema);
	this.UsersInChatDB = db_connection.model('UsersInChat');

	this.getUsersInChat = function (chat_id) {
		return new Promise(resolve=>this.UsersInChatDB.find({chat_id: chat_id}).then(resolve));
	};

	// Расширяем функционал телеграмм класса
	this.telegram_class.reply = (msg, text,option={})=> {
		option.reply_to_message_id= msg.message_id;
		this.telegram_class.sendMessage(msg.chat.id, text, option);
	};
	this.telegram_class.answer = (msg, text, option) => {
		this.telegram_class.sendMessage(msg.chat.id, text, option);
	};
	this.telegram_class.answerError = (msg, text) => {
		this.telegram_class.answer(msg, '❗️❗️❗️<b>' + text + '</b>❗️❗️❗️', {parse_mode: 'HTML'});
	};
	this.telegram_class.send_location = (msg, latitude, longitude, title) => this.telegram_class.sendVenue(msg.chat.id, latitude, longitude, title);

	// Добавляем методы в класс бота
	this.addCommand = function (regexp, need_admin, need_registered, callback, description = "") {
		this.commands.push(new Command(regexp, need_admin, need_registered, callback, this, description));
	};

	this.removeAdmin = function (user) {
		this.configuration.admin_user.indexOf(user) > -1 && this.configuration.admin_user.splice(this.configuration.admin_user.indexOf(user), 1);
		this.configuration.save();
	};
	this.addAdmin = function (user) {
		this.configuration.admin_user.push(user);
		this.configuration.admin_user = this.configuration.admin_user.unique();
		this.configuration.save();
	};

	this.addRegisteredChat = function (chat_id) {
		this.configuration.registered_chat_ids.push(chat_id);
		this.configuration.registered_chat_ids = this.configuration.registered_chat_ids.unique();
		this.configuration.save();
	};

	// @todo Переписать эти методы на использование списка админов
	this.notifyAllAdmins = msg=>this.configuration.registered_chat_ids.forEach((chat_id) =>this.telegram_class.sendMessage(chat_id, msg));
	this.notifyErrorAllAdmins = msg=>this.configuration.registered_chat_ids.forEach((chat_id) =>this.telegram_class.sendMessage(chat_id, '❗️❗️❗️<b>' + msg + '</b>❗️❗️❗️', {parse_mode: 'HTML'}));

	// Задаем стартовые значения переменным бота
	this.commands = [];
	this.name = configuration.bot_name;
	this.allow_code = 0;
	this.location_regex = /\d{2}\.\d{4,8}.{1,3}\d{2}\.\d{4,8}/i;

	fs.accessSync('./engines/' + configuration.engine + ".js", fs.F_OK);
	let currentEngineClass = require('./engines/' + configuration.engine + ".js");
	this.currentEngine = new currentEngineClass(configuration, this);
	// Обрабатываем все зарегистрированные команды
	this.telegram_class.on('message', (msg)=> {
		try {
			if (!this.chats.hasOwnProperty(msg.chat.id)) {
				this.chats[msg.chat.id] = {users: {}};
			}
			if (!this.chats[msg.chat.id].users.hasOwnProperty(msg.from.id)) {
				let NewData = {
					user_id: msg.from.id,
					user_name: msg.from.username,
					first_name: msg.from.first_name,
					last_name: msg.from.last_name
				};
				this.chats[msg.chat.id].users[msg.from.id] = NewData;
				this.UsersInChatDB.findOneAndUpdate({chat_id: msg.chat.id, user_id: msg.from.id}, NewData, {upsert: true}, ()=>a = 1);
			}
			if (this.current_vote.haveTextArea(msg.chat.id)) {
				this.current_vote.setAnswer(msg.chat.id, null, msg.text);
			}
			var command = this.commands.find(command=>msg.text && command.regexp.exec(msg.text.trim().toLowerCase().replace('@' + this.name, '')));
			if (command === undefined) return true;
			command.registerInLog()
				.checkAdmin(msg.from.username)
				.checkRegisteredChat(msg.chat.id)
				.callback(msg);
		}
		catch (e) {
			logger.fatal(e.stack);
			this.telegram_class.reply(msg, e.message);
		}
	});

	this.addCommand(/^\/start\s/, false, false, msg => {
			let start_command = msg.text.match(/\/start\s(.*)/)[1].trim();
			switch (start_command) {
				case 'vote':
					this.current_vote
						.getActiveVote()
						.then(vote=>this.current_vote.start(msg.chat.id, msg.chat.username, msg.chat.first_name, msg.chat.last_name, vote.id))
						.catch(message=> this.telegram_class.answer(msg, message));
					break;
				default :
					break;
			}
		}
	);

	this.telegram_class.on('callback_query', msg=> this.current_vote.setAnswer(msg.from.id, msg.id, msg.data, msg.message.message_id));

// Добавляем все необходимые команды
// Админские команды, работают даже в незарегистрированных чатах.
	this.addCommand(/^\/man$/, true, false, msg =>
		this.telegram_class.answer(msg, this.commands
				.filter(el=>el.need_admin && el.description)
				.map(el=>el.regexp.toString().match(/\\(\/.*)\//)[1].replace('$', '') + " - " + el.description)
				.join("\n")
		));
	this.addCommand(/^\/register_chat$/, true, false, msg => {
		this.addRegisteredChat(msg.chat.id);
		this.telegram_class.reply(msg, "Чат зарегистрирован.");
	}, "Регистрирует текущий чат как разрешенный.");
	this.addCommand(/^\/admin_user_list$/, true, false, msg => this.telegram_class.answer(msg, this.configuration.admin_user.map(el=>"@" + el).join("\n")), "Показывает список админов бота.");

	this.addCommand(/^\/admin_user_add/, true, false, msg => {
		assertNotEmpty(msg.text.match(/.*\s(.*)/), "Не указан пользователь.");
		let new_user = msg.text.match(/.*\s(.*)/)[1].replace("@", "").trim();
		this.addAdmin(new_user);
		this.telegram_class.reply(msg, "@" + new_user + " добавлен в список админов.");
	}, "Добавляет указанного пользователя в админы боты.");

	this.addCommand(/^\/admin_user_remove/, true, false, msg => {
		assertNotEmpty(msg.text.match(/.*\s(.*)/), "Не указан пользователь");
		let new_user = msg.text.match(/.*\s(.*)/)[1].replace("@", "").trim();
		this.removeAdmin(new_user);
		this.telegram_class.reply(msg, "@" + new_user + " удален из список админов");
	}, "Удаляет указанного пользователя из админов бота.");

	this.addCommand(/^\/allow_code$/, true, false, msg => {
		this.allow_code = 1;
		logger.info("allow_code new value=" + this.allow_code);
		this.telegram_class.answer(msg, "Теперь коды <strong>РАЗРЕШЕНО</strong> вбивать", {parse_mode: 'HTML'});
	}, "Разрешает вбивать коды.");

	this.addCommand(/^\/forbid_code$/, true, false, msg => {
		this.allow_code = 0;
		logger.info("allow_code new value=" + this.allow_code);
		this.telegram_class.answer(msg, "Теперь коды <strong>ЗАПРЕЩЕНО</strong> вбивать", {parse_mode: 'HTML'});
	}, "Запрещает вбивать коды.");

	this.addCommand(/^\/vote_create/, true, false, msg => {
		assertNotEmpty(msg.text.match(/^\/vote_create\s/), "Не указано название игры.");
		let vote_name = msg.text.match(/^\/vote_create\s(.*)/)[1].trim();
		assertNotEmpty(vote_name, "Не указано название игры.");
		this.current_vote.getActiveVote()
			.then(vote=>this.telegram_class.answer(msg, `Перед созданием нового опроса, закройте старый ${vote.name} командой /vote_close`))
			.catch(vote=>this.current_vote.create(vote_name)
				.then(id=>this.telegram_class.answer(msg, `Начинаем голосование команды за игру ${vote_name}.\r\nДля начала голосвания кликните по ссылке: https://telegram.me/${this.name}?start=vote`, {disable_web_page_preview: true})
			));
	}, "Создает опрос для простановки оценок за игру.");

	this.addCommand(/^\/vote_get_unpolled$/, true, false, msg => {
		let users_in_chat = {};
		this.getUsersInChat(msg.chat.id)
			.then(a=> {
				users_in_chat = a;
				return this.current_vote.getActiveVote();
			})
			.then(vote=>this.current_vote.getStat(vote.id))
			.then(vote_stat=> {
				users_in_chat.map(user=>user.voted = vote_stat.list.findIndex(voted=>voted.user_id == user.user_id) > -1);
				if (users_in_chat.filter(el=>!el.voted).length) {
					this.telegram_class.answer(msg,
						"Список тех, кого бот видел в этом чате и кто еще не проставил оценку:\n"
						+ users_in_chat.filter(el=>!el.voted).map(el=>"@" + el.user_name).join(", ")
						+ `\n\nОценки можно проставить перейдя по ссылке https://telegram.me/${this.name}?start=vote`, {disable_web_page_preview: true}
					)
				} else {
					this.telegram_class.answer(msg, "Все кого видел в этом чате уже проголосовали");
				}
			});
	}, "Выводит список пользователей которые были в этом чате, но еще не проставили оценку за игру");

	this.addCommand(/^\/vote_stats$/, true, false, msg => {
		this.current_vote.getActiveVote()
			.then(record=> this.current_vote.getStatMessages(record.id))
			.then(messages=>messages.forEach((message, index)=> setTimeout(this.telegram_class.answer.bind(null, msg, message, {parse_mode: 'HTML'}), 500 * index)))
			.catch(message=> this.telegram_class.answer(msg, message));
	}, "Выводит информацию о текущем активном выставлении оценок");

	this.addCommand(/^\/vote_close$/, true, false, msg => {
		this.current_vote.getActiveVote()
			.then(record=> this.current_vote.close(record.id))
			.then(message=>this.telegram_class.answer(msg, "Опрос закрыт."))
			.catch(message=> this.telegram_class.answer(msg, message));
	}, "Закрывает текущее активное выставление оценок и делает его не активным");

// Пользовательские команды, работают только в зарегистрированных чатах
	this.addCommand(/^\/help$/, false, true, msg =>
			this.telegram_class.answer(msg, this.commands
				.filter(el=>!el.need_admin && el.description)
				.map(el=>el.regexp.toString().match(/\\(\/.*)\//)[1].replace('$', '') + " - " + el.description)
				.join("\n"))
		, "Выводит эту информацию.");

	this.addCommand(this.location_regex, false, true, msg => {
		msg.text.match(/(\d*[а-я]+\s?){0,2}.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach((element, index) => {
			var location = element.match(/\d{2}[.,]\d{2,8}/ig);
			var title = element.match(/(\d*[а-я]+\s?){0,2}/i);
			title = title != null ? title[0] : "";
			this.telegram_class.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
		});
	});

	this.addCommand(/^\/list$/, false, true, msg => {
		this.currentEngine.getPage().then(
				page => {
				var list = this.currentEngine.getCodeList(page);
				if (list.length) {
					this.telegram_class.answer(msg, list.map(function (sector) {
						return sector.name + ":\n" + sector.list.map(function (code) {
								return code.done ? null : code.index + ") " + code.difficult;
							}).filter(function (n) {
								return n != undefined
							}).join("\n");
					}).join("\n"));
				} else {
					this.telegram_class.answer(msg, 'В данном задании не указаны КС');
				}
			}
		).catch(message=> this.telegram_class.answer(msg, message));
	}, "Выводит список оставшихся кодов.");
	this.addCommand(/^\/vote_start/, false, false, msg => {
		if (msg.chat.type == 'private') {
			this.current_vote
				.getActiveVote()
				.then(vote=>this.current_vote.start(msg.chat.id, msg.chat.username, msg.chat.first_name, msg.chat.last_name, vote.id))
				.catch(message=> this.telegram_class.answer(msg, message));
		}
	}, "Начинает опрос на выставление оценок");
	this.notifyAllAdmins("Bot started");
	this.currentEngine.init();
	logger.info("Bot started.");
	return this;
};

module.exports = BotClass;