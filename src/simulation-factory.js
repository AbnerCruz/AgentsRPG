import {Simulation} from './simulation.js';

export function createNewSimulation(seed,generated=null){
 return new Simulation(seed,generated);
}
