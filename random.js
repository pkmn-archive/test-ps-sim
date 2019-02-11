'use strict';

const { performance } = require('perf_hooks');

const colors = require('colors/safe');

const BattleStreams = require('../Pokemon-Showdown/sim/battle-stream');
const Timer = require('../Pokemon-Showdown/sim/time');
const Dex = require('../Pokemon-Showdown/sim/dex');
const RandomPlayerAI = require('./random-ai');
const psv = require('PSV');

function randomElem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const NUM_GAMES = Number(process.argv[2]) || 100;
const LOGS = process.argv[3] == 'true';
const SEQUENTIAL = process.argv[4] == 'true';

const FORMATS = [
  'gen7randombattle', //'gen7randomdoublesbattle',
  'gen7battlefactory', 'gen6randombattle', 'gen6battlefactory',
  'gen5randombattle', 'gen4randombattle', 'gen3randombattle',
  'gen2randombattle', 'gen1randombattle' ];

async function runGame(format, timer) {
  let t = timer.time('prepare');
  const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream({timer}));

  const spec = {
    formatid: format,
  };
  const p1spec = {
    name: "Bot 1",
    team: Dex.packTeam(Dex.generateTeam(format)),
  };
  const p2spec = {
    name: "Bot 2",
    team: Dex.packTeam(Dex.generateTeam(format)),
  };

  const p1 = new RandomPlayerAI(streams.p1);
  const p2 = new RandomPlayerAI(streams.p2);

  t();
  streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);

  const parser = new psv.Parser();

  let chunk;
  while ((chunk = await streams.omniscient.read())) {
    if (!LOGS) continue;

    var output = '';
    for (var line of chunk.split('\n')) {
      output += (parser.extractMessage(line) || '');
    }
    output = output.replace(/\[(.*)\]/g, (m, g) => colors.italic(g))
      .replace(/\*\*(.*)\*\*/g, (m, g) => colors.bold(g))
      .replace(/==.*==/g, (m) => colors.bold(m))
    console.log(output);
  }

  return 1;
}

if (!SEQUENTIAL) {
  (async () => {
    for (let format of FORMATS) {
      const begin = performance.now();
      const timers = [];
      const games = [];

      for (let i = 0; i < NUM_GAMES; i++) {
        const timer = new Timer();
        const game = runGame(format, timer);
        games.push(game);
        timers.push(timer);
      }

      console.log('hi');
      const foo = await Promise.all(games);

      console.log(`${format}: ${((performance.now() - begin)*1000).toFixed(2)}`);
      Timer.dump(timers);
    }
  })();
} else {
  (async () => {
    for (let format of FORMATS) {
      const begin = performance.now();
      const timers = [];

      console.log('bye');
      for (let i = 0; i < NUM_GAMES; i++) {
        const timer = new Timer();
        const game = await runGame(format, timer);
        timers.push(timer);
        console.log(timers);
      }
      console.log(format);

      console.log(`${format}: ${((performance.now() - begin)*1000).toFixed(2)}`);
      Timer.dump(timers);
    }
  })();
}
