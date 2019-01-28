var BattleTextStream = require('ps-sim').BattleTextStream;
var Streams = require('../../Pokemon-Showdown/lib/streams');
var stdin = new Streams.ReadStream(process.stdin);
var stdout = new Streams.WriteStream(process.stdout);

var battleStream = new BattleTextStream();
stdin.pipeTo(battleStream);
battleStream.pipeTo(stdout);
