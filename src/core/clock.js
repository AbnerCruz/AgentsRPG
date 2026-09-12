import {DAY_TICKS} from './constants.js';
export function dayOf(tick){return Math.floor(tick/DAY_TICKS)+1}
export function dayPhase(tick){const f=(tick%DAY_TICKS)/DAY_TICKS;if(f<.18)return'madrugada';if(f<.32)return'manhã';if(f<.58)return'tarde';if(f<.78)return'entardecer';return'noite'}
export function season(tick){const d=dayOf(tick)%120;if(d<30)return'primavera';if(d<60)return'verão';if(d<90)return'outono';return'inverno'}
export function isNight(tick){const f=(tick%DAY_TICKS)/DAY_TICKS;return f<.18||f>.78}
