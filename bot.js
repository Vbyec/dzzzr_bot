var BotClass = function (configuration_file, ProxyFactory) {

	var fs = require('fs'),
		configuration = JSON.parse(fs.readFileSync(configuration_file)),
		log4js = require('log4js'),
		TelegramBot = require('node-telegram-bot-api'),
		bot = new TelegramBot(configuration.token, {polling: true});
	require('./functions');
	log4js.loadAppender('file');
	log4js.addAppender(log4js.appenders.file(configuration.log_path + "/" + configuration.bot_name + ".log"), configuration.bot_name);
	var logger = new log4js.getLogger(configuration.bot_name);
	ProxyFactory.setLogger(logger);
	// catch all exceptions
	process.on('uncaughtException', function (err) {
		logger.fatal('Caught exception: ' + err + '\n' + err.stack);
	});

	bot.admin_user = configuration.admin_user;
	bot.name = configuration.bot_name;
	bot.allow_code = 1;
	bot.excluded_command = ['register_chat', 'man'];
	bot.man_list = [
		"/register_chat - Регистрирует текущий чат как разрешенный",
		"/admin_user_add - Добавляет указанного пользователя в админы боты",
		"/admin_user_remove - Удаляет указанного пользователя из админов бота",
		"/admin_user_list -  Показывает список админов бота.",
		"/allow_code -  Разрешает вбивать коды.",
		"/forbid_code -  Запрещает вбивать коды.",
		"/add_excluded -  Добавляет команду в запрещенные.",
		"/remove_excluded -  Убирает команду из запрещенных."];

	bot.help_list = [
		"!. - Вбивает присланный нестандартный код в движок",
		"/list - Выводит список оставшихся кодов.",
		"/help - Выводит эту информацию "];
	bot.registered_chat_ids = configuration.registered_chat_ids;
	bot.reply = function (msg, text) {
		bot.sendMessage(msg.chat.id, text, {reply_to_message_id: msg.message_id});
	};
	bot.answer = function (msg, text, option) {
		bot.sendMessage(msg.chat.id, text, option);
	};
	bot.send_location = function (msg, latitude, longitude, title) {
		console.log(title);
		if (title && typeof  title == "string") {
			bot.sendMessage(msg.chat.id, title).then(function () {
				bot.sendLocation(msg.chat.id, latitude, longitude);
			});
		} else {
			bot.sendLocation(msg.chat.id, latitude, longitude);
		}
	};
	/**
	 *
	 * @returns {boolean}
	 */
	bot.IsUserAdmin = function (username) {
		return this.admin_user.indexOf(username) > -1;
	};

	bot.removeAdmin = function (user) {
		if ((index = this.admin_user.indexOf(user)) > -1) {
			this.admin_user.splice(index, 1);
		}
	};
	bot.addAdmin = function (user) {
		this.admin_user.push(user);
		this.admin_user = this.admin_user.unique();
	};

	bot.addRegisteredChat = function (chat_id) {
		this.registered_chat_ids.push(chat_id);
		this.registered_chat_ids = this.registered_chat_ids.unique();
	};
	bot.onText(/^\/register_chat/, function (msg) {
		try {
			logger.info("/register_chat command handled. chat_id=" + msg.chat.id);
			assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
			bot.addRegisteredChat(msg.chat.id);
			bot.reply(msg, "Чат зарегистрирован.");
		} catch (e) {
			logger.fatal(e.stack);
			bot.reply(msg, e.message);
		}
	});

	bot.onText(/^\/man/, function (msg) {
		try {
			logger.info("/man command handled.");
			assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
			bot.answer(msg, bot.man_list.join("\n"));
		} catch (e) {
			logger.fatal(e.stack);
			bot.reply(msg, e.message);
		}
	});
	fs.accessSync('./engines/' + configuration.engine + ".js", fs.F_OK);
	var currentEngine = require('./engines/' + configuration.engine + ".js")(configuration, bot, ProxyFactory);
	bot.onText(currentEngine.code_regex, function (msg, match) {
		logger.info("code matched " + msg.text);
		try {
			assertNotEmpty(bot.registered_chat_ids.indexOf(msg.chat.id) > -1, "Не зарегистрированный чат.");
			var command, standard_code = true;
			if (!!match[0].match(/^!\..*/)) {
				standard_code = false;
				command = match[0].toLowerCase().substring(2);
			} else {
				command = match[0].toLowerCase().replace('д', 'd').replace('р', 'r');
			}
			if (bot.allow_code) {
				if (command.length > 2 || !standard_code) {
					currentEngine.sendCode(command, function (response) {
						bot.reply(msg, response);
					});
				}
			}
		}
		catch (e) {
			logger.fatal(e.stack);
			bot.reply(msg, e.message);
		}
	});
	bot.onText(currentEngine.location_regex, function (msg, match) {
		logger.info("location matched " + msg.text);
		try {
			assertNotEmpty(bot.registered_chat_ids.indexOf(msg.chat.id) > -1, "Не зарегистрированный чат.");
			msg.text.match(/([а-яА-я]+\s[а-яА-я]+)?.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach(function (element, index) {
				var location = element.match(/\d{2}[.,]\d{2,8}/ig);
				var title = element.match(/[а-яА-я]+\s[а-яА-я]+/ig);
				title = title != null ? title[0] : "";
				setTimeout(function () {
					bot.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
				}, index * 3000);
			});
		}
		catch (e) {
			logger.fatal(e.stack);
			bot.reply(msg, e.message);
		}
	});

	bot.onText(/^\/([^\s]+)\s?(.+)?/, function (msg, match) {
		var from_id = msg.chat.id;
		var command = match[1].toLowerCase().replace('@' + bot.name, '');
		var arg = match[2];
		logger.info("Request for /" + command + " command");
		try {
			if (bot.excluded_command.indexOf(command) == -1) {
				assertNotEmpty(bot.registered_chat_ids.indexOf(from_id) > -1, "Не зарегистрированный чат.");
				switch (command) {
					case "help":
						logger.info("/" + command + " command handled.");
						bot.answer(msg, bot.help_list.join("\n"));
						break;
					case 'list':
						currentEngine.getPage(function (page) {
							if (match = page.match(/начнется (.+).<br>Ждем вас к началу игры/)) {
								bot.answer(msg, 'Игра еще не началась. Старт ' + match[1]);
							} else {
								var list = currentEngine.getCodeList(page);
								if (list.length) {
									bot.answer(msg, list.map(function (sector) {
										return sector.name + ":\n" + sector.list.map(function (code) {
												return code.done ? null : code.index + ") " + code.difficult;
											}).filter(function (n) {
												return n != undefined
											}).join("\n");
									}).join("\n"));
								} else {
									bot.answer(msg, 'В данном задании не указаны КС');
								}
							}
						});
						break;
					case 'allow_code':
						logger.info("/" + command + " command handled.");
						assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
						bot.allow_code = 1;
						logger.info("allow_code new value=" + bot.allow_code);
						bot.answer(msg, "Теперь коды <strong>РАЗРЕШЕНО</strong> вбивать", {parse_mode: 'HTML'});
						break;
					case 'forbid_code':
						logger.info("/" + command + " command handled.");
						assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
						bot.allow_code = 0;
						logger.info("allow_code new value=" + bot.allow_code);
						bot.answer(msg, "Теперь коды <strong>ЗАПРЕЩЕНО</strong> вбивать", {parse_mode: 'HTML'});
						break;
					case 'admin_user_add':
						logger.info("/" + command + " command handled.");
						assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
						assertNotEmpty(arg, "Не указан пользователь для добавления");
						arg = arg.replace("@", "");
						bot.addAdmin(arg);
						bot.reply(msg, "@" + arg + " добавлен в список админов");
						break;
					case 'admin_user_remove':
						logger.info("/" + command + " command handled.");
						assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
						assertNotEmpty(arg, "Не указан пользователь для удаления");
						arg = arg.replace("@", "");
						bot.removeAdmin(arg);
						bot.reply(msg, "@" + arg + " удален из списока админов");
						break;
					case 'admin_user_list':
						logger.info("/" + command + " command handled.");
						assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
						var text = "";
						bot.admin_user.forEach(function (element) {
							text += "@" + element + "\n";
						});
						bot.reply(msg, text);
						break;
					case 'set_light_pin':
						logger.info("/" + command + " command handled.");
						assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
						configuration.light.pin = arg.trim();
						bot.reply(msg, "Новый пин:" + configuration.light.pin);
						break;
					case 'get_light_url':
						logger.info("/" + command + " command handled.");
						bot.reply(msg, "URL на текущую игру http://lite.dzzzr.ru/moscow/go/?pin=" + configuration.light.pin);
						break;
					case 'add_excluded':
						logger.info("/" + command + " command handled.");
						assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
						bot.excluded_command.push(arg.trim());
						bot.reply(msg, 'Команда ' + arg.trim() + ' теперь запрещена');
						break;
					case 'remove_excluded':
						logger.info("/" + command + " command handled.");
						assertNotEmpty(bot.IsUserAdmin(msg.from.username), "Недостаточно прав");
						var index = bot.excluded_command.indexOf(arg.trim());
						assertNotEmpty(index > -1, "Команда не запрещена");
						bot.excluded_command.splice(index, 1);
						bot.reply(msg, 'Команда ' + arg.trim() + ' теперь разрешена');
						break;
					default :
						logger.warn("/" + command + " - unknown command");
						bot.reply(msg, "Unknown command");
						break;
				}
			}
		} catch (e) {
			logger.fatal(e.stack);
			bot.reply(msg, e.message);
		}
	});

	if (bot.registered_chat_ids[0]) {
		//bot.sendMessage(bot.registered_chat_ids[0], "Bot started");
	}
	currentEngine.init();
	logger.info("Bot started.");
	return this;
};

module.exports = BotClass;