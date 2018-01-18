'use strict';

import * as _ from 'lodash';
import AppActions from './actions/AppActions';
import DraftActions from './actions/DraftActions';
import DraftParser from './logic/DraftParser';
import ScoreActions from './actions/ScoreActions';
import SettingsActions from './actions/SettingsActions';
import UserActions from './actions/UserActions';

/** Hydrates the app with data stamped on initial page load
*/
function hydrate(seedData) {
  const draft = DraftParser.parseDraft(seedData.draft);

  AppActions.setUsers(seedData.users);
  AppActions.setGolfers(seedData.golfers);
  DraftActions.draftUpdate(draft);
  ScoreActions.scoreUpdate({
    scores: seedData.scores,
    lastUpdated: seedData.tourney.lastUpdated
  });
  SettingsActions.setAppState(seedData.appState);
  AppActions.setTourneyName(seedData.tourneyName);

  if (seedData.user) {
    UserActions.hydrateCurrentUser(seedData.user._id);
  }
}

export default _.once(() => {
  hydrate(window.golfDraftSeed);
});
