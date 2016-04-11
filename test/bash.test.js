/**
 * Created by vbyec on 01.12.15.
 */
var BashOrg = require("../bash");

describe('BashOrg', function () {
	before(function () {
		// Stuff to do before the tests, like imports, what not
	});

	describe('#getRandom()', function () {
		it('should return bash quote', function (done) {
			BashOrg.getRandom(function (msg) {
				msg.should.be.String();
				done();
			});
		});
	});
});
