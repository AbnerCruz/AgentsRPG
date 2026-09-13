import {UI} from './ui.js';
import {stackSummary} from '../systems/task-planning.js';

if(!UI.prototype.__taskPlanningUI){
 const base=UI.prototype.inspect;
 UI.prototype.inspect=function(i,open=true){base.call(this,i,open);const body=document.querySelector('#panelBody');if(!body)return;body.querySelector('[data-task-stack]')?.remove();const stack=stackSummary(this.sim,i);const current=this.sim.npcs.intent[i];const section=document.createElement('section');section.className='section';section.dataset.taskStack='1';section.innerHTML=`<h3>Objetivo e pilha</h3><div class="memory"><b>Atual:</b> ${esc(current?.action||'nenhum')}<br><small>${current?`alvo ${fmt(current.targetX)}, ${fmt(current.targetY)}`:'sem tarefa ativa'}</small></div>${stack.length?stack.slice().reverse().map((x,k)=>`<div class="memory"><b>${k+1}. ${esc(x.action)}</b><br><small>suspenso: ${esc(x.reason)} · progresso ${Math.round((x.progress||0)*100)}%</small></div>`).join(''):'<span class="muted">Nada suspenso.</span>'}`;const exec=body.querySelector('.section:nth-of-type(4)');if(exec)exec.insertAdjacentElement('afterend',section);else body.prepend(section)};
 Object.defineProperty(UI.prototype,'__taskPlanningUI',{value:true});
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(v){return Number(v||0).toFixed(1)}
