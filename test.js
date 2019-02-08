'use strict';

function delay() {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, 10);
  });
}

async function read() {
  if (Math.random() > 0.1) {
    let d = await delay();
    return 1;
  } else {
    return null;
  }
}

async function runGame() {
  let chunk;
  let loops = 0;
  while ((chunk = await read())) {
    loops += chunk;
  }
  let time = Math.random() * 100;
  console.log(time, loops);
  return time;
}

(async () => {
  const times = [];
  for (let i = 0; i < 100; i++) {
    const time = await runGame();
    times.push(time);
  }
  console.log(`AVG: ${times.reduce((p, c) => p + c)/times.length}`);
})();
