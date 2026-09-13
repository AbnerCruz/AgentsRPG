import assert from 'node:assert/strict';
import {runHeadless,snapshotMetrics} from '../src/calibration/headless.js';
import {Simulation} from '../src/simulation.js';

const a=runHeadless({seed:42,ticks:160,sampleEveryDays:.05});
const b=runHeadless({seed:42,ticks:160,sampleEveryDays:.05});
assert.equal(a.final.population,b.final.population,'mesma seed deve preservar população');
assert.equal(a.final.techniquesDistinct,b.final.techniquesDistinct,'mesma seed deve preservar curva técnica');
assert.deepEqual(a.actionHistogram,b.actionHistogram,'mesma seed deve preservar histograma de ações');
assert.ok(Array.isArray(a.series)&&a.series.length>0,'runner deve produzir série temporal');
assert.ok(a.final.saveBytes>0,'runner deve medir tamanho do save');
assert.equal(typeof a.final.groups,'number');
assert.equal(typeof a.final.techDivergence,'number');
assert.equal(typeof a.final.meanTemperamentVariance,'number');
assert.equal(typeof a.final.travelCompletion,'number');
assert.equal(typeof a.final.diseaseIncidence,'number');
const sim=new Simulation(77);const snap=snapshotMetrics(sim);assert.equal(snap.population,100);assert.equal(snap.day,0);
console.log('OK Phase D instrumentation: séries, ações, grupos, genética, técnica, doença, save e determinismo');
