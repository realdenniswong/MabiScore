const fs = require('node:fs');
const path = require('node:path');
const {parseMidi} = require('./load-app.cjs');
const M = require('../mobile-converter.js');
const p = parseMidi(fs.readFileSync(process.argv[2]));
const out = path.resolve(process.argv[3]);
fs.mkdirSync(out, {recursive:true});
const source = s => p.tracks.filter(t=>t.midiSource===s).flatMap(t=>t.notes)
  .map(n=>({...n,start:n.rawStart,duration:n.rawDuration}))
  .sort((a,b)=>a.start-b.start||b.pitch-a.pitch);
// Source-specific editorial arrangement: keep the right-hand tune separate
// from the left-hand arpeggios; lower overlapping right-hand tones go to harmony.
function select(notes, high, protectHeld=false) {
  const selected=[], unused=[];
  for(let i=0;i<notes.length;) {
    let j=i+1;
    while(j<notes.length && Math.abs(notes[j].start-notes[i].start)<1e-7)j++;
    const chord=notes.slice(i,j).sort((a,b)=>high?b.pitch-a.pitch:a.pitch-b.pitch);
    const n={...chord[0]}, prev=selected.at(-1);
    if(protectHeld && prev && prev.start+prev.duration>n.start+1 && n.pitch<prev.pitch) unused.push(...chord);
    else {
      if(prev && prev.start+prev.duration>n.start)prev.duration=n.start-prev.start;
      selected.push(n);unused.push(...chord.slice(1));
    }
    i=j;
  }
  return {selected,unused};
}
const upper=select(source(1),true,true);
const middle=select(upper.unused.sort((a,b)=>a.start-b.start||b.pitch-a.pitch),true);
const lower=select(source(2),false);
const end=Math.max(...p.tracks.map(t=>t.endTick));
const tracks=[upper.selected,middle.selected,lower.selected].map((notes,i)=>({
  id:`gpt-${i}`,name:['Upper piano tune','Inner piano harmony','Left-hand arpeggios'][i],
  sourceRole:['melody','harmony','bass'][i],instrument:'Piano',volume:12,muted:false,
  color:['#ee6a5b','#4f78c8','#7b61c9'][i],endTick:end,tempoEvents:p.tempoEvents,notes
}));
const app=M.arrange(p.tracks,p.tempo,p.tempoEvents).tracks;
const results={};
for(const [name,ts] of [['app',app],['gpt',tracks]]) {
  fs.writeFileSync(path.join(out,`${name}.mabiscore.json`),JSON.stringify({format:'mabiscore-project',version:1,tracks:ts,activeTrackId:ts[0].id,tempo:p.tempo,name:`Autumn Tale — ${name}`,snap:4,noteDuration:16,timingResolution:64},null,2));
  for(const fit of [false,true]) {
    const key=`${name}-${fit?'2400':'full'}`;
    const r=M.convert(ts,p.tempo,{fitLimit:fit,compatibility:false});
    if(!r.validation.ok)throw Error(JSON.stringify(r.validation));
    // A protected melody can legitimately remain over limit; keep it in the
    // comparison and show the field length instead of discarding the export.
    fs.writeFileSync(path.join(out,`${key}.mml`),r.mml+'\n');
    r.parts.forEach((part,i)=>fs.writeFileSync(path.join(out,`${key}-field-${i+1}.txt`),part+'\n'));
    results[key]={counts:r.counts,fields:r.fields,removed:r.fitting.reduce((s,f)=>s+f.removed,0),notes:r.parsed.map(t=>t.notes.length),duration:r.duration,validation:r.validation,parts:r.parts,playback:r.parsed.map(t=>t.notes.map(n=>({pitch:n.pitch,start:n.start/48*60/p.tempo,duration:n.duration/48*60/p.tempo,velocity:n.velocity})))};
  }
}
fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(results,null,2));
const data=JSON.stringify(results).replace(/</g,'\\u003c');
fs.writeFileSync(path.join(out,'compare.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autumn Tale · A/B comparison</title><style>body{font:16px system-ui;background:#f5f2eb;color:#242b32;max-width:1100px;margin:40px auto;padding:20px}h1{font-size:36px}main{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{background:white;padding:24px;border-radius:16px}button,select{font:inherit;padding:10px;margin:4px;border-radius:8px}textarea{width:100%;height:110px;box-sizing:border-box;font:12px monospace}label{display:block;margin-top:18px}small{line-height:1.6} @media(max-width:700px){main{grid-template-columns:1fr}}</style><h1>Autumn Tale</h1><p>App arrangement vs. GPT-directed arrangement · 96 BPM · original pitches</p><p>The GPT arrangement separates the upper piano tune from the left-hand arpeggios. Both use the app’s MML encoder. Preview uses a simple synthesized tone, not the game’s piano.</p><select id="mode"><option value="full">Full arrangement — no limit fitting</option><option value="2400">Fit each field to 2,400 characters</option></select><button id="stop">Stop</button><p id="status">Choose a version to audition.</p><main id="cards"></main><script>const data=${data};let ctx,voices=[],timer;function stop(){voices.forEach(n=>{try{n.stop()}catch{}});voices=[];clearTimeout(timer)}async function play(key){stop();ctx??=new AudioContext();await ctx.resume();const start=ctx.currentTime+.1;data[key].playback.flat().forEach(n=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.value=440*2**((n.pitch-69)/12);const at=start+n.start,end=at+n.duration;g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(n.velocity/127*.1,at+.006);g.gain.exponentialRampToValueAtTime(.0001,Math.max(at+.012,end));o.connect(g).connect(ctx.destination);o.start(at);o.stop(end+.03);voices.push(o)});document.querySelector('#status').textContent='Playing '+key+' — includes original opening silence';timer=setTimeout(()=>document.querySelector('#status').textContent='Finished',data[key].duration*1000+200)}function render(){stop();document.querySelector('#cards').innerHTML=['app','gpt'].map(name=>{const key=name+'-'+document.querySelector('#mode').value,r=data[key];return '<article><h2>'+ (name==='app'?'App automatic selection':'GPT-directed selection')+'</h2><button data-key="'+key+'" onclick="play(this.dataset.key)">Play from start</button><p>'+r.notes.reduce((a,b)=>a+b,0)+' exported notes · '+r.removed+' removed by limit fitting</p>'+r.parts.map((p,i)=>'<label>'+r.fields[i]+' · '+p.length+' characters'+(p.length>2400?' — over limit':'')+'</label><textarea readonly>'+p+'</textarea>').join('')+'</article>'}).join('')}document.querySelector('#mode').onchange=render;document.querySelector('#stop').onclick=()=>{stop();document.querySelector('#status').textContent='Stopped'};render();</script></html>`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(results).map(([k,{parts,playback,...r}])=>[k,r])),null,2));
