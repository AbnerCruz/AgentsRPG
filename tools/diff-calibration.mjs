import {readFile} from 'node:fs/promises';
import {compareBatches} from '../src/calibration/headless.js';
const [beforePath,afterPath]=process.argv.slice(2);if(!beforePath||!afterPath)throw new Error('Uso: node tools/diff-calibration.mjs before.json after.json');const before=JSON.parse(await readFile(beforePath,'utf8')),after=JSON.parse(await readFile(afterPath,'utf8'));console.log(JSON.stringify(compareBatches(before,after),null,2));
