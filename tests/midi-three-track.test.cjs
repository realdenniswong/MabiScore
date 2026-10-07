const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const M = require('../mobile-converter.js');
const Iterator = require('mml-iterator');
const {parseMidi} = require('../scripts/load-app.cjs');
let id=0;
const source=(notes,program=0,channel=0)=>({midiSource:++id,midiChannel:channel,midiProgram:program,name:`Source ${id}`,instrument:'Piano',notes:notes.map(([pitch,start,duration,velocity=90])=>({id:`n-${++id}`,pitch,start,duration,velocity}))});
const voices=(notes,events=[])=>['melody','harmony','bass'].map((role,i)=>({sourceRole:role,volume:10,notes:(notes[i]||[]).map(([pitch,start,duration])=>({pitch,start,duration,velocity:90})),endTick:Math.max(0,...notes.flat().map(n=>n[1]+n[2])),tempoEvents:events}));
function independent(result) {
  result.parts.forEach((part,i)=>{
    // This independent dialect uses ^length for a tie; no pitch/timing calculations are shared.
    let defaultLength='4';
    const adapted=part.replace(/l(\d+)|&[a-g][+-]?(\d*)(\.?)/g, (token,length,tiedLength,dot)=>{
      if(length){defaultLength=length;return token;}
      return '^'+(tiedLength||defaultLength)+(dot||'');
    });
    const events=[...new Iterator(adapted)], notes=events.filter(e=>e.type==='note');
    const expected=result.parsed[i];
    const time=M.timeline(expected.tempoEvents.map(e=>({...e,tick:e.tick/3})),result.tempo);
    assert.equal(notes.length,expected.notes.length);
    notes.forEach((n,j)=>{
      const q=expected.notes[j];assert.equal(n.noteNumber,q.pitch);
      assert.ok(Math.abs(n.time-time(q.start/3))<1e-7);
      assert.ok(Math.abs(n.duration-(time((q.start+q.duration)/3)-time(q.start/3)))<1e-7);
    });
    assert.ok(Math.abs(events.at(-1).time-time(expected.endTick/3))<1e-7);
  });
}
function verify(result){assert.ok(result.validation.ok);assert.equal(result.parts.length,3);independent(result);for(const t of result.tracks){assert.equal(t.endTick,result.tracks[0].endTick);t.notes.forEach((n,i)=>{assert.ok(n.duration>0);if(i)assert.ok(t.notes[i-1].start+t.notes[i-1].duration<=n.start);});}for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)for(const n of result.tracks[i].notes)for(const p of result.tracks[j].notes)assert.ok(n.pitch!==p.pitch||n.start>=p.start+p.duration||p.start>=n.start+n.duration);}

test('melody follows a handoff between instruments while bass remains below it',()=>{
 const a=M.arrange([source([[72,0,8],[74,8,8]],73),source([[76,16,8],[77,24,8]],56),source([[36,0,16],[38,16,16]],33)]);
 assert.deepEqual(a.tracks[0].notes.map(n=>n.pitch),[72,74,76,77]);assert.equal(new Set(a.tracks[0].notes.map(n=>n.source)).size,2);
 assert.deepEqual(a.tracks[2].notes.map(n=>n.pitch),[36,38]);verify(M.convert(a.tracks));
});
test('repeated attacks survive overlapping sustain without inventing legato across rests',()=>{
 const a=M.arrange([source([[72,0,18],[72,16,8],[74,32,8]],73)]);
 assert.equal(a.tracks[0].notes.length,3);assert.equal(a.tracks[0].notes[0].duration,16);assert.equal(a.tracks[0].notes[1].duration,8);
 const r=M.convert(a.tracks,180,{compatibility:false});verify(r);assert.equal(r.parsed[2].notes.length,3);assert.ok(r.parsed[2].rests.length);
});
test('piano is default and chord reduction retains a foundation, not the highest three notes',()=>{
 const a=M.arrange([source([[36,0,16],[60,0,16],[64,0,16],[72,0,16]])]);
 assert.equal(a.tracks.length,3);assert.ok(a.tracks.every(t=>t.instrument==='Piano'));assert.ok(a.tracks[2].notes.some(n=>n.pitch===36));verify(M.convert(a.tracks));
});
test('single voice still exports three initialized synchronized fields',()=>{
 const a=M.arrange([source([[60,16,16]])]);const r=M.convert(a.tracks);verify(r);
 assert.equal(r.parts.filter(p=>M.parsePart(p).notes.length).length,1);r.parts.forEach(p=>assert.match(p,/^t\d+o4v\d+l\d+/));assert.match(r.fields[2],/Harmony 2.*melody/);
});
test('overlapping identical pitches are resolved in favor of melody even with different onsets',()=>{
 const r=M.convert(voices([[[60,8,16]],[[60,0,16],[64,24,8]],[[60,12,16]]]),180);verify(r);
 assert.equal(r.tracks[2].notes[0].duration,48);assert.equal(r.tracks[0].notes.length,0);assert.ok(r.warnings.some(w=>w.includes('same-pitch')));
});
test('accompaniment offset is absolute, ends are compensated and never accumulate drift',()=>{
 const ns=Array.from({length:100},(_,i)=>[64,i*16,16]);const v=voices([[[72,0,1600]],ns,[[36,0,1600]]]);
 const on=M.convert(v,180,{compatibility:true}),off=M.convert(v,180,{compatibility:false});verify(on);verify(off);
 assert.ok(Math.abs(on.offsetMs-20.833333)<.001);
 on.tracks[1].notes.forEach((n,i)=>{assert.equal(n.start-off.tracks[1].notes[i].start,3);assert.equal(n.start+n.duration,off.tracks[1].notes[i].start+off.tracks[1].notes[i].duration);});
 assert.equal(on.duration,off.duration);
});
test('triplets remain exact and repeated triplet attacks do not become ties',()=>{
 const r=M.convert(voices([Array.from({length:12},(_,i)=>[72,i*16/3,16/3])]),180,{compatibility:false});verify(r);
 assert.equal(r.parsed[2].notes.length,12);assert.ok(r.parts[2].includes('12'));assert.equal(r.parsed[2].notes.at(-1).start,176);
});
test('constant tempo integrates tempo changes inside sustained notes, rests and closing slowdown',()=>{
 const events=[{tick:0,tempo:120},{tick:16,tempo:90},{tick:48,tempo:60}];
 const r=M.convert(voices([[[72,0,32],[74,48,16]],[[60,32,16]],[[36,0,64]]],events),120,{compatibility:false,constantTempo:true,tempo:180});verify(r);
 assert.ok(Math.abs(r.duration-(.5+2*60/90+1))<=1/24);
 r.parts.forEach(p=>assert.equal((p.match(/t\d+/g)||[]).length,1));
 assert.ok(Math.abs(r.parsed[2].notes[0].duration/48/3-7/6)<.02);
});
test('retained tempo events split a sustained note without introducing attacks',()=>{
 const r=M.convert(voices([[[72,0,64]],[[60,0,64]],[[36,0,64]]],[{tick:0,tempo:120},{tick:32,tempo:60}]),120,{compatibility:false,constantTempo:false});
 assert.ok(r.validation.ok);assert.equal(r.parsed[2].notes.length,1);assert.match(r.parts[2],/t60&/);assert.equal(r.duration,3);
 // mml-iterator cannot change tempo inside its ^ tie syntax; use separate independent fixture below.
});
test('independent parser checks variable tempo when boundaries are between attacks',()=>{
 const r=M.convert(voices([[[72,0,32],[74,32,32]]],[{tick:0,tempo:120},{tick:32,tempo:60}]),120,{compatibility:false,constantTempo:false});verify(r);
});
test('character limit is exact and never removes the finale',()=>{
 const ns=Array.from({length:3208},(_,i)=>[60+i%12,i*4,4]);const a=M.arrange([source(ns)]);const r=M.convert(a.tracks,180,{compatibility:false});
 verify(r);assert.ok(r.overLimit.some(Boolean));assert.equal(a.trimTick,null);assert.equal(a.tracks[0].notes.length,3208);assert.equal(r.parsed[2].notes.at(-1).pitch,63);
 assert.equal(r.overLimit[2],r.parts[2].length>M.LIMIT);
});
test('validator catches altered pitch, attack, sustain, and trailing rest',()=>{
 const r=M.convert(voices([[[60,0,16],[62,32,16]]]));
 for(const change of [p=>p[2].notes[0].pitch++,p=>p[2].notes[1].start++,p=>p[2].notes[0].duration++,p=>p[0].endTick++,p=>p[0].tempoEvents[0].tempo++]){const p=structuredClone(r.parsed);change(p);assert.equal(M.validate(r.tracks,p).ok,false);}
 assert.throws(()=>M.parsePart('t180o4v10l4c&d'),/tie/);assert.throws(()=>M.parsePart('t180x'),/Unsupported/);
});
test('percussion instruments on pitched channels are not promoted to the melody',()=>{
 const a=M.arrange([source([[72,0,16],[74,16,16]],48),source(Array.from({length:32},(_,i)=>[51,i,1]),47)]);
 assert.deepEqual(a.tracks[0].notes.map(n=>n.pitch),[72,74]);assert.equal(a.omittedPercussion,32);
});
for(const name of ['1812 Overture','Laufey - From The Start','Yankee Doodle Dandy']){
 const file=`${process.env.MIDI_REGRESSION_DIR||'/Users/denniswong/Downloads'}/${name}.mid`;
 test(`provided MIDI regression: ${name}`,{skip:!fs.existsSync(file)},()=>{
   const p=parseMidi(fs.readFileSync(file)),a=M.arrange(p.tracks,p.tempo,p.tempoEvents),r=M.convert(a.tracks,p.tempo,{constantTempo:true,tempo:180});verify(r);
   assert.ok(Math.abs(r.duration-r.sourceDuration)<=1/24+.00001);assert.ok(r.maxTimingErrorMs<42);
   const ids=new Map(p.tracks.flatMap(t=>t.notes).map(n=>[n.id,n]));
   a.tracks.forEach(t=>t.notes.forEach(n=>{assert.equal(n.pitch,ids.get(n.sourceId).pitch);assert.equal(n.start,ids.get(n.sourceId).rawStart);assert.ok(n.duration<=ids.get(n.sourceId).rawDuration+1e-7);}));
   if(name==='1812 Overture'){
     assert.deepEqual(a.tracks[0].notes.slice(-11).map(n=>n.pitch),[75,77,79,80,82,84,86,87,63,63,63]);
     assert.deepEqual(r.parsed[2].notes.slice(-11).map(n=>n.pitch),[75,77,79,80,82,84,86,87,63,63,63]);
     assert.ok(r.parsed[2].notes.at(-1).duration/48/3>3.9);
   }
 });
}

test('MIDI sustain pedal, repeated attacks, raw triplets and trailing silence are retained',()=>{
 const bytes=Buffer.from([
   0,0xb0,64,127, 0,0x90,60,90, 32,0x80,60,0,
   0,0x90,60,80, 32,0x80,60,0, 32,0xb0,64,0,
   96,0xff,0x2f,0,
 ]);
 const length=Buffer.alloc(4);length.writeUInt32BE(bytes.length);
 const p=parseMidi(Buffer.concat([Buffer.from([77,84,104,100,0,0,0,6,0,0,0,1,0,96,77,84,114,107]),length,bytes]));
 const notes=p.tracks.flatMap(t=>t.notes).sort((a,b)=>a.rawStart-b.rawStart);
 assert.equal(notes.length,2);assert.equal(notes[0].rawDuration,16);assert.equal(notes[1].rawStart,16/3);assert.equal(p.tracks[0].endTick,32);
 const a=M.arrange(p.tracks),r=M.convert(a.tracks,120,{compatibility:false});verify(r);
 assert.equal(r.sourceDuration,1);assert.equal(r.parsed[2].notes.length,2);assert.ok(r.parsed[2].rests.at(-1).duration>0);
});

test('upper octave doublings are removed while the bass octave foundation remains',()=>{
 const a=M.arrange([source([[72,0,16],[74,16,16]],73),source([[60,0,16],[62,16,16]],48),source([[36,0,16],[38,16,16]],33)]);
 assert.deepEqual(a.tracks[2].notes.map(n=>n.pitch),[36,38]);assert.equal(a.tracks[1].notes.length,0);assert.equal(a.changes.doublings,2);
});

test('default export preserves different source BPMs without forcing 180',()=>{
 for(const bpm of [60,72,90,120,150,173,200,240]) {
  const r=M.convert(voices([[[72,0,16]],[[60,0,16]],[[36,0,16]]]),bpm);
  verify(r);assert.equal(r.tempo,bpm);assert.equal(r.constantTempo,false);
  assert.ok(Math.abs(r.duration-60/bpm)<1e-8);
 }
});
test('flattening is opt-in and supports a user-selected tempo',()=>{
 const v=voices([[[72,0,16],[74,16,16]]],[{tick:0,tempo:90},{tick:16,tempo:60}]);
 const original=M.convert(v,90,{compatibility:false});verify(original);
 assert.equal(original.tempo,90);assert.equal(original.parsed[2].tempoEvents.length,2);
 for(const bpm of [90,120,180,240]) {
  const r=M.convert(v,90,{constantTempo:true,tempo:bpm,compatibility:false});verify(r);
  assert.equal(r.tempo,bpm);assert.equal(r.parsed[2].tempoEvents.length,1);
  assert.ok(Math.abs(r.duration-5/3)<=6/48*60/bpm+1e-8);
 }
});
test('delay follows local tempo and reports its representable duration',()=>{
 const v=voices([[[72,0,32]],[[60,0,16],[62,16,16]],[[36,0,32]]],[{tick:0,tempo:180},{tick:16,tempo:60}]);
 const r=M.convert(v,180,{compatibility:true});assert.ok(r.validation.ok);
 assert.ok(Math.abs(r.offsetMinMs-20.833333)<.001);assert.equal(r.offsetMaxMs,62.5);
 assert.ok(r.warnings.some(w=>w.includes('shortest supported delay')));
});

test('volume boost adds one common offset: V8/V9/V10 becomes V13/V14/V15',()=>{
 const v=voices([[[72,0,16]],[[60,0,16]],[[36,0,16]]]);
 v.forEach((t,i)=>{t.volume=8+i;t.notes[0].velocity=(9+i)*8-1;});
 const before=structuredClone(v);
 const r=M.convert(v,120,{boostVolume:true,melodyHarmony2:false,compatibility:false});
 verify(r);assert.equal(r.volumeBoost,5);
 assert.deepEqual(r.parsed.map(t=>t.notes[0].velocity),[111,119,127]);
 assert.deepEqual(v,before);
 assert.equal(M.convert(v,120).volumeBoost,0);
});
test('volume boost preserves dynamics and does not clip an existing V15 peak',()=>{
 const v=voices([[[72,0,16],[74,16,16]],[[60,0,16]],[[36,0,16]]]);
 v[0].notes[0].velocity=63;v[0].notes[1].velocity=127;
 const r=M.convert(v,120,{boostVolume:true,compatibility:false});verify(r);
 assert.equal(r.volumeBoost,0);assert.deepEqual(r.parsed[2].notes.map(n=>n.velocity),[63,127]);
});

test('lossless compression preserves attacks, pitches, dynamics, rests, ties and tempo',()=>{
 const part='t120o4v8l4c8&c8r8o5v10d8d8o4e4.t90r4g8';
 const compact=M.compactPart(part);
 assert.ok(compact.length<part.length);
 assert.deepEqual(M.parsePart(compact),M.parsePart(part));
});
test('capacity fitting removes notes without changing retained notes or cutting the ending',()=>{
 const notes=Array.from({length:1200},(_,i)=>[36+(i*17)%60,i*4,4]);
 const v=voices([notes]);const original=M.convert(v,180,{compatibility:false});
 const r=M.convert(v,180,{fitLimit:true,compatibility:false});verify(r);
 assert.ok(r.counts.every(n=>n<=2400));assert.ok(r.fitting[2].removed>0);
 assert.equal(r.duration,original.duration);
 assert.deepEqual(r.parsed[2].notes.slice(-16),original.parsed[2].notes.slice(-16));
 const originals=new Set(original.parsed[2].notes.map(n=>JSON.stringify(n)));
 r.parsed[2].notes.forEach(n=>assert.ok(originals.has(JSON.stringify(n))));
 assert.equal(v[0].notes.length,1200);
});
test('fitting leaves already-small arrangements musically unchanged',()=>{
 const v=voices([[[72,0,16],[74,32,16]],[[60,0,16]],[[36,0,48]]]);
 const before=M.convert(v,120),after=M.convert(v,120,{fitLimit:true});verify(after);
 assert.deepEqual(after.parsed,before.parsed);assert.ok(after.fitting.every(f=>f.removed===0));
});
for(const name of ['1812 Overture','Laufey - From The Start','Yankee Doodle Dandy']) {
 const file=`${process.env.MIDI_REGRESSION_DIR||'/Users/denniswong/Downloads'}/${name}.mid`;
 test(`capacity regression: ${name}`,{skip:!fs.existsSync(file)},()=>{
  const p=parseMidi(fs.readFileSync(file)),a=M.arrange(p.tracks,p.tempo,p.tempoEvents);
  const before=M.convert(a.tracks,p.tempo),r=M.convert(a.tracks,p.tempo,{fitLimit:true});
  assert.ok(r.validation.ok);assert.ok(r.counts.every(n=>n<=2400));assert.equal(r.duration,before.duration);
  assert.deepEqual(r.parsed[2].notes.slice(-16),before.parsed[2].notes.slice(-16));
  // Independently check the flattened variant, whose ties this parser can represent.
  verify(M.convert(a.tracks,p.tempo,{fitLimit:true,constantTempo:true,tempo:180}));
 });
}
test('protected material that cannot fit is reported over limit, never truncated',()=>{
 const v=voices([[[72,0,1000000]]]);const r=M.convert(v,180,{fitLimit:true,compatibility:false});
 assert.equal(r.fitting[2].removed,0);assert.ok(r.overLimit[2]);assert.equal(r.parsed[2].notes.length,1);
});

test('polyphonic piano melody preserves sustains and rests over an active accompaniment',()=>{
 const accompaniment=Array.from({length:24},(_,i)=>[48+[0,7,4,7][i%4],i*4,4]);
 const a=M.arrange([source([...accompaniment,[79,0,8],[78,8,24],[79,64,8],[76,72,24]])]);
 assert.deepEqual(a.tracks[0].notes.map(n=>[n.pitch,n.start,n.duration]),[[79,0,8],[78,8,24],[79,64,8],[76,72,24]]);
 assert.equal(a.changes.shortened,0);verify(M.convert(a.tracks));
});
test('rolled guitar chord preserves three overlapping tones in separate voices',()=>{
 const a=M.arrange([source([[48,0,24],[60,1.75,24],[72,3.5,24]],24)]);
 const roll=a.tracks.flatMap(t=>t.notes).filter(n=>n.start<4);
 assert.equal(roll.length,3);assert.ok(roll.every(n=>n.duration===24));
 verify(M.convert(a.tracks));
});
test('default accompaniment export has no artificial delay',()=>{
 const r=M.convert(voices([[[72,0,16]],[[60,0,16]],[[36,0,16]]]),101);
 assert.equal(r.offsetMs,0);assert.ok(r.parsed.every(p=>p.notes[0].start===0));verify(r);
});
for(const name of ['Still Alive - Portal OST','Stephen Sanchez - Until I found You']){
 const file=`${process.env.MIDI_REGRESSION_DIR||'/Users/denniswong/Downloads'}/${name}.mid`;
 test(`piano/guitar sustain regression: ${name}`,{skip:!fs.existsSync(file)},()=>{
  const p=parseMidi(fs.readFileSync(file)),before=JSON.stringify(p),a=M.arrange(p.tracks,p.tempo,p.tempoEvents);
  assert.equal(JSON.stringify(p),before);
  if(name.startsWith('Still')){
   const held=a.tracks[0].notes.find(n=>n.pitch===78&&n.start===64);
   assert.ok(held);assert.equal(held.duration,held.sourceDuration);
   assert.ok(!a.tracks[0].notes.some(n=>n.start>=96&&n.start<152));
   assert.equal(a.changes.shortened,0);
  }else{
   const first=a.tracks.flatMap(t=>t.notes).filter(n=>n.start<4);
   assert.equal(first.length,3);assert.ok(first.every(n=>n.duration===n.sourceDuration));
   assert.ok(a.changes.shortened<75);
  }
  const r=M.convert(a.tracks,p.tempo,{fitLimit:true});verify(r);
  assert.ok(r.counts.every(n=>n<=2400));assert.ok(Math.abs(r.duration-r.sourceDuration)<.025);
 });
}

test('default export compresses notation without removing notes to meet capacity',()=>{
 const v=voices([Array.from({length:1200},(_,i)=>[36+(i*17)%60,i*4,4])]);
 const r=M.convert(v,120);verify(r);
 assert.equal(r.parsed[2].notes.length,1200);
 assert.equal(r.fitting[2].removed,0);
 assert.ok(r.overLimit[2]);
 assert.ok(r.parts[2].length<M.encode(r.tracks[2],r.tempo).length);
});
const goldenFile=`${process.env.MIDI_REGRESSION_DIR||'/Users/denniswong/Downloads'}/Golden Challenge（香港早晨）.mid`;
test('Golden Challenge preserves selected voices unless capacity reduction is requested',{skip:!fs.existsSync(goldenFile)},()=>{
 const p=parseMidi(fs.readFileSync(goldenFile)),a=M.arrange(p.tracks,p.tempo,p.tempoEvents);
 const preserved=M.convert(a.tracks,p.tempo),fitted=M.convert(a.tracks,p.tempo,{fitLimit:true});
 verify(preserved);verify(fitted);
 assert.ok(preserved.fitting.every(f=>f.removed===0));
 assert.ok(preserved.overLimit.some(Boolean));
 assert.ok(fitted.fitting.reduce((sum,f)=>sum+f.removed,0)>400);
 assert.equal(preserved.duration,fitted.duration);
});

test('lossless compression changes default lengths between rhythmic sections',()=>{
 const part='t120o4v10l4'+'c16d16e16f16'.repeat(30)+'g8a8b8>c8<'.repeat(30)+'d4.e4.f4.'.repeat(20);
 const compact=M.compactPart(part);
 assert.ok(compact.length<part.length*.65);
 assert.ok((compact.match(/l\d+/g)||[]).length>=2);
 assert.deepEqual(M.parsePart(compact),M.parsePart(part));
 assert.equal(M.compactPart(compact),compact);
});
test('changing defaults preserves dotted notes and tied segments across tempo and volume commands',()=>{
 const part='t120o4v10l16'+'cdef'.repeat(15)+'c&c8.t90&c8v8r8.'+'l8gab>c<'.repeat(15)+'l4d&d16r16';
 const compact=M.compactPart(part);
 assert.ok(compact.length<=part.length);
 assert.deepEqual(M.parsePart(compact),M.parsePart(part));
});
