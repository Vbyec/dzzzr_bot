var iconv = require('iconv-lite'),
	Entities = require('html-entities').AllHtmlEntities,
	cheerio = require('cheerio');
iconv.skipDecodeWarning = true;
entities = new Entities();

var ClassicEngine = function (configuration, bot) {
	this.request = {};
	this.bot = bot;
	this.city = configuration.classic.city || 'moscow';
	this.watcher = {};
	this.cookie = {};
	this.setRequest = function () {
		this.request = require('request').defaults({
			followAllRedirects: true,
			headers: {
				Referer: "http://classic.dzzzr.ru/",
				Host: "classic.dzzzr.ru"
			}, auth: {
				user: configuration.classic.http_login,
				pass: configuration.classic.pin
			}
		});
		this.cookie = this.request.jar();
		return this;
	};
	this.response_codes = {
		1: "Игра не началась",
		2: "Неверный PIN",
		3: "Авторизация пройдена успешно",
		4: "Не введен код",
		5: "Время на отправку кода вышло. Решайте следующее задание",
		6: "",
		7: "❌ <i>Уже был введен</i>",
		8: "✅ <i>Код принят</i>",
		9: "✅ <i>Код принят. Выполняйте следующее задание.</i>",
		10: "Спасибо за игру. Игра закончена",
		11: "❌ <i>Код не принят</i>",
		12: "Вы вводили неверный код больше 4 раз. Прием данных от Вас заблокирован на три минуты. Повторите попытку позже",
		15: "Вам не запланировано следующее задание.",
		16: "✅ <i>Код принят</i>",
		17: "Время на отправку кода вышло"
	};
	this.code_regex = /(^[1-9]*d[1-9]*r[1-9]*$)|(^[1-9]*r[1-9]*d[1-9]*$)|(^[1-9]*д[1-9]*р[1-9]*$)|(^[1-9]*р[1-9]*д[1-9]*$)|(^\..*)/i;
	this.name = 'classic';
	this.level = 0;
	this.authorised = 0;

	this.init = function () {
		this.bot.addCommand(this.code_regex, false, true, msg => {
			var code = msg.text.match(this.code_regex)[0].toLowerCase().replace('д', 'd').replace('р', 'r').replace(/^\./, '');
			if (this.bot.allow_code && code.length > 2) {
				this.sendCode(code, (response) => {
					this.bot.telegram_class.reply(msg, response.text, {parse_mode: 'HTML'});
					if (response.done) {
						this.getPage()
							.then(page=> {
								let task = this.getTask(page);
								this.bot.telegram_class.answer(msg, task.text);
								task.images.map(img=>this.bot.telegram_class.sendPhoto(msg.chat.id, this.request(img)));
								setTimeout(() => {
									task.text.match(/(\d*[а-я]+\s?){0,2}?.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach((element, index) => {
										let location = element.match(/\d{2}[.,]\d{2,8}/ig);
										let title = element.match(/(\d*[а-я]+\s?){1,2}/i);
										title = title != null ? title[0] : "";
										this.bot.telegram_class.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
									})
								}, 2000);
							})
							.catch(message=> this.bot.telegram_class.answerError(msg, message));
						this.watcher = setInterval(()=> {
							this.getPage()
								.then(page=> {
									let spoiler = this.getSpoiler(page);
									if (spoiler.text) {
										clearInterval(this.watcher);
										this.bot.telegram_class.answer(msg, spoiler.text);
										spoiler.images.map(img=>this.bot.telegram_class.sendPhoto(msg.chat.id, this.request(img)));
										setTimeout(() => {
											spoiler.text.match(/(\d*[а-я]+\s?){0,2}.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach((element, index) => {
												var location = element.match(/\d{2}[.,]\d{2,8}/ig);
												var title = element.match(/(\d*[а-я]+\s?){0,2}/ig);
												title = title != null ? title[0] : "";
												this.bot.telegram_class.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
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
			configuration.save();
			this.authorize()
				.then(auth=> this.getPage())
				.then(message=> this.bot.telegram_class.answer(msg, "Game auth: true"))
				.catch(message=> this.bot.telegram_class.answerError(msg, message));
			this.bot.telegram_class.reply(msg, "Новый пин:" + configuration.classic.pin);
		}, "Устанавливает пин на текущую игру.");

		this.bot.addCommand(/^\/get_url/, false, true, msg => {
			this.bot.telegram_class.answer(msg, "http://" + configuration.classic.http_login + ":" + configuration.classic.pin + "@classic.dzzzr.ru/" + this.city + "/go/");
		}, "Выдает URL на текущую игру.");

		this.bot.addCommand(/^\/get_task/, false, true, msg => {
			this.getPage()
				.then(page=> {
					let task = this.getTask(page);
					this.bot.telegram_class.answer(msg, task.text);
					task.images.map(img=>this.bot.telegram_class.sendPhoto(msg.chat.id, this.request(img)));
					setTimeout(() => {
						task.text.match(/(\d*[а-я]+\s?){0,2}.{0,4}\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/ig).forEach((element, index) => {
							var location = element.match(/\d{2}[.,]\d{2,8}/ig);
							var title = element.match(/(\d*[а-я]+\s?){0,2}/ig);
							title = title != null ? title[0] : "";
							this.bot.telegram_class.send_location(msg, location[0].replace(/,/, "."), location[1].replace(/,/, "."), title)
						})
					}, 2000);
				})
				.catch(message=> this.bot.telegram_class.answerError(msg, message));
		}, "Выдает текст текущего задания.");
		this.authorize();
	};

	this.authorize = function () {
		return new Promise(resolve=> {
			this.setRequest()
				.fuckCloudFlare()
				.then(status=> this.bot.notifyAllAdmins("CloudFlare check: " + status))
				.catch(status=> this.bot.notifyAllAdmins("CloudFlare check: " + status))
				.then(msg=> this.login())
				.then(msg=> this.bot.notifyAllAdmins("Engine auth: true"))
				.then(msg=> resolve())
				.catch(msg=>this.bot.notifyErrorAllAdmins("Engine auth: false"));
		})
	};

	this.fuckCloudFlare = function () {
		return new Promise((resolve, reject)=> {
			this.request.get(
				{
					url: "http://classic.dzzzr.ru/" + this.city + "/",
					jar: this.cookie
				}, (error, response, body) => {
					if (response.statusCode == 200) {
						resolve(' no CloudFlare');
						return true;
					}
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
								url: buildUrl("http://classic.dzzzr.ru/cdn-cgi/l/chk_jschl", form),
								jar: this.cookie
							}, (error, response) => {
								response.statusCode == 200 ? resolve(response.statusMessage) : reject(response.statusMessage);
							});
					}, 4000);
				}
			);
		})
	};

	this.login = function () {
		return new Promise((resolve, reject)=> {
			this.request.post(
				{
					url: "http://classic.dzzzr.ru/" + this.city + "/",
					encoding: 'binary',
					jar: this.cookie,
					form: {
						action: "auth",
						login: configuration.classic.login,
						password: configuration.classic.password
					}
				}, (error, response, body) => {
					if (!error && response.statusCode == 200) {
						body = iconv.decode(body, 'win1251');
						this.authorised = !!body.match("Здравствуйте, " + configuration.classic.login);
						this.authorised ? resolve() : reject();
					}
				}
			);
		})
	};
	this.sendCode = function (code, callback) {
		var self = this;
		this.getPage().then(
				page => {
				let old_list = this.getCodeList(page);
				this.request.post(
					{
						uri: "http://classic.dzzzr.ru/" + this.city + "/go/",
						jar: this.cookie,
						encoding: 'binary',
						formData: {
							cod: iconv.encode(code, 'cp1251'),
							action: "entcod"
						}
					}, function (error, response, body) {
						var response_code = response.request.uri.search.match(/&err=(\d{1,2})/)[1];
						if (!error && response.statusCode == 200) {
							body = iconv.decode(body, 'win1251');
							let answer = self.response_codes[response_code] ? self.response_codes[response_code] : self.getAnswer(body);
							let done = response_code == 5 || response_code == 9;
							if (response_code == 8 || response_code == 9 || response_code == 16) {
								let diff = [];
								let new_list = self.getCodeList(body);
								new_list.forEach((el, index)=> el.list.forEach((code, code_index)=> {
										self.bot.logger.info(code, index, old_list[index].list.find(old_code=>old_code.index == code.index));
										if (code.done != old_list[index].list.find(old_code=>old_code.index == code.index).done) diff.push({
											name: el.name,
											index: code.index,
											difficult: code.difficult
										})
									}
								));
								//@fixme Убрать через игру
								//self.bot.logger.info(old_list, diff, new_list);
								if (diff.length == 1) {
									answer = diff[0].name == 'Основные коды' ? "✅ <i>Принят основной код</i>" : "✅ <i>Принят бонусный код</i>";
									answer += `\n<b>КО:</b> ${diff.difficult}`
									answer += `\n<b>Метка:</b> ${diff.index}`
								}
							}
							callback({text: answer, done: done});
						}
					}
				);
			});
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
				url: "http://classic.dzzzr.ru/" + this.city + "/go",
				encoding: 'binary',
				jar: this.cookie
			}, (error, response, body) => {
				if (response.statusCode == 401) reject('Game auth: false');
				body = iconv.decode(body, 'win1251');
				if (match = body.match(/начнется (.+).<br>Ждем вас к началу игры/))reject('Игра еще не началась. Старт ' + match[1]);
				if (!error && response.statusCode == 200) {
					resolve(body);
				}
			});
		});
	};
	return this;
};

function pad(num, size) {
	var s = num + "";
	while (s.length < size) s = "0" + s;
	return s;
}
module.exports = ClassicEngine;