'use strict';

var _ = require('lodash');
var app = require('./expressApp');
var access = require('./access');

app.get('/chat/messages', function (req, res) {
  access.getChatMessages()
  .then(function (messages) {
    res.send(200, messages);
  })
  .catch(function (err) {
    res.send(500, err);
  });
});

app.post('/chat/messages', function (req, res) {
  var body = req.body;
  var user = req.session.user;

  if (!user) {
    res.send(401, 'Must be logged in to post');
    return;
  } else if (_.isEmpty(body.message)) {
    res.send(400, 'Empty message not accepted');
    return;
  }

  var message = {
    player: user.player,
    message: body.message
  };
  access.createChatMessage(message)
  .then(function () {
    res.send(201);
  })
  .catch(function (err) {
    res.send(500, err);
  });
});
