import {World} from './world.js';
import {RNG} from '../core/rng.js';
import '../systems/civilization-unlock.js';
self.onmessage=e=>{const seed=(e.data?.seed??1)>>>0;try{const w=new World(new RNG(seed),seed,null,(stage,value)=>self.postMessage({type:'progress',stage,value})),data=w.exportGenerated(),buffers=['tiles','biomes','waterKind','elevation','moisture','temperature','slope','flow'].map(k=>data[k].buffer);self.postMessage({type:'done',data},buffers)}catch(error){self.postMessage({type:'error',message:error?.message||String(error)})}};
