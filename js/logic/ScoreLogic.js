'use strict';

var _ = require('underscore');

var utils = require('../utils');

function getGolfersByPlayer(draftPicks) {
  return _.chain(draftPicks)
    .groupBy(function (pick) { return pick.player; })
    .map(function (picks, playerId) {
      return [playerId, _.map(picks, function (pick) {
        return pick.golfer;
      })];
    })
    .object()
    .value();
}

function playerScore(playerGolfers, scores, player) {
  // TODO - Define this somewhere
  var ndays = 4;

  var scoresByGolfer = _.chain(playerGolfers)
    .map(function (g) {
      return _.extend({}, scores[g], {
        total: _.reduce(scores[g].scores, function (n, s) { return n + s; }, 0)
      });
    })
    .indexBy("golfer")
    .value();

  var scoresByDay = _.map(_.range(ndays), function (day) {
    var dayScores = _.chain(playerGolfers)
      .map(function (g) { return scores[g]; })
      .sortBy(function (s) { return s.scores[day]; })
      .value();
    var usedScores = _.first(dayScores, 2);

    return {
      day: day,
      allScores: dayScores,
      usedScores: usedScores,
      total: _.reduce(usedScores, function (n, s) {
          return n + s.scores[day];
        }, 0)
    };
  });

  return {
    player: player,
    scoresByDay: scoresByDay,
    scoresByGolfer: scoresByGolfer,
    total: _.reduce(scoresByDay, function (n, s) { return n + s.total; }, 0)
  };
}

var ScoreLogic = {

  calcPlayerScores: function (draftPicks, scores) {
    var golfersByPlayer = getGolfersByPlayer(draftPicks);

    var playerScores = _.chain(golfersByPlayer)
      .pairs()
      .map(function (pg) {
        var p = pg[0];
        var g = pg[1];
        return playerScore(g, scores, p);
      })
      .indexBy("player")
      .value();

    return playerScores;
  }

};


module.exports = ScoreLogic;