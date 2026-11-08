const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app.cjs');
const Score = require('../score-engraver.js');

test('editing a later pitch leaves a tempo change inside a held note at its original position', t => {
  const a = app(); t.after(a.close);
  const track = a.window.parseMml('t120c2&t60c2d4').tracks[0];
  track.notes[1].pitch = 64;
  const edited = a.window.parseMml(a.window.trackToMml(track, 120)).tracks[0];
  assert.deepEqual(Array.from(edited.tempoEvents, e => [e.tick, e.tempo]), [[0,120],[32,60]]);
  assert.deepEqual(Array.from(edited.notes, n => [n.pitch,n.start,n.duration]), [[60,0,64],[64,64,16]]);
  assert.deepEqual(a.errors, []);
});

test('MML notes beyond the old grid remain present after editing and saving; numeric ties remain one attack', t => {
  const a = app(); t.after(a.close);
  const track = a.window.parseMml('o7c4o0c4o4d4').tracks[0];
  assert.deepEqual(Array.from(track.notes, n => n.pitch), [96,12,62]);
  track.notes[2].pitch = 64;
  const reimport = a.window.parseMml(a.window.trackToMml(track, 120)).tracks[0];
  assert.deepEqual(Array.from(reimport.notes, n => n.pitch), [96,12,64]);
  const tie = a.window.parseMml('l4n48&n48').tracks[0];
  assert.equal(tie.notes.length,1); assert.equal(tie.notes[0].duration,32);
  a.state.tracks = [track]; a.state.tracks[0].notes[0].pitch = 0;
  a.window.applyProjectData(a.window.createProjectData());
  assert.equal(a.state.tracks[0].notes[0].pitch,0);
  a.click('[data-modal="export"]');
  assert.match(a.elements.exportTrackList.textContent,/Transpose notes below C0/);
  assert.equal(a.document.querySelector('#copy-export').disabled,true);
  assert.equal(a.state.tracks[0].notes[0].pitch,0);
  assert.throws(()=>a.window.parseMml('l0c'), /positive/);
});

test('normal playback uses the complete tempo map for note durations and the playhead', async t => {
  const a = app(); t.after(a.close);
  a.state.tracks = a.window.parseMml('t120c4t60d4').tracks;
  a.state.tempo = 120;
  const scheduled = [];
  let frame;
  a.audio.context = {currentTime:10};
  a.window.ensureAudio = async () => 'fallback';
  a.window.scheduleFallbackNote = (pitch, track, start, end) => scheduled.push({pitch,start,end});
  a.window.requestAnimationFrame = callback => {frame=callback; return 1;};
  await a.window.startPlayback();
  assert.equal(scheduled[0].end - scheduled[0].start, .5);
  assert.equal(scheduled[1].end - scheduled[1].start, 1);
  a.audio.context.currentTime=11;
  frame();
  assert.equal(a.state.playhead,24);
  a.window.stopPlayback();
});

test('automatic saving happens after an edit without the download button', async t => {
  const a = app(); t.after(a.close);
  const id=a.state.tracks[0].notes[0].id;
  a.window.selectOnlyNote(id); a.window.renderAll();
  a.change('#selected-note-pitch','78');
  await new Promise(resolve=>setTimeout(resolve,650));
  const draft=JSON.parse(a.window.localStorage.getItem('mabiscore-project'));
  assert.equal(draft.tracks[0].notes.find(n=>n.id===id).pitch,78);
  assert.equal(a.state.saved,true);
  assert.match(a.elements.saveState.textContent,/Draft saved/);
});

test('notation fills each bar, preserves polyphony and splits held notes without changing source data', () => {
  const tracks=[{id:'upper',notes:[{id:'held',pitch:60,start:60,duration:30},{id:'chord',pitch:64,start:60,duration:30},{id:'overlap',pitch:67,start:64,duration:8}]}];
  const original=JSON.stringify(tracks);
  const {measures}=Score.buildMeasures(tracks,100);
  assert.equal(measures.length,2);
  for(const m of measures) for(const voice of m.voices) assert.equal(voice.events.reduce((n,e)=>n+e.ticks,0),64);
  const held=measures.flatMap(m=>m.voices.flatMap(v=>v.events)).filter(e=>e.notes.some(n=>n.id==='held'));
  assert.equal(held.reduce((n,e)=>n+e.ticks,0),30);
  assert.ok(held.some(e=>e.notes.length===2));
  assert.equal(JSON.stringify(tracks),original);
});

test('notes starting after beat one keep a single duration symbol instead of unnecessary ties', () => {
  for (const [start,duration] of [[16,32],[4,16],[8,24],[16,16],[2,6]]) {
    const tracks=[{id:'part',notes:[{id:'note',pitch:60,start,duration}]}];
    const {measures}=Score.buildMeasures(tracks,64);
    const notes=measures.flatMap(m=>m.voices.flatMap(v=>v.events)).filter(e=>e.notes.length);
    assert.equal(notes.length,1,`start ${start}, duration ${duration}`);
    assert.equal(notes[0].start,start);
    assert.equal(notes[0].ticks,duration);
    for(const m of measures) for(const voice of m.voices) assert.equal(voice.events.reduce((n,e)=>n+e.ticks,0),64);
  }
});

test('a note held across a barline still has tied segments with its complete duration', () => {
  const tracks=[{id:'part',notes:[{id:'held',pitch:60,start:48,duration:32}]}];
  const {measures}=Score.buildMeasures(tracks,80);
  const notes=measures.flatMap(m=>m.voices.flatMap(v=>v.events)).filter(e=>e.notes.length);
  assert.deepEqual(notes.map(e=>[e.start,e.ticks]),[[48,16],[64,16]]);
  assert.ok(notes.every(e=>e.notes[0].displayStart===48 && e.notes[0].displayEnd===80));
});

test('score hit positions map back to the correct staff pitches, and preferences survive reopening', t => {
  const a=app({keyboardLayout:'letters',keyboardOctave:5,scoreSpacing:50});t.after(a.close);
  a.click('#sheet-mode');
  assert.equal(a.state.keyboardLayout,'letters'); assert.equal(a.state.keyboardOctave,5);
  const layout=a.getScoreLayout();
  for(const hit of a.document.querySelectorAll('.engraved-hit')) {
    const source=a.state.tracks.flatMap(t=>t.notes).find(n=>n.id===hit.dataset.noteId);
    const point=layout.pointToNote(parseFloat(hit.style.left)+14,parseFloat(hit.style.top)+15,1);
    assert.ok(point);
    assert.equal(a.window.staffStepToNaturalPitch(point.step),a.window.staffNoteSpelling(source).basePitch);
  }
  assert.deepEqual(a.errors,[]);
});
