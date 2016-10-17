/**
 * Created by vbyec on 24.11.15.
 */

Array.prototype.unique = function () {
	return this.filter(function (item, pos, self) {
		return self.indexOf(item) == pos;
	});
};

global.assertNotEmpty = function () {
	var message = arguments.length > 1 ? arguments[arguments.length - 1] : "Variable is empty";
	delete arguments[arguments.length - 1];
	for (var key in  arguments) {
		if (arguments.hasOwnProperty(key) && !arguments[key]) {
			throw new Error(message);
		}
	}
};

String.prototype.toObjectId = function() {
	var ObjectId = (require('mongoose').Types.ObjectId);
	return new ObjectId(this.toString());
};