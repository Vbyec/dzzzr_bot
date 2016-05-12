var iconv = require('iconv-lite'),
	cheerio = require('cheerio');
iconv.skipDecodeWarning = true;

var ClassicEngine = function (configuration,bot) {
		request = require('request').defaults({
			jar: true,
			followAllRedirects: true,
			headers: {
				Referer: "http://mera.dozormsk.com/232p/index.php"
			}
		});
		this.code_regex = /(^[1-9]*d[1-9]*r[1-9]*$)|(^[1-9]*r[1-9]*d[1-9]*$)|(^[1-9]*д[1-9]*р[1-9]*$)|(^[1-9]*р[1-9]*д[1-9]*$)|(^!\..*)/i;
		this.location_regex = /\d{2}[.,]\d{2,8}.{1,3}\d{2}[.,]\d{2,8}/i;
		this.name = 'Mera';
		this.level = 0;
		this.authorised = 0;
		this.init = function () {
			this.login(function (msg) {
				console.log(configuration.bot_name + " " + msg);
			});
		};
		this.login = function (callback) {
			var old_this = this;
			request.post(
				{
					url: "http://mera.dozormsk.com/232p/index.php",
					encoding: 'binary',
					form: {
						action: "auth",
						auth_login: configuration.mera.login,
						auth_pass: configuration.mera.password
					}
				}, function (error, response, body) {
					if (!error && response.statusCode == 200) {
						body = iconv.decode(body, 'utf-8');
						old_this.authorised = !!body.match("Приветствуем,");
						callback(old_this.authorised);
					}
				}
			);
		};
		this.sendCode = function (code, callback) {
			var old_this = this;
			request.post(
				{
					uri: "http://mera.dozormsk.com/232p/index.php",
					encoding: 'binary',
					form: {
						code: code,
						level: ClassicEngine.level
					}
				}, function (error, response, body) {
					if (!error && response.statusCode == 200) {
						body = iconv.decode(body, 'utf-8');
						callback(old_this.getAnswer(body));
					}
				}
			);
		};
		this.getAnswer = function (page) {
			$ = cheerio.load(page);
			return $('.info2 .message').text();
		};
		this.getTasks = function () {
			return true;
		};
		this.getCodeList = function (page) {
			var result = [];
			var sector = {name: 'Обычные коды', list: []};
			$ = cheerio.load(page);
			$('.code_not_entered').each(function (index, elem) {
				sector.list.push({
					index: index + 1,
					difficult: $(elem).text().trim(),
					done: 0
				});
			});
			result.push(sector);
			return result;
		};
		this.getPage = function (callback) {
			request.get({
				url: "http://mera.dozormsk.com/232p/index.php",
				encoding: 'binary'
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					body = iconv.decode(body, 'utf-8');
					ClassicEngine.level = body.match(/name="level" value="[0-9]+/)[0].replace(/[^0-9]+/, '');
					callback(body);
				}
			});
		};
		return this;
	}
	;


function encode_utf8(s) {
	return unescape(encodeURIComponent(s));
}

function decode_utf8(s) {
	return decodeURIComponent(escape(s));
}
module.exports = ClassicEngine;