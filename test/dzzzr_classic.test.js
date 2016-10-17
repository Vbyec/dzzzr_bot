var Engine={},
    should = require('should'),
    TestTeam= require('./TestTeam');
var test_team=new TestTeam();


describe('Dozor classic', function () {
    before(done=>{test_team.getClassic().then(a=>{Engine=a;done()})});

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
    })
});
