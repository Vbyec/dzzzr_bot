var BotClass = require('./bot'),
	ProxyFactory = require('./proxy_factory')(),
	fs = require('fs');

ProxyFactory.init().then(function () {
	fs.readdir('team_config/', function (error, files) {
		files.forEach(function (file) {
			if (file.match(/.*.json$/)) {
				BotClass('team_config/' + file, ProxyFactory);
			}
		});
	});
});

