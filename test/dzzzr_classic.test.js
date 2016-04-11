/**
 * Created by vbyec on 03.12.15.
 */

var fs = require('fs');
var configurationFile = 'configuration.json';
var configuration = JSON.parse(
	fs.readFileSync(configurationFile)
);
var Engine = require('../engines/dzzzr_classic')(configuration);


describe('Dozor classic', function () {
	describe('#Matching codes from chat', function () {
		it('should be matched', function () {
			'12rd'.should.match(Engine.code_regex);
			'1рд2'.should.match(Engine.code_regex);
			'12рд'.should.match(Engine.code_regex);
			'др2345'.should.match(Engine.code_regex);
			'!.привет'.should.match(Engine.code_regex);
			'!.Hi'.should.match(Engine.code_regex);
		});
		it('should not be matched', function () {
			'12рd'.should.not.match(Engine.code_regex);
			'12'.should.not.match(Engine.code_regex);
			'120рд'.should.not.match(Engine.code_regex);
			'120rd'.should.not.match(Engine.code_regex);
		});
	});

	describe('#Login', function () {
		it('Must authorise', function (done) {
			Engine.authorised.should.be.not.ok();
			Engine.login(function () {
				Engine.authorised.should.be.ok();
				done();
			});
		})
	})
});
