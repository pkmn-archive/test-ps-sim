const fs = require('fs');
const path = require('path');

const psc = path.resolve(__dirname, '../Pokemon-Showdown-Client');

window = global;
{
  let exports = global;
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-text-parser.js')));
  eval('' + fs.readFileSync(path.join(psc, 'data/text.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-scene-stub.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-dex.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle-dex-data.js')));
  eval('' + fs.readFileSync(path.join(psc, 'js/battle.js')));
}

module.exports = Battle;
