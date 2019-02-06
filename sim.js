'use strict';

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const colors = require('colors/safe');
const pkmn = require('pkmn');
const psim = require('ps-sim');

//const BattleStreams = require('../Pokemon-Showdown/sim/battle-stream');
//const Streams = require('../Pokemon-Showdown/lib/streams');
//const TeamValidator = require('../Pokemon-Showdown/sim/team-validator');
const BattleStreams = psim.BattleStreams;
const Streams = psim.Streams;
const TeamValidator = psim.TeamValidator;

const RandomPlayerAI = require('./random-ai');
const Parser = require('./parser');
const Battle = require('./battle');

const FORMAT = 'gen7uber';

const home = os.homedir();
function untildify(s) {
  return home ? s.replace(/^~(?=$|\/|\\)/, home) : s;
}

const validator = TeamValidator(FORMAT);
function importTeamFile(f) {
  const team = pkmn.Team.import(
      fs.readFileSync(path.resolve(__dirname, untildify(f)), "utf8"));
  const result = validator.validateTeam(team.team);
  if (result) {
    console.error(result.join('\n'));
    process.exit(1);
  }
  return team.pack();
}

const spec = {
  formatid: FORMAT
};
const p1spec = {
  name: "Player",
  team: importTeamFile(process.argv[2])
};
const p2spec = {
  name: "Bot",
  team: importTeamFile(process.argv[3])
};

const scriptP1 = [];
const scriptP2 = [];
if (process.argv[4]) {
  const turns = fs.readFileSync(
          path.resolve(__dirname, untildify(process.argv[4])), "utf8").split('\n');
  for (const turn of turns) {
    const script = turn.startsWith('p1') ? scriptP1 : scriptP2;
    if (turn) script.push(turn.slice(3));
  }
}

const streams = BattleStreams.getPlayerStreams(
    new BattleStreams.BattleStream());
const p2 = new RandomPlayerAI(streams.p2, scriptP2);

const stdin = new Streams.ReadStream(process.stdin);
const stdout = new Streams.WriteStream(process.stdout);

streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);

const state = {};
state.parser = new Parser();
state.battle = new Battle();

(async () => {
  let chunk;
  while ((chunk = await stdin.read())) {
    chunk = chunk.trim();
    switch (chunk[0]) {
      case "!":
        streams.p1.write("move " + chunk.substring(1).trim());
        write("\n");
        break;
      case "#":
        streams.p1.write("switch " + chunk.substring(1).trim());
        write("\n");
        break;
      case "?":
        displayState(true, true);
        break;
      case "%":
        streams.p1.write('%DEBUG');
        write("\n");
        break;
      default:
        if (chunk.startsWith("move ") || chunk.startsWith("switch ")) {
          streams.p1.write(chunk);
          write("\n");
        }
    }
  }
})();

(async () => {
  let chunk;
  while ((chunk = await streams.p1.read())) {
    if (chunk.startsWith('|error|')) {
      error("\n" + chunk.substring(7) + "\n\n");
    } else {
      if (!chunk.startsWith('|request|')) {
        debug(chunk);
        write(state.parser.parse(chunk));
        updateBattle(state.battle, chunk);
      } else {
        state.request = JSON.parse(chunk.substring(9));
        //debug(JSON.stringify(state.request, null, 2));
      }

      if (chunk.startsWith('|player|') || chunk.startsWith('|\n')) {
        if (state.request.forceSwitch) write('\n');
        displayState(state.request.forceSwitch);
      }

      if (scriptP1.length && !chunk.startsWith('|player|')) streams.p1.write(scriptP1.shift());
    }
  }
})();

////////////////////// DISPLAY ////////////////////////////

function error(s) {
  stdout.write(colors.red(s));
}
function write(s) {
  stdout.write(colors.green(s));
}
function debug(s) {
  stdout.write(colors.grey(s) + '\n\n');
}

function findInTrackedMove(move, trackedMoves) {
  for (const pair of trackedMoves) {
    if (move.name === pair[0]) {
      return pair[1];
    }
  }
  return 0;
}

function getTrackedMon(mon, allMoves) {
  const currentHP = mon.hp;
  const maxHP = mon.maxhp;
  const percentHP = Math.round((currentHP / maxHP) * 100);

  const status = mon.status ? mon.status.toUpperCase() + ' ' : '';

  const moves = [];
  if (allMoves) {
    for (const move of allMoves) {
      const m = pkmn.Moves.get(move);
      const usedPP = findInTrackedMove(m, mon.moveTrack);

      if (usedPP > 0) {
        moves.push(`${m.name} (${m.pp - usedPP}/${m.pp})`);
      } else {
        moves.push(`${m.name}`);
      }
    }
  } else {
    for (const trackedMove of mon.moveTrack) {
      const m = pkmn.Moves.get(trackedMove[0]);
      moves.push(`${m.name} (${m.pp - trackedMove[1]}/${m.pp})`);
    }
  }

  while (moves.length < 4) {
    moves.push("???");
  }

  return {
    "species": mon.species,
    "status": status,
    "currentHP": currentHP,
    "maxHP": maxHP,
    "percentHP": percentHP,
    "moves": moves
  }
}

function getUntrackedMon(mon) {
  const species = mon.details.split(",")[0];
  const sp = mon.condition.split(" ");

  const health = sp[0].split("/");
  const currentHP = +health[0];
  const maxHP = +health[1];
  const percentHP = Math.round((currentHP / maxHP) * 100);

  const status = sp[1] ? sp[1].toUpperCase() + ' ' : '';

  const moves = [];
  for (const move of mon.moves) {
    const m = pkmn.Moves.get(move);
    moves.push(`${m.name}`);
  }

  return {
    "species": species,
    "status": status,
    "currentHP": currentHP,
    "maxHP": maxHP,
    "percentHP": percentHP,
    "moves": moves
  }
}

function displayActive(m1, m2) {
  const pad = 30;
  write(`${m1.species}: ${m1.percentHP}% ${m1.status}(${m1.currentHP}/${m1.maxHP})`.padEnd(pad));
  write(` ${m2.species}: ${m2.percentHP}% ${m2.status}(${m2.currentHP}/${m2.maxHP})\n`);
  for (let i = 0; i < 4; i++) {
    write(`  - ${m1.moves[i]}`.padEnd(pad))
        write(`  - ${m2.moves[i]}\n`);
  }
}

function displayShort(m) {
  if (m) {
    write(`${m.species}: ${m.percentHP}% ${m.status}(${m.currentHP}/${m.maxHP}) ${m.moves.join('/')}\n`);
  } else {
    write("???\n");
  }
}

function displayState(full, both) {
  let m, m1, m2;
  const team1 = [];
  const team2 = [];

  for (const mon of state.request.side.pokemon) {
    const tracked = state.battle.getPokemon(mon.ident);
    if (tracked) {
      m = getTrackedMon(tracked, mon.moves);
      if (tracked.isActive()) {
        m1 = m;
      }
    } else {
      m = getUntrackedMon(mon);
    }
    team1.push(m);
  }

  for (let i = 0; i < state.battle.p2.totalPokemon; i++) {
    const tracked = state.battle.p2.pokemon[i];
    if (tracked) {
      m = getTrackedMon(tracked);
      if (tracked.isActive()) {
        m2 = m;
      }
    } else {
      m = null;
    }
    team2.push(m);
  }

  if (full) {
    for (const m of team1) {
      displayShort(m);
    }
    if (both) {
      write("---\n");
      for (const m of team2) {
        displayShort(m);
      }
    }
    write("\n");
  } else {
    if (m1 && m2) {
      displayActive(m1, m2);
      write("\n");
    }
  }
}

function updateBattle(battle, chunk) {
  for (var line of chunk.split('\n')) {
    battle.add(line);
    battle.fastForwardTo(-1);
  }
}
