import {writeFile} from 'node:fs/promises';
import {DEFAULT_CALIBRATION_SEEDS,runBatch,runHeadless} from '../src/calibration/headless.js';

const args=Object.fromEntries(process.argv.slice(2).map(x=>{const [k,v='true']=x.replace(/^--/,'').split('=');return[k,v]}));
const days=+(args.days||30),sampleEveryDays=+(args.sample||10),out=args.out||'',seedArg=args.seed;
let result;
if(seedArg!=null){result=runHeadless({seed:+seedArg,days,sampleEveryDays})}else{const count=+(args.seeds||10),seeds=DEFAULT_CALIBRATION_SEEDS.slice(0,count);result=runBatch({seeds,days,sampleEveryDays})}
const text=JSON.stringify(result,null,2);if(out)await writeFile(out,text);console.log(text);
