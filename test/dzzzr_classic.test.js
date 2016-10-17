require('../functions');
var Engine = {},
	should = require('should'),
	iconv = require('iconv-lite'),
	TestTeam = require('./TestTeam'),
	cheerio = require('cheerio');
//iconv.skipDecodeWarning = true;
var test_team = new TestTeam();


describe('Dozor classic', function () {
	before(done=> {
		test_team.getClassic().then(a=> {
			Engine = a;
			done()
		})
	});

	describe('#Matching codes from chat', function () {
		it('should be matched', ()=> ['12rd', '1рд2', '12рд', 'др2345', '!.привет', '!.Hi'].forEach(el=>el.should.match(Engine.code_regex)));
		it('should not be matched', ()=> ['12рd', '12', '120рд', '120rd', 'Привет'].forEach(el=>el.should.not.match(Engine.code_regex)));
	});

	describe('#Login', function () {
		it('Must authorise', done=> {
			Engine.authorised.should.be.not.ok();
			Engine.setRequest().login().then(() => {
				Engine.authorised.should.be.ok();
				done();
			});
		})
	});

	describe('#Send codes', function () {
		it('Send cyrillic to engine', function (done) {
			Engine
				.setRequest()
				.login()
				.then(function () {
					let random = Math.random().toFixed(2);
					let string_to_write = `Алисов Дмитрий Андреевич ${random}`;
					Engine.request.post(
						{
							url: "http://classic.dzzzr.ru/moscow/?section=registr",
							jar: Engine.cookie,
							form: {
								action: "update_user",
								section: 'registr',
								name: string_to_write.toWin1251(),
								login: 'Vbyec',
								email_1: 'Vbyec.aka.minus@gmail.com',
								phone: '8-926-886-07-54'
							}
						}, (error, response, body) => {
							if (!error && response.statusCode == 200) {
								body = iconv.decode(body, 'win1251');
								$ = cheerio.load(body);
								$('input[name="name"]').val().should.be.equal(string_to_write);
								done();
							}
						}
					)
				});
		})
	})
});
