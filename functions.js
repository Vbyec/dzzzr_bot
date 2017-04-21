/**
 * Created by vbyec on 24.11.15.
 */

Array.prototype.unique = function () {
	return this.filter(function (item, pos, self) {
		return self.indexOf(item) == pos;
	});
};

global.assertNotEmpty = function () {
	let message = arguments.length > 1 ? arguments[arguments.length - 1] : "Variable is empty";
	delete arguments[arguments.length - 1];
	for (let key in  arguments) {
		if (arguments.hasOwnProperty(key) && !arguments[key]) {
			throw new Error(message);
		}
	}
};