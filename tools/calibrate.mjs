import {writeFile} from 'node:fs/promises';
import {DEFAULT_CALIBRATION_SEEDS,runBatch,runHeadless} from '../src/calibration/headless.js';

const raw=process.argv.slice(2),args={},balance={};for(const x of raw){const [k,v='true']=x.replace(/^--/,'').split('=');if(k==='set'){for(const pair of v.split(',')){const [name,value]=pair.split(':');if(name)balance[name]=+value}}else args[k]=v}
const days=+(args.days||30),sampleEveryDays=+(args.sample||10),out=args.out||'',seedArg=args.seed,overrides=Object.keys(balance).length?balance:null;
let result;if(seedArg!=null)result=runHeadless({seed:+seedArg,days,sampleEveryDays,balance:overrides});else{const count=+(args.seeds||10),seeds=DEFAULT_CALIBRATION_SEEDS.slice(0,count);result=runBatch({seeds,days,sampleEveryDays,balance:overrides})}
const text=JSON.stringify(result,null,2);if(out)await writeFile(out,text);console.log(text);
