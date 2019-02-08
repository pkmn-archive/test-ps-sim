'use strict';

//const BattleStreams = require('ps-sim').BattleStreams;
const BattleStreams = require('../Pokemon-Showdown/sim/battle-stream');

/*********************************************************************
 * Helper functions
 *********************************************************************/

/**
 * @param {any[]} array
 */
function randomElem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/*********************************************************************
 * Define AI
 *********************************************************************/

const MEGA = 0.8;
const SWITCH = 0.3;

class RandomPlayerAI extends BattleStreams.BattlePlayer {
  constructor(stream, script = []) {
    super(stream);
    this.script = script;
    this.numFailures = 0;
  }

  receiveLine(line) {
    try {
      super.receiveLine(line);
      this.numFailures = 0;
    } catch (e) {
      this.numFailures++;
      if (this.numFailures < 10) {
        this.receiveRequest(this.lastRequest);
      }
    }
  }

  /**
   * @param {AnyObject} request
   */
  receiveRequest(request) {
    this.lastRequest = request;
    if (request.wait) {
      // wait request
      // do nothing
    } else if (this.script.length) {
      const choice = this.script.shift()[1];
      this.choose(choice);
    } else if (request.forceSwitch) {
      const pokemon = request.side.pokemon;
      let chosen = /** @type {number[]} */ ([]);
      const choices = request.forceSwitch.map((/** @type {AnyObject} */ mustSwitch) => {
        if (!mustSwitch) return `pass`;

        let canSwitch = [1, 2, 3, 4, 5, 6];
        canSwitch = canSwitch.filter(i => (
            // not active
              i > request.forceSwitch.length &&
              // not chosen for a simultaneous switch
              !chosen.includes(i) &&
              // not fainted
              !pokemon[i - 1].condition.endsWith(` fnt`)
              ));
        const target = randomElem(canSwitch);
        chosen.push(target);
        return `switch ${target}`;
      });

      this.choose(choices.join(`, `));
    } else if (request.active) {

      let canMegaEvo = true;
      // move request
      const chosen = /** @type {number[]} */ ([]);
      const choices = request.active.map((/** @type {AnyObject} */ pokemon, /** @type {number} */ i) => {
        if (request.side.pokemon[i].condition.endsWith(` fnt`)) return `pass`;

        canMegaEvo = canMegaEvo && pokemon.canMegaEvo;

        let canMove = [1, 2, 3, 4].slice(0, pokemon.moves.length);
        canMove = canMove.filter(i => (
            // not disabled
              !pokemon.moves[i - 1].disabled
              ));

        const moves = canMove.map(j => {
          // TODO: zMove?
          if (request.active.length > 1) {
            const target = pokemon.moves[j - 1].target;
            if (['normal', 'any'].includes(target)) {
              return `move ${j} ${1 + Math.floor(Math.random() * 2)}`;
            }
            if (['adjacentAlly'].includes(target)) {
              return `move ${j} ${2 - i + 1}`;
            }
          }
          return `move ${j}`;

        });

        const team = request.side.pokemon;

        let canSwitch = [1, 2, 3, 4, 5, 6];
        canSwitch = canSwitch.filter(i => (
            // not active
              !team[i - 1].active &&
              // not chosen for a simultaneous switch
              !chosen.includes(i) &&
              // not fainted
              !team[i - 1].condition.endsWith(` fnt`)
              ));
        // TODO: try choice, otherwise redo?
        const switches = (pokemon.trapped || pokemon.maybeTrapped) ? [] : canSwitch.map(target => target);

        if (Math.random() < SWITCH && switches.length) {
          let target = randomElem(switches);
          chosen.push(target);
          return `switch ${target}`;
        } else {
          let move = randomElem(moves);
          // TODO: For some reason Mega while selecting a target doesn't work?
          if (move.split(' ').length > 2) return move;
          if (Math.random() < MEGA && canMegaEvo) {
            canMegaEvo = false;
            return `${move} mega`;
          } else {
            return move;
          }
        }
      });
      this.choose(choices.join(`, `));
    } else {
      // team preview?
      this.choose(`default`);
    }
  }
}

module.exports = RandomPlayerAI;
