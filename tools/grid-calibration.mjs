import {writeFile} from 'node:fs/promises';
import {DEFAULT_CALIBRATION_SEEDS,runBatch} from '../src/calibration/headless.js';

const raw=process.argv.slice(2),args={};for(const x of raw){const [k,v='true']=x.replace(/^--/,'').split('=');args[k]=v}
const key=args.key;if(!key)throw new Error('Use --key=parametro --values=a,b,c');const values=(args.values||'').split(',').filter(Boolean).map(Number);if(!values.length)throw new Error('Informe --values=a,b,c');const days=+(args.days||30),count=+(args.seeds||10),sampleEveryDays=+(args.sample||10),seeds=DEFAULT_CALIBRATION_SEEDS.slice(0,count),rows=[];for(const value of values){const batch=runBatch({seeds,days,sampleEveryDays,balance:{[key]:value}});rows.push({key,value,summary:batch.summary})}const result={key,values,days,seeds,rows};if(args.out)await writeFile(args.out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
