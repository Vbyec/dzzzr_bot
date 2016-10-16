var fs = require('fs');
var should = require('should');
var configurationFile = 'configuration.json';
var configuration = JSON.parse(fs.readFileSync(configurationFile));
var Engine =new require('../engines/dzzzr_classic')(configuration);

describe('Dozor classic', function () {
	describe('#Matching codes from chat', function () {
		it('should be matched', ()=> {
			'12rd'.should.match(Engine.code_regex);
			'1рд2'.should.match(Engine.code_regex);
			'12рд'.should.match(Engine.code_regex);
			'др2345'.should.match(Engine.code_regex);
			'!.привет'.should.match(Engine.code_regex);
			'!.Hi'.should.match(Engine.code_regex);
		});
		it('should not be matched', ()=> {
			'12рd'.should.not.match(Engine.code_regex);
			'12'.should.not.match(Engine.code_regex);
			'120рд'.should.not.match(Engine.code_regex);
			'120rd'.should.not.match(Engine.code_regex);
			'Привет'.should.not.match(Engine.code_regex);
		});
	});

	describe('#Login', function () {
		it('Must authorise', done=> {
			Engine.authorised.should.be.not.ok();
			Engine.setRequest().login().then(() =>{
				Engine.authorised.should.be.ok();
				done();
			});
		})
	})
});
