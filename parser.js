const fs = require('fs');
const path = require('path');

const psc = path.resolve(__dirname, '../Pokemon-Showdown-Client');

window = global;
{
  let exports = global;
  eval('' + fs.readFileSync(path.join(psc, 'data/text.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-text-parser.js')));
}

class Parser {
  constructor() {
    this.battleTextParser = new BattleTextParser();
  }

  parse(chunk) {
    var output = '';
    for (var line of chunk.split('\n')) {
      output += (this.battleTextParser.extractMessage(line) || '');
    }
    return output;
  }
}

module.exports = Parser;
