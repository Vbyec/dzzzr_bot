var request = require('request').defaults({
		jar: true,
		headers: {
			Referer: "http://lite.dzzzr.ru/",
			Host: "lite.dzzzr.ru"
		}
	}),
	iconv = require('iconv-lite'),
	cheerio = require('cheerio');

iconv.skipDecodeWarning = true;

var LightEngine = function (configuration, bot) {
	this.code_regex = /(^[1-9]*d[1-9]*r[1-9]*$)|(^[1-9]*r[1-9]*d[1-9]*$)|(^[1-9]*д[1-9]*р[1-9]*$)|(^[1-9]*р[1-9]*д[1-9]*$)|(^!\..*)/i;
	this.location_regex = /\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/i;
	this.name = 'light';
	this.city = configuration.light.city || 'moscow';
	this.bot = bot;

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
			configuration.light.pin = msg.text.match(/.*\s(.*)/)[1].trim();
			configuration.save();
			this.bot.telegram_class.reply(msg, "Новый пин:" + configuration.light.pin);
		}, "Устанавливает пин на текущую игру.");
		this.bot.addCommand(/^\/get_url/, false, true, msg => {
			this.bot.telegram_class.answer(msg, "http://lite.dzzzr.ru/" + this.city + "/go/?pin=" + configuration.light.pin);
		}, "Выдает URL на текущую игру.");

		this.fuckCloudFlare()
			.then(status=>this.bot.notifyAllAdmins("CloudFlare check " + status))
			.catch(status=> this.bot.notifyAllAdmins("CloudFlare check " + status));
	};

	this.fuckCloudFlare = function () {
		return new Promise((resolve, reject)=> {
			request.get(
				{
					url: "http://lite.dzzzr.ru/" + this.city + "/"
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
						jschl_answer: parseInt(variable, 10) + 13
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
						request.get(
							{
								url: buildUrl("http://lite.dzzzr.ru/cdn-cgi/l/chk_jschl", form)
							}, (error, response, body) => {
								response.statusCode == 200 ? resolve(response.statusMessage) : reject(response.statusMessage);
							});
					}, 4000);
				}
			);
		})
	};

	this.sendCode = function (code, callback) {
		var old_this = this;
		request.post(
			{
				uri: "http://lite.dzzzr.ru/" + this.city + "/go/?pin=" + configuration.light.pin,
				followRedirect: true,
				form: {
					cod: code.toWin1251(),
					action: "entcod",
					pin: configuration.light.pin
				}
			}, function (error, response) {
				request({
					uri: response.headers.location,
					method: 'GET',
					encoding: 'binary'
				}, function (error, response, body) {
					if (!error && response.statusCode == 200) {
						body = iconv.decode(body, 'win1251');
						callback(old_this.getAnswer(body));
					}
				});
			}
		);
	};
	this.getAnswer = function (page) {
		$ = cheerio.load(page);
		return $('strong').first().text();
	};
	this.getTasks = function () {
		return true;
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
	this.getPage = function () {
		return new Promise((resolve, reject) => {
			request({
				uri: "http://lite.dzzzr.ru/" + this.city + "/go/?pin=" + configuration.light.pin,
				method: 'GET',
				encoding: 'binary'
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					//@todo Добавить проверку на отсутствие авторизации
					//if (response.statusCode == 401) reject('Ошибка авторизации');
					body = iconv.decode(body, 'win1251');
					resolve(body);
				}
			});
		});
	};
	return this;
};

module.exports = LightEngine;