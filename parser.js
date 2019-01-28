const fs = require('fs');
const path = require('path');

const psc = path.resolve(__dirname, '../../Pokemon-Showdown-Client');

window = global;
{
  let exports = global;
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-scene-stub.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-dex.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-dex-data.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle.js')));
  eval('' + fs.readFileSync(path.join(psc, 'data/text.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-text-parser.js')));
}

class Parser {
  constructor() {
    this.battle = new Battle();
    this.battleTextParser = new BattleTextParser();
  }

  parse(chunk) {
    var output = '';
    for (var line of chunk.split('\n')) {
      output += (this.battleTextParser.extractMessage(line) || '');
      this.battle.add(line);
      this.battle.fastForwardTo(-1);
    }
    return output;
  }
}

module.exports = Parser;
