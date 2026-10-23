const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const M = require('../mobile-converter.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const helpers = html.slice(html.indexOf('let mobileExportResult = null;'), html.indexOf('function renderExport()'));

function harness() {
  const parsed = {tempo:120,tempoEvents:[],tracks:[80,48].map((pitch,i)=>({
    midiSource:i+1,midiChannel:0,midiProgram:0,name:i?'Left hand':'Upper <piano>',instrument:'Piano',endTick:512,
    notes:Array.from({length:32},(_,j)=>({id:`${i}-${j}`,pitch:pitch+j%3,start:j*16,duration:12.8,velocity:90})),
  }))};
  const arrangement = M.arrange(parsed.tracks,120);
  const controls = Object.fromEntries(['mobile-arrangement-options','mobile-melody-source','mobile-tidy-rhythm','mobile-arrangement-summary'].map(id=>['#'+id,{}]));
  const calls=[];
  const context=vm.createContext({
    state:{tracks:arrangement.tracks},initialSession:{parsed,arrangement,options:{melodySource:'',tidyRhythm:true},fingerprint:JSON.stringify(arrangement.tracks)},
    document:{querySelector:selector=>controls[selector]},elements:{exportConversionNote:{}},
    escapeHtml:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    arrangeMidiInThreeTracks:M.arrange,
    commitTracks:tracks=>{calls.push('history');context.state.tracks=tracks;},
    stopPlayback:()=>calls.push('stop'),clearNoteSelection(){},renderAll(){},renderExport(){},
    notify:message=>calls.push(message),
  });
  vm.runInContext(helpers+'\nmobileImportSession = initialSession;',context);
  return {context,controls,calls,parsed};
}

test('melody and rhythm controls rebuild from the original MIDI and record an undoable edit',()=>{
  const {context,controls,calls,parsed}=harness(),original=JSON.stringify(parsed);
  context.renderMobileArrangementOptions();
  assert.equal(controls['#mobile-melody-source'].disabled,false);
  assert.ok(controls['#mobile-melody-source'].innerHTML.includes('Upper &lt;piano&gt;'));
  controls['#mobile-melody-source'].value='2:0';
  controls['#mobile-tidy-rhythm'].checked=false;
  context.updateMobileArrangement();
  assert.equal(calls.filter(c=>c==='history').length,1);
  assert.ok(context.state.tracks[0].notes.every(n=>n.source==='2:0'&&n.duration===12.8));
  assert.equal(JSON.stringify(parsed),original);
  context.renderMobileArrangementOptions();
  assert.equal(controls['#mobile-melody-source'].value,'2:0');
  assert.equal(controls['#mobile-tidy-rhythm'].checked,false);
});

test('source controls cannot replace notes edited after the import',()=>{
  const {context,controls,calls}=harness();
  context.state.tracks[0].notes[0].pitch=70;
  context.renderMobileArrangementOptions();
  assert.equal(controls['#mobile-melody-source'].disabled,true);
  assert.equal(controls['#mobile-tidy-rhythm'].disabled,true);
  const before=JSON.stringify(context.state.tracks);
  context.updateMobileArrangement();
  assert.equal(JSON.stringify(context.state.tracks),before);
  assert.equal(calls.length,0);
});

test('an unavailable melody source leaves the score and settings unchanged',()=>{
  const {context,controls,calls}=harness();
  const before=JSON.stringify(context.state.tracks);
  controls['#mobile-melody-source'].value='missing';
  controls['#mobile-tidy-rhythm'].checked=false;
  context.updateMobileArrangement();
  assert.equal(JSON.stringify(context.state.tracks),before);
  assert.equal(controls['#mobile-melody-source'].value,'');
  assert.equal(controls['#mobile-tidy-rhythm'].checked,true);
  assert.equal(calls.length,1);
  assert.match(calls[0],/not available/);
});

test('the complete app script has valid syntax',()=>{
  for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
});
