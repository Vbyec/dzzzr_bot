var iconv = require('iconv-lite'),
	cheerio = require('cheerio');
iconv.skipDecodeWarning = true;

var ClassicEngine = function (configuration, bot, ProxyFactory) {
	this.request = {};
	this.bot = bot;
	this.setRequest = function () {
		this.request = require('request').defaults({
			jar: true,
			followAllRedirects: true,
			headers: {
				Referer: "http://classic.dzzzr.ru/moscow/go"
			}, auth: {
				user: configuration.classic.http_login,
				pass: configuration.classic.pin
			}
		})
	};
	this.response_codes = {
		1: "Игра не началась",
		2: "Неверный PIN",
		3: "Авторизация пройдена успешно",
		4: "Не введен код",
		5: "Время на отправку кода вышло. Решайте следующее задание",
		6: "",
		7: "Уже был введен",
		8: "Код принят",
		9: "Код принят. Выполняйте следующее задание.",
		10: "Спасибо за игру. Игра закончена",
		11: "Код не принят",
		12: "Вы вводили неверный код больше 4 раз. Прием данных от Вас заблокирован на три минуты. Повторите попытку позже",
		15: "Вам не запланировано следующее задание.",
		16: "Код принят",
		17: "Время на отправку кода вышло"
	};
	this.code_regex = /(^[1-9]*d[1-9]*r[1-9]*$)|(^[1-9]*r[1-9]*d[1-9]*$)|(^[1-9]*д[1-9]*р[1-9]*$)|(^[1-9]*р[1-9]*д[1-9]*$)|(^!\..*)/i;
	this.name = 'classic';
	this.level = 0;
	this.authorised = 0;

	this.init = function () {
		this.bot.addCommand(this.code_regex, false, true, msg => {
			var code = msg.text.match(this.code_regex)[0].toLowerCase().replace('д', 'd').replace('р', 'r');
			if (this.bot.allow_code && code.length > 2) {
				this.sendCode(code, (response) => {
					this.bot.telegram_class.reply(msg, response);
				});
			}
		});

		this.bot.addCommand(/^\/set_pin/, true, false, msg => {
			assertNotEmpty(msg.text.match(/.*\s(.*)/), "Не указан пин.");
			configuration.classic.pin = msg.text.match(/.*\s(.*)/)[1].trim();
			this.setRequest();
			this.bot.telegram_class.reply(msg, "Новый пин:" + configuration.classic.pin);
		}, "Устанавливает пин на текущую игру.");

		this.bot.addCommand(/^\/get_url/, false, true, msg => {
			this.bot.telegram_class.answer(msg, "http://" + configuration.classic.http_login + ":" + configuration.classic.pin + "@classic.dzzzr.ru/moscow/go/");
		}, "Выдает URL на текущую игру.");

		this.setRequest();
		this.login(function (msg) {
			console.log(configuration.bot_name + " " + msg);
		});
	};

	this.login = function (callback) {
		var self = this;
		this.request.post(
			{
				url: "http://classic.dzzzr.ru/moscow/",
				encoding: 'binary',
				form: {
					action: "auth",
					login: configuration.classic.login,
					password: configuration.classic.password
				}
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					body = iconv.decode(body, 'win1251');
					self.authorised = !!body.match("Здравствуйте, " + configuration.classic.login);
					callback(self.authorised);
				} else {
					//request.defaults({proxy:"http://"+ProxyFactory.get()});
					//self.login(callback);
					//console.log('error');
				}
			}
		);
	};
	this.sendCode = function (code, callback) {
		var self = this;
		this.request.post(
			{
				uri: "http://classic.dzzzr.ru/moscow/go/",
				encoding: 'binary',
				form: {
					cod: code,
					action: "entcod"
				}
			}, function (error, response, body) {
				var response_code = response.request.uri.search.match(/&err=(\d{1,2})/)[1];
				if (!error && response.statusCode == 200) {
					body = iconv.decode(body, 'win1251');
					self.getLevel(body);
					if (self.response_codes[response_code]) {
						callback(self.response_codes[response_code]);
					} else {
						callback(self.getAnswer(body));
					}
				}
			}
		);
	};
	this.getAnswer = function (page) {
		$ = cheerio.load(page);
		return $('.sysmsg').text();
	};
	this.getLevel = function (page) {
		$ = cheerio.load(page);
		this.level = $('.title').text().match(/Задание.(\d{1,2})/)[1];
	};
	this.getTime = function (page) {
		var time = page.match(/window.setTimeout\(.countDown.(\d{1,5})/)[1];
		return pad(Math.floor(time / 60), 2) + ":" + pad(time % 60, 2);
	};
	this.getCodeList = function (page) {
		var sector, result = [], sectors = page.match(/<strong>Коды сложности<\/strong>(.*)<br>/)[1].split("<br>");
		for (var i = 1; i < sectors.length; i++) {
			if (sectors[i].indexOf("бонусные коды:") != -1) {
				sector = {name: 'Бонусные коды', list: []};
				sectors[i].replace(/бонусные коды:/, "").split(',').forEach(function (element, index) {
					sector.list.push({
						index: index + 1,
						difficult: element.trim(),
						done: element.trim().substring(0, 5) == "<span"
					});
				});
				result.push(sector);
			}
			if (sectors[i].indexOf("основные коды:") != -1) {
				sector = {name: 'Основные коды', list: []};
				sectors[i].replace(/основные коды:/, "").split(',').forEach(function (element, index) {
					sector.list.push({
						index: index + 1,
						difficult: element.trim(),
						done: element.trim().substring(0, 5) == "<span"
					});
				});
				result.push(sector);
			}
		}
		return result;
	};
	this.getPage = function (callback) {
		var self = this;
		this.request.get({
			url: "http://classic.dzzzr.ru/moscow/go",
			encoding: 'binary'
		}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				body = iconv.decode(body, 'win1251');
				//self.getLevel(body);
				callback(body);
			}
		});
	};
	return this;
};


function encode_utf8(s) {
	return unescape(encodeURIComponent(s));
}

function decode_utf8(s) {
	return decodeURIComponent(escape(s));
}

function pad(num, size) {
	var s = num + "";
	while (s.length < size) s = "0" + s;
	return s;
}
module.exports = ClassicEngine;