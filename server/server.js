'use strict';

const _ = require('lodash');
const access = require('./access');
const app = require('./expressApp');
const bodyParser = require('body-parser');
const chatBot = require('./chatBot');
const compression = require('compression');
const config = require('./config');
const exphbs  = require('express-handlebars');
const express = require('express');
const io = require('./socketIO');
const LocalStrategy = require('passport-local').Strategy;
const logfmt = require("logfmt");
const mongoose = require('mongoose');
const passport = require('passport');
const Promise = require('promise');
const redis = require("./redis");
const RedisStore = require('connect-redis')(session);
const session = require('express-session');
const tourneyConfigReader = require('./tourneyConfigReader');
const UserAccess = require('./userAccess');
const utils = require('../common/utils');

const port = Number(process.env.PORT || 3000);

const MAX_AGE = 1000 * 60 * 60 * 24 * 365;
const ENSURE_AUTO_PICK_DELAY_MILLIS = 500;
const AUTO_PICK_STARTUP_DELAY = 1000 * 5;

const NOT_AN_ERROR = {};

const redisPubSubClient = redis.pubSubClient;

mongoose.connect(config.mongo_url);

// Temp temp - remove this when we have multiple nodes
UserAccess.refresh();

// Request logging
app.use(logfmt.requestLogger());

// Session handling
const sessionMiddleware = session({
  store: new RedisStore({ url: config.redis_url }),
  secret: config.session_secret,
  maxAge: MAX_AGE,
  logErrors: true,
  resave: false,
  cookie: { secure: true }
});
app.use(sessionMiddleware);
io.use(function(socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});

// Gzip
app.use(compression());

// Authentication
passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username }, function(err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.validPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));

// Handlebars
app.engine('handlebars', exphbs({
  helpers: {
    or: function (a, b) { return a || b; }
  }
}));
app.set('view engine', 'handlebars');

// Static routes
if (!config.prod) {
  mongoose.set('debug', true);
  app.set('views', './distd/views/');
  app.use('/dist', express.static(__dirname + '/../distd'));
} else {
  app.set('views', './dist/views/');
  app.use('/dist', express.static(__dirname + '/../dist', {
    maxAge: MAX_AGE
  }));
}
app.use('/assets', express.static(__dirname + '/../assets', {
  maxAge: MAX_AGE
}));

// Parsing
app.use(bodyParser());

// Log session state on every request
function logSessionState(req, res, next) {
  try {
    const session = req.session;
    console.log(
      'ip=%s user=%j isAdmin=%s',
      req.connection.remoteAddress,
      session.user,
      !!session.isAdmin
    );
  } catch (e) {
    console.error(e);
  }
  next();
}
app.use(logSessionState);

const tourneyCfg = tourneyConfigReader.loadConfig();

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {

  redisPubSubClient.on("message", function (channel, message) {
    // Scores updated, alert clients
    console.log("redis message: channel " + channel + ": " + message);
    access.getScores().then(function (scores) {
      io.sockets.emit('change:scores', {
        data: {
          scores: scores,
          lastUpdated: new Date()
        },
        evType: 'change:scores',
        action: 'scores:periodic_update'
      });
    });
  });

  // Include chat routes
  require('./chatRoutes');

  // Include socket server
  require('./socketServer');

  // Support legacy urls
  app.get(/\/tourney\/?/, function (req, res) {
    res.redirect('/');
  });

  app.get(['/', '/draft', '/admin', '/whoisyou'], function (req, res) {
    Promise.all([
        access.getGolfers(),
        access.getPlayers(),
        access.getDraft(),
        access.getScores(),
        access.getTourney(),
        access.getAppState()
      ])
      .then(function (results) {
        res.render('index', {
          golfers: JSON.stringify(results[0]),
          players: JSON.stringify(results[1]),
          draft: JSON.stringify(results[2]),
          scores: JSON.stringify(results[3]),
          tourney: JSON.stringify(results[4]),
          appState: JSON.stringify(results[5]),
          user: JSON.stringify(req.session.user),
          tourneyName: tourneyCfg.name,
          prod: config.prod,
          cdnUrl: config.cdn_url
        });
      })
      .catch(function (err) {
        console.log(err);
        res.status(500).send(err);
      });
  });

  app.post('/login', function (req, res) {
    const user = req.body;
    req.session.user = user;
    req.session.save(function (err) {
      if (err) {
        res.status(500).send(err);
        return;
      }
      UserAccess.onUserLogin(req.session);
      res.sendStatus(200);
    });
  });

  app.post('/logout', function (req, res) {
    req.session.user = null;

    req.session.save(function (err) {
      if (err) {
        res.status(500).send(err);
        return;
      }
      UserAccess.onUserLogout(req.session);
      res.sendStatus(200);
    });
  });

  app.get('/draft/pickList', function (req, res) {
    const user = req.session.user;

    if (!user || !user.id) {
      res.status(401).send('Must be logged in to get draft pickList');
      return;
    }

    access.getPickList(user.id)
      .then(function (pickList) {
        res.status(200).send({
          playerId: user.id,
          pickList: pickList
        });
      })
      .catch(function (err) {
        console.log(err);
        res.status(500).send(err);
      });
  });

  app.put('/draft/pickList', function (req, res) {
    const body = req.body;
    const user = req.session.user;

    if (!user || !user.id) {
      res.status(401).send('Must be logged in to set draft pickList');
      return;
    }

    let promise = null;
    if (body.pickList) {
      promise = access.updatePickList(user.id, body.pickList)
        .then(function () {
          res.status(200).send({ playerId: user.id, pickList: body.pickList });
        })
        .catch(function (err) {
          console.log(err);
          res.status(500).send(err);
          throw err;
        });
      
    } else {
      promise = access.updatePickListFromNames(user.id, body.pickListNames)
        .then(function (result) {
          if (result.completed) {
            res.status(200).send({ playerId: user.id, pickList: result.pickList });
          } else {
            res.status(300).send({ playerId: user.id, suggestions: result.suggestions });
          }
        })
        .catch(function (err) {
          console.log(err);
          res.status(500).send(err);
          throw err;
        });
    }

    return promise;
  });

  app.put('/draft/autoPick', function (req, res) {
    const body = req.body;
    const user = req.session.user;

    if (!user || !user.id) {
      res.status(401).send('Must be logged in to make a pick');
      return;
    }

    const autoPick = !!body.autoPick;
    return onAppStateUpdate(req, res, access.updateAutoPick(user.id, autoPick));
  });

  app.post('/draft/picks', function (req, res) {
    const body = req.body;
    const user = req.session.user;

    if (!user || !user.id) {
      res.status(401).send('Must be logged in to make a pick');
      return;
    }

    const pick = {
      pickNumber: body.pickNumber,
      player: body.player,
      golfer: body.golfer
    };

    return handlePick({
      req,
      res,
      makePick: function () {
        return access.makePick(pick);
      },
      broadcastPickMessage: function (spec) {
        return chatBot.broadcastPickMessage(user, spec.pick, spec.draft);
      }
    });
  });

  app.post('/draft/pickPickListGolfer', function (req, res) {
    const body = req.body;
    const user = req.session.user;

    if (!user || !user.id) {
      res.status(401).send('Must be logged in to make a pick');
      return;
    }

    const {player, pickNumber} = body;
    return handlePick({
      req,
      res,
      makePick: function () {
        return access.makePickListPick(player, pickNumber);
      },
      broadcastPickMessage: function (spec) {
        return chatBot.broadcastProxyPickListPickMessage(user, spec.pick, spec.draft);
      }
    });
  });

  // ADMIN FUNCTIONALITY

  app.post('/admin/login', function (req, res) {
    if (req.body.password !== config.admin_password) {
      res.status(401).send('Bad password');
      return;
    }
    req.session.isAdmin = true;
    req.session.save(function (err) {
      if (err) {
        console.log(err);
        res.status(500).send(err);
        return;
      }
      res.sendStatus(200);
    });
  });

  app.put('/admin/autoPickPlayers', function (req, res) {
    if (!req.session.isAdmin) {
      res.status(401).send('Only can admin can pause the draft');
      return;
    }

    const playerId = req.body.playerId;
    const autoPick = !!req.body.autoPick;
    return onAppStateUpdate(req, res, access.updateAutoPick(playerId, autoPick));
  });

  app.put('/admin/pause', function (req, res) {
    if (!req.session.isAdmin) {
      res.status(401).send('Only can admin can pause the draft');
      return;
    }

    const isDraftPaused = !!req.body.isPaused;
    return onAppStateUpdate(req, res, access.updateAppState({ isDraftPaused: isDraftPaused }));
  });

  app.put('/admin/allowClock', function (req, res) {
    if (!req.session.isAdmin) {
      res.status(401).send('Only can admin can toggle clock');
      return;
    }

    const allowClock = !!req.body.allowClock;
    return onAppStateUpdate(req, res, access.updateAppState({ allowClock: allowClock }));
  });

  app.put('/admin/draftHasStarted', function (req, res) {
    if (!req.session.isAdmin) {
      res.status(401).send('Only can admin can toggle draft status');
      return;
    }

    const draftHasStarted = !!req.body.draftHasStarted;
    return onAppStateUpdate(req, res, access.updateAppState({ draftHasStarted: draftHasStarted }));
  });

  app.delete('/admin/lastpick', function (req, res) {
    if (!req.session.isAdmin) {
      res.status(401).send('Only can admin can undo picks');
      return;
    }

    return handlePick({
      force: true,

      req,
      res,
      makePick: function () {
        return access.undoLastPick();
      },
      broadcastPickMessage: function (spec) {
        return chatBot.broadcastUndoPickMessage(spec.pick, spec.draft);
      }
    });
  });

  app.put('/admin/forceRefresh', function (req, res) {
    if (!req.session.isAdmin) {
      res.status(401).send('Only can admin can force refreshes');
      return;
    }

    io.sockets.emit('action:forcerefresh');
    res.sendStatus(200);
  });

  require('./expressServer').listen(port);
  redisPubSubClient.subscribe("scores:update");

  // Give some time to settle, and then start ensuring we run auto picks
  setTimeout(ensureNextAutoPick, AUTO_PICK_STARTUP_DELAY);

  console.log('I am fully running now!');
});

// HELPERS

function isDraftOver(draft) {
  const nextPickNumber = draft.picks.length;
  const nextPick = draft.pickOrder[nextPickNumber];
  return !nextPick;
}

function ensureNextAutoPick() {
  setTimeout(function () {
    console.info('ensureNextAutoPick: running');
    return ensureDraftIsRunning()
      .then(function (spec) {
        const {appState, draft} = spec;
        const {autoPickPlayers} = appState;
        const nextPickNumber = draft.picks.length;
        const nextPick = draft.pickOrder[nextPickNumber];
        const nextPickPlayer = nextPick.player;

        if (utils.containsObjectId(autoPickPlayers, nextPickPlayer)) {
          console.info('ensureNextAutoPick: making next pick!');
          autoPick(nextPickPlayer, nextPickNumber);
        } else {
          console.info('ensureNextAutoPick: not auto-picking; player not in auto-pick list. ' +
            'player: ' + nextPickPlayer + ', autoPickPlayers: ' + autoPickPlayers);
        }
      })
      .catch(function (err) {
        if (err === NOT_AN_ERROR) {
          console.info('ensureNextAutoPick: not auto-picking; draft is not running.');
          throw err;
        }
        console.log(err);
      });
  }, ENSURE_AUTO_PICK_DELAY_MILLIS);
}

function autoPick(playerId, pickNumber) {
  console.info('autoPick: Auto-picking for ' + playerId + ', ' + pickNumber);
  let isPickListPick = null;
  return handlePick({
    makePick: function () {
      return access.makePickListPick(playerId, pickNumber)
        .then(function (result) {
          isPickListPick = result.isPickListPick;
          return result;
        });
    },
    broadcastPickMessage: function (spec) {
      return chatBot.broadcastAutoPickMessage(spec.pick, spec.draft, isPickListPick);
    }
  });
}

function ensureDraftIsRunning(req, res) {
  return Promise.all([
      access.getAppState(),
      access.getDraft()
    ])
    .then(function (results) {
      const [appState, draft] = results;
      if (isDraftOver(draft) || appState.isDraftPaused || !appState.draftHasStarted) {
        if (res) {
          res.status(400).status('Draft is not active');
        }
        throw NOT_AN_ERROR;
      }

      return { appState, draft };
    });
}

function handlePick(spec) {
  const {res, makePick, broadcastPickMessage, force} = spec;
  let pick = null;

  const promise = !force ? ensureDraftIsRunning() : Promise.resolve();
  return promise
    .then(makePick)
    .catch(function (err) {
      if (err === NOT_AN_ERROR) throw err;

      if (res) {
        if (err.message.indexOf('invalid pick') !== -1) {
          res.status(400).send(err);
        } else {
          res.status(500).send(err);
        }
      }

      throw err;
    })
    .then(function (_pick) {
      pick = _pick;
      if (res) {
        res.sendStatus(200);
      }
      return access.getDraft();
    })
    .then(function (draft) {
      updateClients(draft);
      return broadcastPickMessage({ pick, draft });
    })
    .then(ensureNextAutoPick)
    .catch(function (err) {
      if (err === NOT_AN_ERROR) throw err;
      console.log(err);
    });
}

function onAppStateUpdate(req, res, promise) {
  return promise
    .catch(function (err) {
      console.log(err);
      res.status(500).send(err);
      throw NOT_AN_ERROR; // skip next steps
    })
    .then(function () {
      res.sendStatus(200);

      // App state will affect whether or not we should be running auto picks
      // SET AND FORGET
      ensureNextAutoPick();

      return access.getAppState();
    })
    .then(function (appState) {
      io.sockets.emit('change:appstate', {
        data: { appState: appState }
      });
    })
    .catch(function (err) {
      if (err === NOT_AN_ERROR) throw err;
      console.log(err);
    });
}

function updateClients(draft) {
  io.sockets.emit('change:draft', {
    data: draft,
    evType: 'change:draft',
    action: 'draft:pick'
  });
}
