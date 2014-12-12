/** @jsx React.DOM */
"use strict";

var _ = require("lodash");
var AppSettingsStore = require('../stores/AppSettingsStore');
var ChatStore = require("../stores/ChatStore");
var ChatStore = require("../stores/ChatStore");
var DraftApp = require("./DraftApp.jsx");
var DraftStore = require("../stores/DraftStore");
var React = require("react");
var Router = require('react-router');
var ScoreStore = require('../stores/ScoreStore');
var TourneyApp = require("./TourneyApp.jsx");
var UserStore = require("../stores/UserStore");
var WhoIsYou = require("./WhoIsYou.jsx");

var RouteHandler = Router.RouteHandler;
var Navigation = Router.Navigation;
var RouterState = Router.State;

var RELEVANT_STORES = [
  AppSettingsStore,
  ChatStore,
  DraftStore,
  ScoreStore,
  UserStore
];

function getAppState() {
  return {
    currentUser: UserStore.getCurrentUser(),

    draft: {
      currentPick: DraftStore.getCurrentPick(),
      draftPicks: DraftStore.getDraftPicks()
    },

    scores: ScoreStore.getScores(),
    lastScoresUpdate: ScoreStore.getLastUpdated(),

    playSounds: AppSettingsStore.getPlaySounds(),

    chatMessages: ChatStore.getMessages()
  };
}

function shouldTransition(currRoute, newRoute) {
  return (
    currRoute !== newRoute && (
      currRoute === 'whoisyou' || newRoute === 'whoisyou'
    )
  );
}

/**
 Returns route that should app should be in based on state
 */
function getTransitionRoute(state) {
  state = state || getAppState();
  if (!state.currentUser) {
    return 'whoisyou';
  } else if (state.draft.currentPick) {
    return 'draft';
  } else {
    return 'tourney';
  }
}

function createWillTransitionTo(currRoute) {
  return function (transition) {
    var newRoute = getTransitionRoute();
    if (shouldTransition(currRoute, newRoute)) {
      transition.redirect(newRoute);
    }
  };
}

var WhoIsYouWrapper = React.createClass({

  statics: {
    willTransitionTo: createWillTransitionTo('whoisyou')
  },

  render: function () {
    return (
      <WhoIsYou />
    );
  }

});

var DraftWrapper = React.createClass({

  statics: {
    willTransitionTo: createWillTransitionTo('draft')
  },

  render: function () {
    var props = this.props;
    return (
      <DraftApp
        playSounds={props.playSounds}
        currentUser={props.currentUser}
        currentPick={props.draft.currentPick}
        draftPicks={props.draft.draftPicks}
        chatMessages={props.chatMessages}
      />
    );
  }

});

var TourneyWrapper = React.createClass({

  statics: {
    willTransitionTo: createWillTransitionTo('tourney')
  },

  render: function () {
    var props = this.props;
    return (
      <TourneyApp
        currentUser={props.currentUser}
        scores={props.scores}
        draft={props.draft}
        lastScoresUpdate={props.lastScoresUpdate}
        chatMessages={props.chatMessages}
      />
    );
  }

});

var AppNode = React.createClass({
  mixins: [Navigation, RouterState],

  getInitialState: function () {
    return getAppState();
  },

  componentWillUpdate: function (nextProps, nextState) {
    var currRoute = _.last(this.getRoutes()).name;
    var newRoute = getTransitionRoute();
    if (shouldTransition(currRoute, newRoute)) {
      this.transitionTo(newRoute);
    }
  },

  componentDidMount: function () {
    _.each(RELEVANT_STORES, function (S) {
      S.addChangeListener(this._onChange);
    }, this);
  },

  componentWillUnmount: function () {
    _.each(RELEVANT_STORES, function (S) {
      S.removeChangeListener(this._onChange);
    }, this);
  },

  render: function () {
    return (<RouteHandler {...this.state} />);
  },

  _onChange: function () {
    this.setState(getAppState());
  }

});

module.exports = {
  AppNode: AppNode,
  WhoIsYouWrapper: WhoIsYouWrapper,
  DraftWrapper: DraftWrapper,
  TourneyWrapper: TourneyWrapper
};
