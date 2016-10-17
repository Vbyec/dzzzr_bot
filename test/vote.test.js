var should = require('should'),
    Vote = require('../vote'),
    UsersInChatClass = require('../usersInChat'),
    configuration = {},
    usersInChat = {},
    TestTeam = require('./TestTeam'),
    test_team = new TestTeam(),
    current_vote = {},
    mongoose = require('mongoose');

describe('Vote Class', function () {
    before(function (done) {
        test_team.getConfiguration().then(function (a) {
            configuration = a;
            let db_connection = mongoose.createConnection('mongodb://localhost/Dzzzr_' + configuration.bot_name)
            current_vote = new Vote({}, "", db_connection);
            usersInChat = new UsersInChatClass(db_connection);
            done();
        })
    });

    describe('#Get users from this chat, that not voted yet ', function () {
        it('should be array of users', function () {
            return current_vote
                .getUnvotedUsers(23225855)
                .then(function (unvoted_users) {
                    unvoted_users.should.be.an.instanceOf(Array).and.deepEqual(['User','@Vbyec2']);
                })
        });
    });
});
