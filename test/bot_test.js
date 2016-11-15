var should = require('should'),
	BotClass = require('../bot'),
	bot = {},
	mongoose = require('mongoose'),
	Schema = mongoose.Schema,
	db_connection = mongoose.createConnection('mongodb://localhost/Global');
mongoose.Promise = global.Promise;

var test_username = 'TestUser' + Math.random().toFixed(2);

var TeamsSchema = new Schema({
	token: String,
	admin_user: [{id: Number, username: String}],
	registered_chat_ids: Array,
	bot_name: String,
	light: {
		pin: String
	},
	classic: {
		login: String,
		city: String,
		password: String,
		http_login: String,
		pin: String
	},
	mera: {
		login: String,
		password: String
	},
	log_path: {type: String, default: "/var/log/dzzzr_telegram"},
	engine: String
});

db_connection.model('Teams', TeamsSchema);
var TeamsInDB = db_connection.model('Teams');

describe('Bot Class', function () {
	before(function (done) {
		TeamsInDB.find().then(teams=> {
			bot = new BotClass(teams[0]);
			done();
		});
	});

	describe('Admin functional', function () {
		it('#Should add user to admin array without id', function () {
			return bot.addAdmin(test_username)
				.then(a=> {
					a.admin_user.should.be.an.instanceOf(Array);
					a.admin_user.findIndex(user=>user.username == test_username).should.be.above(0);
					should.equal(a.admin_user.find(user=>user.username == test_username).id, null);
				}
			);
		});

		it("#Should get array of admin user without id", function () {
			let admin_array = bot.getAdminWithoutId();
			admin_array.should.be.an.instanceOf(Array);
			admin_array.should.be.length(1);
			admin_array[0].username.should.be.equal(test_username)
		});

		it("#Should add id to admin user", function () {
			return bot.addAdminId(test_username, 1).then(a=>a.admin_user.find(user=>user.username == test_username).id.should.be.equal(1))
		});

		it("#Should remove user from admin list", function () {
			return bot.removeAdmin(test_username).then(a=> {
				a.admin_user.findIndex(user=>user.username == test_username).should.be.equal(-1);
			});
		});
	})
});
