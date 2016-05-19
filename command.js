var Command = function (regexp, need_admin, need_registered, callback, bot, description) {
	this.regexp = regexp;
	this.need_admin = need_admin;
	this.need_registered = need_registered;
	this.callback = callback;
	this.bot = bot;
	this.description = description;
	return this;
};

Command.prototype = {
	registerInLog: function () {
		this.bot.logger.info("Triggered " + this.regexp + " command");
		return this;
	},
	checkAdmin: function (username) {
		assertNotEmpty(!(this.need_admin && this.bot.admin_user.indexOf(username) == -1), "Недостаточно прав");
		return this;
	},
	checkRegisteredChat: function (chat_id) {
		assertNotEmpty(!(this.need_registered && this.bot.registered_chat_ids.indexOf(chat_id) == -1), "Не зарегистрированный чат.");
		return this;
	}
};

module.exports = Command;