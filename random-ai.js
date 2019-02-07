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
  constructor(stream, script) {
    super(stream);
    this.script = script;
  }
  /**
   * @param {AnyObject} request
   */
  receiveRequest(request) {
    if (request.wait) {
      // wait request
      // do nothing
    } else if (this.script.length) {
      this.choose(this.script.shift());
    } else if (request.forceSwitch) {
      // switch request
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
      // move request
      const choices = request.active.map((/** @type {AnyObject} */ pokemon, /** @type {number} */ i) => {
        if (request.side.pokemon[i].condition.endsWith(` fnt`)) return `pass`;

        let canMegaEvo = pokemon.canMegaEvo;

        let canMove = [1, 2, 3, 4].slice(0, pokemon.moves.length);
        canMove = canMove.filter(i => (
            // not disabled
              !pokemon.moves[i - 1].disabled
              ));
        // BUG: Not really all possible, because we should also chose possible
        // targets as well, but thats not important in singles.
        const moves = canMove.map(i => {
          // TODO: zMove?
          const targetable = request.active.length > 1 && ['normal', 'any'].includes(pokemon.moves[i - 1].target);
          const target = targetable ? ` ${1 + Math.floor(Math.random() * 2)}` : ``;
          return `move ${i}${target}`;
        });

        pokemon = request.side.pokemon;

        // BUG: Breaks in doubles because of simulataneous switch
        let canSwitch = [1, 2, 3, 4, 5, 6];
        canSwitch = canSwitch.filter(i => (
            // not active
              !pokemon[i - 1].active &&
              // not fainted
              !pokemon[i - 1].condition.endsWith(` fnt`)
              ));
        const switches = pokemon.trapped ? [] : canSwitch.map(target => `switch ${target}`);

        if (Math.random() < SWITCH && switches.length) {
          return randomElem(switches);
        } else {
          let move = randomElem(moves);
          // BUG: breaks in doubles where multiple could try to mega.
          return Math.random() < MEGA && canMegaEvo ? `${move} mega` : move;
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
