'use strict';

const colors = require('colors/safe');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// TODO use linked psim instead
const Dex = require('../Pokemon-Showdown/sim/dex');
const BattleStreams = require('../Pokemon-Showdown/sim/battle-stream');
const RandomPlayerAI = require('./random-ai');
const Streams = require('../Pokemon-Showdown/lib/streams');
const Parser = require('./parser');
const importTeam = require('./import');
var TeamValidator = require('../Pokemon-Showdown/sim/team-validator');

const home = os.homedir();
function untildify(s) {
  return home ? s.replace(/^~(?=$|\/|\\)/, home) : s;
}


var validator = TeamValidator("gen7uber");
function importTeamFile(f) {
  var team = Dex.fastUnpackTeam(importTeam(fs.readFileSync(path.resolve(__dirname, untildify(f)), "utf8")));
  var result = validator.validateTeam(team);
  if (result) {
    console.error(result.join('\n'));
    process.exit(1);
  }
  return Dex.packTeam(team);
}

const spec = {
	formatid: "gen7uber",
};
const p1spec = {
	name: "Player",
	team: importTeamFile(process.argv[2]),
};
const p2spec = {
	name: "Bot",
	team: (process.argv[3] ? importTeamFile(process.argv[3]) : Dex.generateTeam('gen7uber')),
};

const streams = BattleStreams.getPlayerStreams(new BattleStreams.BattleStream());
const p2 = new RandomPlayerAI(streams.p2);

var stdin = new Streams.ReadStream(process.stdin);
var stdout = new Streams.WriteStream(process.stdout);

function error(s) {
  stdout.write(colors.red(s));
}
function write(s) {
  stdout.write(colors.green(s));
}
function debug(s) {
  stdout.write(colors.grey(s) + '\n\n');
}

streams.omniscient.write(`>start ${JSON.stringify(spec)}
>player p1 ${JSON.stringify(p1spec)}
>player p2 ${JSON.stringify(p2spec)}`);

var state = {};
state.parser = new Parser();

function findInTrackedMove(move, trackedMoves) {
  for (var pair of trackedMoves) {
    if (move.name === pair[0]) {
      return pair[1];
    }
  }
  return 0;
}

function getTrackedMon(mon, allMoves) {
  var currentHP = mon.hp;
  var maxHP = mon.maxhp;
  var percentHP = Math.round((currentHP / maxHP) * 100);

  var status = mon.status ? mon.status.toUpperCase() + ' ' : '';

  var moves = [];
  if (allMoves) {
    for (var move of allMoves) {
      var m = Dex.getMove(move);
      var usedPP = findInTrackedMove(m, mon.moveTrack);

      if (usedPP > 0) {
        moves.push(`${m.name} (${m.pp - usedPP}/${m.pp})`);
      } else {
        moves.push(`${m.name}`);
      }
    }
  } else {
    for (var trackedMove of mon.moveTrack) {
      var m = Dex.getMove(trackedMove[0]);
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
  var species = mon.details.split(",")[0];
  var sp = mon.condition.split(" ");

  var health = sp[0].split("/");
  var currentHP = +health[0];
  var maxHP = +health[1];
  var percentHP = Math.round((currentHP / maxHP) * 100);

  var status = sp[1] ? sp[1].toUpperCase() + ' ' : '';

  var moves = [];
  for (var move of mon.moves) {
    var m = Dex.getMove(move);
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
  var pad = 30;
  write(`${m1.species}: ${m1.percentHP}% ${m1.status}(${m1.currentHP}/${m1.maxHP})`.padEnd(pad));
  write(` ${m2.species}: ${m2.percentHP}% ${m2.status}(${m2.currentHP}/${m2.maxHP})\n`);
  for (var i = 0; i < 4; i++) {
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

function displayState(full) {
  var m, m1, m2;
  var team1 = [];
  var team2 = [];

  for (var mon of state.request.side.pokemon) {
    var tracked = state.parser.battle.getPokemon(mon.ident);
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

  for (var i = 0; i < state.parser.battle.p2.totalPokemon; i++) {
    var tracked = state.parser.battle.p2.pokemon[i];
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
    for (var m of team1) {
      displayShort(m);
    }
    write("---\n");
    for (var m of team2) {
      displayShort(m);
    }
  } else {
    if (m1 && m2) {
      displayActive(m1, m2);
      write("\n");
    }
  }

}

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
        displayState(true);
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
      } else {
        state.request = JSON.parse(chunk.substring(9));
        debug(JSON.stringify(state.request, null, 2));
      }
      displayState(false);
    }
	}
})();
