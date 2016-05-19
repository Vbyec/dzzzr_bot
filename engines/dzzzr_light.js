var request = require('request'),
	iconv = require('iconv-lite'),
	cheerio = require('cheerio');

iconv.skipDecodeWarning = true;

var LightEngine = function (configuration, bot) {
	this.code_regex = /(^[1-9]*d[1-9]*r[1-9]*$)|(^[1-9]*r[1-9]*d[1-9]*$)|(^[1-9]*д[1-9]*р[1-9]*$)|(^[1-9]*р[1-9]*д[1-9]*$)|(^!\..*)/i;
	this.location_regex = /\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/i;
	this.name = 'light';

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
			this.telegram_class.reply(msg, "Новый пин:" + configuration.light.pin);
		}, "Устанавливает пин на текущую игру.");
	};
	this.sendCode = function (code, callback) {
		var old_this = this;
		request.post(
			{
				uri: "http://lite.dzzzr.ru/moscow/go/?pin=" + configuration.light.pin,
				encoding: 'binary',
				followRedirect: true,
				form: {
					cod: code,
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
	this.getPage = function (callback) {
		request({
			uri: "http://lite.dzzzr.ru/moscow/go/?pin=" + configuration.light.pin,
			method: 'GET',
			encoding: 'binary'
		}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				//returning value
				//@todo use this
				body = iconv.decode(body, 'win1251');
				callback(body);
			}
		});
	};
	return this;
};

module.exports = LightEngine;