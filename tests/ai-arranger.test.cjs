const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../ai-arranger.js');
const M=require('../mobile-converter.js');
const tracks=[0,1].map(i=>({name:'Source '+i,midiSource:i,midiChannel:0,midiProgram:73,instrument:'Piano',endTick:512,notes:Array.from({length:32},(_,j)=>({id:`${i}-${j}`,pitch:65+i*12+j%3,start:j*16,duration:16,velocity:90}))}));
const summary=A.summarize(tracks,M.arrange(tracks).sources);
test('validates full coverage and rejects invented, duplicate or missing sources',()=>{
  assert.equal(summary.length,2);
  for(const phrases of [[],[{phrase:0,source:'0:0'},{phrase:0,source:'0:0'}],[{phrase:0,source:'9:9'},{phrase:1,source:'0:0'}]])assert.throws(()=>A.validate({phrases},summary));
});
test('AI handoffs select existing source notes without modifying input',()=>{
  const before=JSON.stringify(tracks);
  const melodyPlan=A.validate({phrases:[{phrase:0,source:'0:0'},{phrase:1,source:'1:0'}]},summary);
  const result=M.arrange(tracks,120,[],{melodyPlan});
  const melody=result.tracks.find(t=>t.sourceRole==='melody');
  assert.ok(melody.notes.some(n=>n.start>=256));
  assert.ok(melody.notes.every(n=>n.source===(n.start<256?'0:0':'1:0')));
  assert.equal(JSON.stringify(tracks),before);
  assert.equal(result.originalEndTick,512);
});
test('uses configured protocol and rejects HTTP failures without exposing provider body',async()=>{
  const config={...A.defaults,apiKey:'test-secret'};
  const result=await A.plan(config,summary,undefined,async(url,request)=>{
    const body=JSON.parse(request.body);
    assert.equal(body.store,false);assert.equal(body.stream,false);
    assert.equal(request.headers.Authorization,'Bearer test-secret');
    assert.ok(!request.body.includes('test-secret'));
    return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:JSON.stringify({phrases:[{phrase:0,source:'0:0'},{phrase:1,source:'1:0'}]})}]}]})};
  });
  assert.equal(result.length,2);
  await assert.rejects(A.plan(config,summary,undefined,async()=>({ok:false,status:401})),/HTTP 401/);
  await assert.rejects(A.plan({...config,endpoint:'http://example.com'},summary,undefined,()=>{}),/HTTPS/);
});
test('UI ignores an AI response if the score changed while awaiting it',async()=>{
  const app=require('./helpers/app.cjs')();
  try {
    const arrangement=M.arrange(tracks);
    app.setMobileSession({parsed:{tracks,tempo:120,tempoEvents:[]},options:{melodySource:'',tidyRhythm:true},arrangement,fingerprint:JSON.stringify(arrangement.tracks)});
    let resolve;
    app.window.AiArranger.plan=()=>new Promise(r=>resolve=r);
    app.click('#ai-analyze');
    app.state.tracks[0].notes[0].pitch++;
    resolve([{start:0,end:256,source:'0:0'},{start:256,end:512,source:'1:0'}]);
    await new Promise(r=>setImmediate(r));
    assert.match(app.document.querySelector('#ai-status').textContent,/Score or settings changed/);
    assert.equal(app.document.querySelector('#ai-analyze').disabled,false);
    assert.equal(app.getMobileSession().options.melodyPlan,undefined);
  } finally {app.close();}
});
test('UI applies a plan and allows returning to automatic arrangement',async()=>{
  const app=require('./helpers/app.cjs')();
  try {
    const arrangement=M.arrange(tracks);
    app.setMobileSession({parsed:{tracks,tempo:120,tempoEvents:[]},options:{melodySource:'',tidyRhythm:true},arrangement,fingerprint:JSON.stringify(arrangement.tracks)});
    app.window.AiArranger.plan=async()=>[{start:0,end:256,source:'0:0'},{start:256,end:512,source:'1:0'}];
    app.click('#ai-analyze');
    await new Promise(r=>setImmediate(r));
    assert.match(app.document.querySelector('#ai-status').textContent,/AI melody plan applied/);
    assert.equal(app.getMobileSession().options.melodyPlan.length,2);
    assert.ok(app.state.tracks.find(t=>t.sourceRole==='melody').notes.every(n=>n.source===(n.start<256?'0:0':'1:0')));
    app.click('#ai-reset');
    assert.equal(app.getMobileSession().options.melodyPlan,undefined);
    assert.match(app.document.querySelector('#ai-status').textContent,/Automatic arrangement restored/);
    assert.deepEqual(app.errors,[]);
  } finally {app.close();}
});

test('personal key starts empty, stays out of storage and clears explicitly or on leaving',()=>{
  const app=require('./helpers/app.cjs')();
  try {
    const input=app.document.querySelector('#ai-key');
    assert.equal(input.value,'');
    assert.equal(A.connection,undefined);
    const before=JSON.stringify(app.window.localStorage);
    input.value='personal-test-key';
    input.dispatchEvent(new app.window.Event('input',{bubbles:true}));
    assert.equal(JSON.stringify(app.window.localStorage),before);
    app.click('#ai-clear-key');
    assert.equal(input.value,'');
    input.value='personal-test-key';
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    assert.equal(input.value,'');
    assert.equal(JSON.stringify(app.window.localStorage),before);
  } finally {app.close();}
});
