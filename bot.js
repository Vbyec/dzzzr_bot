var BotClass = function (configuration_file, ProxyFactory) {
	// Подгружаем необходимые require
	var fs = require('fs'),
		configuration = JSON.parse(fs.readFileSync(configuration_file)),
		log4js = require('log4js'),
		TelegramBot = require('node-telegram-bot-api'),
		Command = require('./command');
	this.telegram_class = new TelegramBot(configuration.token, {polling: true});
	require('./functions');
	log4js.loadAppender('file');
	log4js.addAppender(log4js.appenders.file(configuration.log_path + "/" + configuration.bot_name + ".log"), configuration.bot_name);
	var logger = new log4js.getLogger(configuration.bot_name);
	this.logger = logger;
	ProxyFactory.setLogger(logger);
	// catch all exceptions
	process.on('uncaughtException', function (err) {
		logger.fatal('Caught exception: ' + err + '\n' + err.stack);
	});

	// Расширяем функционал телеграмм класса
	this.telegram_class.reply = (msg, text)=> {
		this.telegram_class.sendMessage(msg.chat.id, text, {reply_to_message_id: msg.message_id});
	};
	this.telegram_class.answer = (msg, text, option) => {
		this.telegram_class.sendMessage(msg.chat.id, text, option);
	};
	this.telegram_class.send_location = (msg, latitude, longitude, title) => {
		if (title && typeof  title == "string") {
			this.telegram_class.sendMessage(msg.chat.id, title).then(()=> {
				this.telegram_class.sendLocation(msg.chat.id, latitude, longitude);
			});
		} else {
			this.telegram_class.sendLocation(msg.chat.id, latitude, longitude);
		}
	};

	// Добавляем методы в класс бота
	this.addCommand = function (regexp, need_admin, need_registered, callback, description = "") {
		this.commands.push(new Command(regexp, need_admin, need_registered, callback, this, description));
	};

	this.removeAdmin = function (user) {
		this.admin_user.indexOf(user) > -1 && this.admin_user.splice(this.admin_user.indexOf(user), 1);
	};
	this.addAdmin = function (user) {
		this.admin_user.push(user);
		this.admin_user = this.admin_user.unique();
	};

	this.addRegisteredChat = function (chat_id) {
		this.registered_chat_ids.push(chat_id);
		this.registered_chat_ids = this.registered_chat_ids.unique();
	};

	this.notifyAllAdmins = msg=>this.registered_chat_ids.forEach((chat_id) =>this.telegram_class.sendMessage(chat_id, msg));

	// Задаем стартовые значения переменным бота
	this.admin_user = configuration.admin_user;
	this.commands = [];
	this.name = configuration.bot_name;
	this.allow_code = 0;
	this.registered_chat_ids = configuration.registered_chat_ids;
	this.location_regex = /\d{2}\.\d{4,8}.{1,3}\d{2}\.\d{4,8}/i;

	fs.accessSync('./engines/' + configuration.engine + ".js", fs.F_OK);
	this.currentEngine = require('./engines/' + configuration.engine + ".js")(configuration, this, ProxyFactory);

	// Обрабатываем все зарегистрированные команды
	this.telegram_class.on('message', (msg)=> {
		try {
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
	this.addCommand(/^\/admin_user_list$/, true, false, msg => this.telegram_class.answer(msg, this.admin_user.map(el=>"@" + el).join("\n")), "Показывает список админов бота.");

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

	// Пользовательские команды, работают только в зарегистрированных чатах
	this.addCommand(/^\/help$/, false, true, msg =>
			this.telegram_class.answer(msg, this.commands
				.filter(el=>!el.need_admin && el.description)
				.map(el=>el.regexp.toString().match(/\\(\/.*)\//)[1].replace('$', '') + " - " + el.description)
				.join("\n"))
		, "Выводит эту информацию.");

	this.addCommand(this.location_regex, false, true, msg => {
		msg.text.match(/([а-яА-я]+\s[а-яА-я]+)?.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach((element, index) => {
			var location = element.match(/\d{2}[.,]\d{2,8}/ig);
			var title = element.match(/[а-яА-я]+\s[а-яА-я]+/ig);
			title = title != null ? title[0] : "";
			setTimeout(() => {
				this.telegram_class.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
			}, index * 3000);
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
	this.notifyAllAdmins("Bot started");
	this.currentEngine.init();
	logger.info("Bot started.");
	return this;
};

module.exports = BotClass;