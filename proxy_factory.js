
var request = require('request');
var Proxy = function () {
    this.list = [];
    this.logger={};
    this.init = function () {
        var proxy_this=this;
        return new Promise(function (resolve, reject) {
            request.get(
                {
                    url: "http://www.freeproxy-list.ru/api/proxy?accessibility=90&anonymity=false&country=RU&token=demo",
                }, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        proxy_this.list = body.split('\n');
                        console.log(proxy_this.list.length + ' proxies found');
                        resolve();
                    }else{
                        reject();
                    }
                }
            );
        });
    };
    this.get = function () {
        if (this.list.length > 0) {
            var proxy_string=this.list.shift();
            logger.info('set proxy to bot '+ proxy_string);
            return proxy_string;
        } else {
    throw  new Error('Proxy list is empty');
        }
    };

    this.setLogger= function (logger) {
        this.logger=logger;
    };
    return this;
};



module.exports = Proxy;