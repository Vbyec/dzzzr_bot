var iconv = require('iconv-lite'),
	Entities = require('html-entities').AllHtmlEntities,
	cheerio = require('cheerio');
iconv.skipDecodeWarning = true;
entities = new Entities();

var ClassicEngine = function (configuration, bot, ProxyFactory) {
	this.request = {};
	this.bot = bot;
	this.watcher = {};
	this.setRequest = function () {
		this.request = require('request').defaults({
			jar: true,
			followAllRedirects: true,
			headers: {
				Referer: "http://classic.dzzzr.ru/",
				Host: "classic.dzzzr.ru"
			}, auth: {
				user: configuration.classic.http_login,
				pass: configuration.classic.pin
			}
		});
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
					this.bot.telegram_class.reply(msg, response.text);
					if (response.done) {
						this.getPage()
							.then(page=> {
								let task = this.getTask(page);
								this.bot.telegram_class.answer(msg, task.text);
								task.images.map(img=>this.bot.telegram_class.sendPhoto(msg.chat.id, request(img)));
								setTimeout(() => {
									task.text.match(/([а-яА-я]+\s[а-яА-я]+)?.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach((element, index) => {
										var location = element.match(/\d{2}[.,]\d{2,8}/ig);
										var title = element.match(/[а-яА-я]+\s[а-яА-я]+/ig);
										title = title != null ? title[0] : "";
										setTimeout(() => {
											this.bot.telegram_class.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
										}, index * 3000);
									})
								}, 2000);
							})
							.catch(message=> this.bot.telegram_class.answer(msg, message));
						this.watcher = setInterval(()=> {
							this.getPage()
								.then(page=> {
									let spoiler = this.getSpoiler(page);
									if (spoiler.text) {
										clearInterval(this.watcher);
										this.bot.telegram_class.answer(msg, spoiler.text);
										spoiler.images.map(img=>this.bot.telegram_class.sendPhoto(msg.chat.id, request(img)));
										setTimeout(() => {
											spoiler.text.match(/([а-яА-я]+\s[а-яА-я]+)?.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach((element, index) => {
												var location = element.match(/\d{2}[.,]\d{2,8}/ig);
												var title = element.match(/[а-яА-я]+\s[а-яА-я]+/ig);
												title = title != null ? title[0] : "";
												setTimeout(() => {
													this.bot.telegram_class.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
												}, index * 3000);
											})
										}, 2000);
									}
								})
						}, 3000);
					}
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

		this.bot.addCommand(/^\/get_task/, false, true, msg => {
			this.getPage()
				.then(page=> {
					let task = this.getTask(page);
					this.bot.telegram_class.answer(msg, task.text);
					task.images.map(img=>this.bot.telegram_class.sendPhoto(msg.chat.id, request(img)));
					setTimeout(() => {
						task.text.match(/([а-яА-я]+\s[а-яА-я]+)?.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach((element, index) => {
							var location = element.match(/\d{2}[.,]\d{2,8}/ig);
							var title = element.match(/[а-яА-я]+\s[а-яА-я]+/ig);
							title = title != null ? title[0] : "";
							setTimeout(() => {
								this.bot.telegram_class.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
							}, index * 3000);
						})
					}, 2000);
				})
				.catch(message=> this.bot.telegram_class.answer(msg, message));
		}, "Выдает текст текущего задания.");
		this.setRequest();
		this.fuckCloudFlare()
			.then(status=> {
				this.bot.notifyAllAdmins("CloudFlare check " + status);
				this.login().then(msg=>this.bot.notifyAllAdmins("Auth " + msg));
			})
			.catch(status=> this.bot.notifyAllAdmins("CloudFlare check " + status));
	};

	this.fuckCloudFlare = function () {
		return new Promise((resolve, reject)=> {
			this.request.get(
				{
					url: "http://classic.dzzzr.ru/moscow/"
				}, (error, response, body) => {
					$ = cheerio.load(body);
					let definition = body.match(/var t,r,a,f, (.*)/)[1];
					let calculation = body.match(/;(.*)a.value = parseInt/)[1];
					let variable = eval(definition + calculation);
					let form = {
						jschl_vc: $("[name=jschl_vc]").val(),
						pass: $("[name=pass]").val(),
						jschl_answer: parseInt(variable, 10) + 16
					};

					function buildUrl(url, parameters) {
						var qs = "";
						for (var key in parameters) {
							var value = parameters[key];
							qs += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
						}
						if (qs.length > 0) {
							qs = qs.substring(0, qs.length - 1); //chop off last "&"
							url = url + "?" + qs;
						}
						return url;
					}

					setTimeout(() => {
						this.request.get(
							{
								url: buildUrl("http://classic.dzzzr.ru/cdn-cgi/l/chk_jschl", form)
							}, (error, response) => {
								response.statusCode == 200 ? resolve(response.statusMessage) : reject(response.statusMessage);
							});
					}, 4000);
				}
			);
		})
	};

	this.login = function () {
		return new Promise((resolve)=> {
			this.request.post(
				{
					url: "http://classic.dzzzr.ru/moscow/",
					encoding: 'binary',
					form: {
						action: "auth",
						login: configuration.classic.login,
						password: configuration.classic.password
					}
				}, (error, response, body) => {
					if (!error && response.statusCode == 200) {
						body = iconv.decode(body, 'win1251');
						this.authorised = !!body.match("Здравствуйте, " + configuration.classic.login);
						resolve(this.authorised);
					}
				}
			);
		})
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
					let answer = self.response_codes[response_code] ? self.response_codes[response_code] : self.getAnswer(body);
					let done = response_code == 5 || response_code == 9;
					callback({text: answer, done: done});
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
		return $('.title').text().match(/Задание.(\d{1,2})/)[1];
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
	this.getTask = function (page) {
		let task = page.slice(page.indexOf('<div class=zad>'), page.indexOf('Спойлер') > -1 ? page.indexOf('Спойлер') : page.indexOf('Коды сложности')),
			images = task.match(/<img src="[^"]*"/g) ? task.match(/<img src="[^"]*"/g).map(img=>img.match(/"[^"]*"/)[0].replace(/"/g, '').replace(/..\/..\//, 'http://classic.dzzzr.ru/')) : [];
		return {text: entities.decode(task.replace('</p>', '\n').replace('<br />', '\n').replace(/(<[^>]*>)/g, '')), images: images};
	};
	this.getSpoiler = function (page) {
		let spoiler_text = page.slice(page.indexOf('Спойлер'), page.indexOf('Коды сложности')),
			images = spoiler_text.match(/<img src="[^"]*"/g) ? spoiler_text.match(/<img src="[^"]*"/g).map(img=>img.match(/"[^"]*"/)[0].replace(/"/g, '').replace(/..\/..\//, 'http://classic.dzzzr.ru/')) : [];

		return {text: entities.decode(spoiler_text.replace('</p>', '\n').replace('<br />', '\n').replace(/(<[^>]*>)/g, '')), images: images};
	};
	this.getPage = function () {
		return new Promise((resolve, reject) => {
			this.request.get({
				url: "http://classic.dzzzr.ru/moscow/go",
				encoding: 'binary'
			}, function (error, response, body) {
				if (response.statusCode == 401) reject('Ошибка авторизации');
				if (match = body.match(/начнется (.+).<br>Ждем вас к началу игры/))reject('Игра еще не началась. Старт ' + match[1]);
				if (!error && response.statusCode == 200) {
					body = iconv.decode(body, 'win1251');
					resolve(body);
				}
			});
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