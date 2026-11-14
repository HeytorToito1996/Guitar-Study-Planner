'use strict';
const $ = id => document.getElementById(id);
const names = {monday:'Segunda-feira',tuesday:'Terça-feira',wednesday:'Quarta-feira',thursday:'Quinta-feira',friday:'Sexta-feira',saturday:'Sábado',sunday:'Domingo'};
let proposal = null;
const status = (message, error=false) => { $('status').textContent=message; $('status').className=error?'error':'ok'; };
$('generate').addEventListener('click', async () => {
  $('generate').disabled=true; $('preview').hidden=true; proposal=null;
  status('Gerando cronograma com a OpenAI...');
  try {
    const request={goal:$('goal').value,minutes:Number($('minutes').value),
      days:[...document.querySelectorAll('#days input:checked')].map(el=>el.value)};
    proposal=await window.electronAPI.generateAiPlan(request);
    const target=$('plan'); target.replaceChildren();
    for (const [day,blocks] of Object.entries(proposal)) {
      if (!blocks.length) continue;
      const section=document.createElement('div');section.className='day';
      const heading=document.createElement('h3');heading.textContent=names[day];section.append(heading);
      for (const block of blocks) {
        const card=document.createElement('div');card.className='block';
        const title=document.createElement('strong');title.textContent=block.topic+' — '+block.subtopic;
        const meta=document.createElement('div');meta.className='small';meta.textContent=block.duration+' min de prática + '+block.restTime+' min de descanso';
        const notes=document.createElement('p');notes.textContent=block.notes;
        card.append(title,meta,notes);section.append(card);
      }
      target.append(section);
    }
    $('preview').hidden=false;
    status('Proposta pronta. Revise antes de aplicar.');
  } catch (error) { status(error.message || 'Falha ao gerar cronograma.',true); }
  finally { $('generate').disabled=false; }
});
$('apply').addEventListener('click',async()=>{
  if (!proposal) return;
  const mode=$('mode').value;
  if (!confirm(mode==='replace'?'Substituir os blocos dos dias gerados?':'Adicionar os exercícios aos dias existentes?')) return;
  $('apply').disabled=true;
  try {
    await window.electronAPI.applyAiPlan(mode);
    proposal=null; $('preview').hidden=true;
    status('Cronograma aplicado com sucesso! A janela principal será atualizada.');
  } catch(error) { status(error.message || 'Não foi possível aplicar o cronograma.',true); }
  finally { $('apply').disabled=false; }
});
$('discard').addEventListener('click',()=>{proposal=null;$('preview').hidden=true;status('Proposta descartada.');});
