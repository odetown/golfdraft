import * as _ from 'lodash';
import * as access from '../server/access';
import config from '../server/config';
import constants from '../common/constants';
import {Reader, ReaderResult, UpdateGolfer} from './Types';
import {
  Golfer,
  GolferScore,
  ScoreOverrideDoc,
} from '../server/ServerTypes';

const DAYS = constants.NDAYS;
const MISSED_CUT = constants.MISSED_CUT;
const OVERRIDE_KEYS = ['golfer', 'day', 'scores'];

export function validate(result: ReaderResult): boolean {
  if (_.has(result, 'par') && !_.includes([70, 71, 72, 73], result.par)) {
    console.log("ERROR - Par invalid:" + result.par);
    return false;
  }

  return _.every(result.golfers, (g) => {
    const validScores = _.every(g.scores, (s) => {
      return _.isFinite(s) || s === MISSED_CUT;
    });
    let inv = false;

    if (g.golfer === "-") {
      console.log("ERROR - Invalid golfer name");
      inv = true;
    } else if (g.scores.length !== DAYS) {
      console.log("ERROR - Invalid golfer scores length");
      inv = true;
    } else if (!validScores) {
      console.log("ERROR - Invalid golfer scores");
      inv = true;
    } else if (!_.includes(_.range(DAYS + 1), g.day)) {
      console.log("ERROR - Invalid golfer day");
      inv = true;
    }

    if (inv) {
      console.log(JSON.stringify(g));
    }
    return !inv;
  });
}

export function mergeOverrides(scores: GolferScore[], scoreOverrides: ScoreOverrideDoc[]): GolferScore[] {
  const overridesByGolfer = _.chain(scoreOverrides)
    .map((o) => {
      return _.chain(o)

        // Remove all empty values from scoreOverrides
        .omitBy(_.isNull)

        // Whitelist the values we can take
        .pick(OVERRIDE_KEYS)
        .value();
    })
    .keyBy((o) => o.golfer.toString())
    .value();

  const newScores = _.map(scores, (s) => {
    const override = overridesByGolfer[s.golfer.toString()];
    if (override) {
      return _.extend({}, s, override);
    }
    return s;
  });

  return newScores;
}

export function run(reader: Reader, url: string): Promise<boolean> {
  return reader.run(url).then(function (rawTourney) {
    // Quick assertion of data
    if (!rawTourney || !validate(rawTourney)) {
      return false;
    }

    // Ensure tourney/par
    const update = { pgatourUrl: url, par: rawTourney.par };
    const mainPromise = access.updateTourney(update)

      .then(() => {
        // Ensure golfers
        const golfers = _.map(rawTourney.golfers, (g) => {
          return { name: g.golfer } as Golfer;
        });
        return access.ensureGolfers(golfers);
      })

      .then(function () {
        return Promise.all([
          access.getGolfers(),
          access.getScoreOverrides()
        ]);
      })

      .then((results) => {
        const gs = results[0] as Golfer[];
        const scoreOverrides = results[1] as ScoreOverrideDoc[];

        // Build scores with golfer id
        const golfersByName = _.keyBy(gs, "name");
        const scores = _.map(rawTourney.golfers, (g) => {
          const golfer = golfersByName[g.golfer]._id;
          return {
            golfer: golfer,
            day: g.day,
            thru: g.thru,
            scores: g.scores
          } as GolferScore;
        });

        // Merge in overrides
        console.log("scores BEFORE overrides: " + JSON.stringify(scores));
        const finalScores = mergeOverrides(scores, scoreOverrides);
        console.log("");
        console.log("scores AFTER overrides: " + JSON.stringify(scores));
        console.log("");
        if (!finalScores.length) {
          throw new Error("wtf. no scores.");
        }

        // Save
        return access.updateScores(finalScores);
      })

      .then(function () {
        console.log("HOORAY! - scores updated");
        return true;
      })

      .catch(function (e) {
        console.log(e);
        return false;
      });

    return mainPromise;
  });
}
