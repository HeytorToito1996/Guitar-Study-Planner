'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {validateRequest,normalizePlan,mergeSchedule,generatePlan}=require('../ai/planner-service');
const empty=()=>Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day=>[day,[]]));
const request={goal:'Melhorar palhetada alternada',minutes:60,days:['monday']};
const plan={days:[{day:'monday',blocks:[{topic:'Técnica',subtopic:'Palhetada alternada',duration:25,restTime:5,notes:'Começar a 80 BPM.'}]}]};
test('valida dias, tempo e objetivo',()=>{
 assert.deepEqual(validateRequest(request),request);
 assert.throws(()=>validateRequest({...request,minutes:5}),/10 e 240/);
 assert.throws(()=>validateRequest({...request,days:['monday','monday']}),/dias válidos/);
});
test('normaliza plano com IDs e formato compatível',()=>{
 const result=normalizePlan(request,plan);
 assert.equal(result.monday[0].topic,'Técnica');
 assert.ok(result.monday[0].id);
 assert.deepEqual(result.tuesday,[]);
});
test('rejeita duração acima do limite',()=>{
 assert.throws(()=>normalizePlan(request,{days:[{day:'monday',blocks:[{...plan.days[0].blocks[0],duration:61}]}]}),/excedeu/);
});
test('aplicar substitui somente os dias gerados e preserva outros dias',()=>{
 const old=empty();old.tuesday=[{id:'old',topic:'Harmonia',duration:20,restTime:0}];
 const result=mergeSchedule(old,normalizePlan(request,plan),'replace');
 assert.equal(result.tuesday[0].id,'old');assert.equal(result.monday.length,1);
 assert.equal(old.monday.length,0);
});
test('aplicar em modo append mantém exercícios anteriores',()=>{
 const old=empty();old.monday=[{id:'old',topic:'Técnica',duration:10,restTime:0}];
 const result=mergeSchedule(old,normalizePlan(request,plan),'append');
 assert.deepEqual(result.monday.map(b=>b.order),[0,1]);
});
test('API recebe requisição autenticada e retorno é validado',async()=>{
 let endpoint,options;
 const fetchImpl=async (url,opts)=>{endpoint=url;options=opts;return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(plan)}}]})};};
 const result=await generatePlan(request,{apiKey:'test-key',fetchImpl});
 assert.equal(endpoint,'https://api.openai.com/v1/chat/completions');
 assert.equal(options.headers.Authorization,'Bearer test-key');
 assert.equal(result.monday.length,1);
});
