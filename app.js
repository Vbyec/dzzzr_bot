var BotClass = require('./bot'),
    ProxyFactory = require('./proxy_factory')();
ProxyFactory.init().then(function () {
    var y_dzzzr_bot = BotClass('team_config/y_config.json', ProxyFactory);
        rail_dzzzr_bot = BotClass('team_config/rail_config.json', ProxyFactory),
        lnp_dzzzr_bot = BotClass('team_config/lnp_config.json', ProxyFactory);
});

