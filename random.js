'use strict';

const { performance } = require('perf_hooks');

const colors = require('colors/safe');

const BattleStreams = require('../Pokemon-Showdown/sim/battle-stream');
const Timer = require('../Pokemon-Showdown/sim/timer');
const PRNG = require('../Pokemon-Showdown/sim/prng');
const Dex = require('../Pokemon-Showdown/sim/dex');
const RandomPlayerAI = require('./random-ai');
const psv = require('@pkmn.cc/view');

const NUM_GAMES = Number(process.argv[2]) || 100;
const LOGS = false;
const SILENT = false;
const SEQUENTIAL = true;
const RANDOM = false;

const FORMATS = [
  'gen7randombattle', //'gen7randomdoublesbattle',
  'gen7battlefactory', 'gen6randombattle', 'gen6battlefactory',
  'gen5randombattle', 'gen4randombattle', 'gen3randombattle',
  'gen2randombattle', 'gen1randombattle' ];

function generateTeam(format, timer) {
  let t = timer.time('generateTeam');
  let team = Dex.packTeam(Dex.generateTeam(format));
  return t(team);
}

async function runGame(format, timer) {
  let t = timer.time('prepare');
  let s = timer.time('createStream');
  const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream({timer}));
  s();

  const spec = {
    formatid: format,
  };

  const p1spec = {
    name: "Bot 1",
    team: generateTeam(format, timer),
  };
  const p2spec = {
    name: "Bot 2",
    team: generateTeam(format, timer),
  };

  let u = timer.time('randomAIs');
  const p1 = new RandomPlayerAI(streams.p1);
  const p2 = new RandomPlayerAI(streams.p2);
  u();

  t();
  streams.omniscient.write(`>start ${JSON.stringify(spec)}
    >player p1 ${JSON.stringify(p1spec)}
    >player p2 ${JSON.stringify(p2spec)}`);

  const parser = new psv.Parser();
  const start = performance.now();

  let chunk;
  while ((chunk = await streams.omniscient.read())) {
    if (SILENT || !LOGS) continue;

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

var prng = new PRNG();

var format_ = 0;
var numGames_ = 0;
function getNextFormat() {
  if (format_ > FORMATS.length) {
    return false;
  } else if (numGames_++ < NUM_GAMES) {
    return RANDOM ? prng.sample(FORMATS) : FORMATS[format_];
  } else if (RANDOM) {
    return false;
  } else {
    numGames_ = 1;
    format_++;
    return FORMATS[format_];
  }
}

(async () => {
  let begin = performance.now();
  let timers = [];
  let games = [];

  let format, lastFormat;
  while ((format = getNextFormat())) {
    if (!RANDOM && lastFormat && format != lastFormat) {
      await Promise.all(games);

      if (!SILENT) {
        console.log(
          `${lastFormat}: ${((performance.now() - begin)*1000).toFixed(2)}`);
        console.log('===');
        Timer.dump(timers);
      }

      timers = [];
      games = [];
      begin = performance.now();
    }

    const timer = new Timer();
    const game = runGame(format, timer);
    if (SEQUENTIAL) await game;

    games.push(game);
    timers.push(timer);
    lastFormat = format;
  }

  await Promise.all(games);

  if (!SILENT) {
    const prefix = RANDOM ? 'ALL' : lastFormat;
    console.log(`${prefix}: ${((performance.now() - begin)*1000).toFixed(2)}`);
    console.log('===');
    Timer.dump(timers);
  }
})();

