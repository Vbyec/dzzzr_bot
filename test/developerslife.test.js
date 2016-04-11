/**
 * Created by vbyec on 02.12.15.
 */
var DevelopersLife = require("../developers_life");

describe('DevelopersLife', function () {
	before(function () {
		// Stuff to do before the tests, like imports, what not
	});

	describe('#getRandom()', function () {
		it('should return object title and file stream', function (done) {
			DevelopersLife.getRandom(function (title, stream) {
				title.should.be.String();
				done();
			});
		});
	});
});
