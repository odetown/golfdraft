import * as constants from '../../common/constants';
import {Golfer} from '../types/Types';

const UNKNOWN_WGR = constants.UNKNOWN_WGR;

export default class GolferLogic {

  static renderGolfer(g: Golfer): string {
    const wgrDisplay = g.wgr === UNKNOWN_WGR ? '' : ' (WGR: ' + g.wgr + ')';
    return g.name + wgrDisplay;
  }

};
