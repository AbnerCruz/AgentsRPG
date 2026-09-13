import {DAY_TICKS} from './constants.js';
export function dayOf(tick){return Math.floor(tick/DAY_TICKS)+1}
export function dayFraction(tick){return(tick%DAY_TICKS)/DAY_TICKS}
export function season(tick){const d=(dayOf(tick)-1)%120;if(d<30)return'primavera';if(d<60)return'verão';if(d<90)return'outono';return'inverno'}
export function nightBounds(tick){const s=season(tick);return s==='inverno'?[.72,.25]:s==='verão'?[.82,.15]:[.78,.18]}
export function isNight(tick){const f=dayFraction(tick),[start,end]=nightBounds(tick);return f>=start||f<end}
export function isDusk(tick){const f=dayFraction(tick),[start]=nightBounds(tick);return f>=start&&f<start+.02}
export function isDawn(tick){const f=dayFraction(tick),[,end]=nightBounds(tick);return f>=end&&f<end+.02}
export function dayPhase(tick){const f=dayFraction(tick);if(f<.16)return'madrugada';if(f<.30)return'manhã';if(f<.58)return'tarde';if(f<.76)return'entardecer';return'noite'}
export function ambientTemperature(tick){const f=dayFraction(tick),s=season(tick);const seasonal=s==='inverno'?-9:s==='outono'?1:s==='verão'?10:5;const daily=Math.sin((f-.25)*Math.PI*2)*5;return 13+seasonal+daily}
