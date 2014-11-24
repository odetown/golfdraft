/** @jsx React.DOM */
"use strict";

var React = require("react");
var ReactPropTypes = React.PropTypes;
var cx = require('react/lib/cx');
var _ = require("lodash");
var utils = require("../utils");

var PlayerStore = require('../stores/PlayerStore');
var GolferStore = require('../stores/GolferStore');

var PlayerDetails = React.createClass({

  propTypes: {
    player: ReactPropTypes.string.isRequired,
    playerScores: ReactPropTypes.object.isRequired
  },

  render: function () {
    var player = this.props.player;
    var playerScore = this.props.playerScores[player];
    var scoresByDay = playerScore.scoresByDay;

    var sortedScores = _.chain(this.props.playerScores)
      .pluck("total")
      .sortBy()
      .value();
    var playerRank = _.sortedIndex(sortedScores, playerScore.total);
    var isTied = sortedScores[playerRank + 1] === playerScore.total;

    var golferScores = _.sortBy(playerScore.scoresByGolfer, 'total');
    var trs = _.map(golferScores, function (gs) {
      return (
        <tr key={gs.golfer}>
          <td>{GolferStore.getGolfer(gs.golfer).name}</td>
          <td>{gs.total}</td>
          {_.map(gs.scores, function (s, i) {
            var missedCut = gs.missedCuts[i];
            var scoreUsed = _.some(scoresByDay[i].usedScores, { golfer: s.golfer });
            return (
              <td
                className={cx({
                  'missed-cut': missedCut,
                  'score-used': scoreUsed
                })}
                key={i}
              >
                {s} <sup className="missed-cut-text">MC</sup>
              </td>
            );
          })}
        </tr>
      );
    });

    var tieText = isTied ? "(Tie)" : "";
    return (
      <section>
        <h2>
          {PlayerStore.getPlayer(player).name} ({playerScore.total})
          <small> {utils.getOrdinal(playerRank + 1)} place {tieText}</small>
        </h2>
        <table className='table player-details-table'>
          <thead>
            <tr>
              <th>Golfer</th>
              <th>Score</th>
              <th>Day 1</th>
              <th>Day 2</th>
              <th>Day 3</th>
              <th>Day 4</th>
            </tr>
          </thead>
          <tbody>{trs}</tbody>
        </table>
      </section>
    );
  }

});

module.exports = PlayerDetails;
