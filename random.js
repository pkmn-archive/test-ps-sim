'use strict';

const colors = require('colors/safe');
const microtime = require('microtime')

const BattleStreams = require('../Pokemon-Showdown/sim/battle-stream');
const Dex = require('../Pokemon-Showdown/sim/dex');
const RandomPlayerAI = require('./random-ai');
const psv = require('PSV');

function randomElem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

const NUM_GAMES = Number(process.argv[2]) || 100;
const SILENT = process.argv[3] || true;
const PARALLEL = process.argv[4] || true;

const FORMATS = [
    'gen7randombattle', //'gen7randomdoublesbattle',
    'gen7battlefactory', 'gen6randombattle', 'gen6battlefactory',
    'gen5randombattle', 'gen4randombattle', 'gen3randombattle',
    'gen2randombattle', 'gen1randombattle' ];

async function runGame(format) {
    const begin = microtime.now();
    const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());

    const spec = {
      formatid: format,
    };
    const p1spec = { name: "Bot 1",
      team: Dex.packTeam(Dex.generateTeam(format)),
    };
    const p2spec = {
      name: "Bot 2",
      team: Dex.packTeam(Dex.generateTeam(format)),
    };

    const p1 = new RandomPlayerAI(streams.p1);
    const p2 = new RandomPlayerAI(streams.p2);

  streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);

    const parser = new psv.Parser();
    const start = microtime.now();

    let chunk;
    while ((chunk = await streams.omniscient.read())) {
      if (SILENT) continue;

      var output = '';
      for (var line of chunk.split('\n')) {
        output += (parser.extractMessage(line) || '');
      }
      output = output.replace(/\[(.*)\]/g, (m, g) => colors.italic(g))
          .replace(/\*\*(.*)\*\*/g, (m, g) => colors.bold(g))
          .replace(/==.*==/g, (m) => colors.bold(m))
      console.log(output);
    }

    let time = microtime.now() - begin;
    console.log([format, start-begin, time]);
    return time;
}

if (PARALLEL) {
  (async () => {
    const timesP = [];
    for (let i = 0; i < NUM_GAMES; i++) {
      const format = randomElem(FORMATS);
      const time = runGame(format);
      timesP.push(time);
    }
    const times = await Promise.all(timesP);
    console.log(`AVG: ${times.reduce((p, c) => p + c)/times.length}`);
  })();
} else {
  (async () => {
    const times = [];
    for (let i = 0; i < NUM_GAMES; i++) {
      const format = randomElem(FORMATS);
      const time = await runGame(format);
      times.push(time);
    }
    console.log(`AVG: ${times.reduce((p, c) => p + c)/times.length}`);
  })();
}
