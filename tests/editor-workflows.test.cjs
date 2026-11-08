const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app.cjs');

test('the complete editor opens, engraves the demo and maps note positions for editing', t => {
  const a = app(); t.after(a.close);
  a.click('#sheet-mode');
  assert.equal(a.state.editorMode, 'sheet');
  assert.ok(a.document.querySelectorAll('#sheet-score svg path').length > 50);
  assert.ok(a.getScoreLayout());
  assert.ok(a.getScoreLayout().positions.some(p => p.row > 0));
  const hit = a.document.querySelector('.engraved-hit[data-track-id="track-1"]');
  hit.click();
  assert.equal(a.state.selectedNoteId, hit.dataset.noteId);
  assert.ok(a.document.querySelector('#selected-note-pitch'));
  assert.deepEqual(a.errors, []);
});

test('deleting a selected note keeps time and other tracks intact; visible Undo restores it', t => {
  const a = app(); t.after(a.close);
  const original = JSON.stringify(a.state.tracks);
  const other = JSON.stringify(a.state.tracks[1]);
  const count = a.state.tracks[0].notes.length;
  a.window.selectOnlyNote(a.state.tracks[0].notes[0].id);
  a.window.renderAll(); a.click('#delete-note');
  assert.equal(a.state.tracks[0].notes.length, count - 1);
  assert.equal(JSON.stringify(a.state.tracks[1]), other);
  assert.match(a.document.querySelector('#toast').textContent, /Time kept in place/);
  a.click('#toast button');
  assert.equal(JSON.stringify(a.state.tracks), original);
  assert.deepEqual(a.errors, []);
});

test('both typing layouts match the reference and MML accidentals are suffixes, with octave shortcuts retained', t => {
  const a = app(); t.after(a.close);
  a.state.tracks[0].notes = [];
  a.click('#keyboard-input-toggle');
  for (const key of ['a','w','s','e','d','f','t','g','y','h','u','j','k']) a.key(key);
  assert.deepEqual(Array.from(a.state.tracks[0].notes, n => n.pitch), [60,61,62,63,64,65,66,67,68,69,70,71,72]);
  a.state.tracks[0].notes = []; a.state.playhead = 0;
  a.click('[data-modal="settings"]');
  a.click('[name="keyboard-layout"][value="letters"]');
  a.click('#settings-modal .modal-cancel');
  for (const key of ['c','=','d','-','e','f','g','a','b']) a.key(key);
  assert.deepEqual(Array.from(a.state.tracks[0].notes, n => n.pitch), [61,61,64,65,67,69,71]);
  assert.equal(a.state.tracks[0].notes[0].staffAccidental, 'sharp');
  assert.equal(a.state.tracks[0].notes[1].staffAccidental, 'flat');
  a.key('+', { shiftKey: true, code: 'Equal' });
  a.key('c'); assert.equal(a.state.tracks[0].notes.at(-1).pitch, 72);
  a.key('_', { shiftKey: true, code: 'Minus' });
  a.key('z'); assert.equal(a.state.keyboardOctave, 3);
  a.click('#octave-up'); assert.equal(a.state.keyboardOctave, 4);
  a.key('c'); a.key('+', { code: 'NumpadAdd' });
  assert.equal(a.state.tracks[0].notes.at(-1).pitch, 61);
  const end = a.state.playhead; a.key('r');
  assert.equal(a.state.playhead, end + a.state.noteDuration);
  assert.deepEqual(a.errors, []);
});

test('select does not create notes, Draw creates notes and Erase is undoable in the score', t => {
  const a = app(); t.after(a.close);
  a.click('#sheet-mode');
  let layout = a.getScoreLayout();
  const point = layout.locate(16), score = a.elements.sheetScore;
  const count = a.state.tracks[0].notes.length;
  a.window.addStaffNoteAtPoint(point.x, point.y + 24);
  assert.equal(a.state.tracks[0].notes.length, count);
  a.click('#tool-draw');
  layout = a.getScoreLayout();
  const p = layout.locate(32);
  a.window.addStaffNoteAtPoint(p.x, p.y + 12);
  assert.equal(a.state.tracks[0].notes.length, count + 1);
  const id = a.state.selectedNoteId;
  a.click('#tool-erase');
  a.click(`.engraved-hit[data-note-id="${id}"]`);
  assert.equal(a.state.tracks[0].notes.length, count);
  a.window.undo(); assert.equal(a.state.tracks[0].notes.length, count + 1);
  assert.deepEqual(a.errors, []);
});

test('drawing at the beat-two guide creates one quarter note exactly on beat two', t => {
  const a=app();t.after(a.close);
  a.state.tracks=[{id:'part',name:'Test',instrument:'Piano',volume:12,color:'#ee6a5b',notes:[]}];
  a.state.activeTrackId='part';
  a.click('#sheet-mode');a.click('#tool-draw');
  const guide=a.document.querySelector('.score-beat-seek[data-tick="16"]');
  assert.ok(guide);
  guide.click();
  assert.equal(a.state.playhead,16);
  assert.equal(a.state.tracks[0].notes.length,0);
  const x=parseFloat(guide.style.left)+12;
  const y=a.getScoreLayout().positions[0].treble.getYForLine(4)+12;
  a.elements.sheetScore.dispatchEvent(new a.window.MouseEvent('click',{bubbles:true,clientX:x,clientY:y}));
  assert.equal(a.state.tracks[0].notes.length,1);
  assert.equal(a.state.tracks[0].notes[0].start,16);
  assert.equal(a.state.tracks[0].notes[0].duration,16);
  assert.equal(a.document.querySelectorAll('.engraved-hit').length,1);
  assert.equal(a.document.querySelectorAll('.vf-stavetie').length,0);
  assert.deepEqual(a.errors,[]);
});

test('the screenshot timing produces one quarter note instead of a sixteenth tied to a dotted eighth', t => {
  const a=app();t.after(a.close);
  a.state.tracks=[{id:'part',name:'Test',instrument:'Piano',volume:12,color:'#ee6a5b',notes:[{id:'note',pitch:62,start:20,duration:16,velocity:100}]}];
  a.state.activeTrackId='part';
  a.click('#sheet-mode');
  const events=a.getScoreLayout().measures[0].voices.find(v=>v.clef==='treble').events;
  const notes=events.filter(event=>event.notes.length);
  assert.equal(notes.length,1);
  assert.equal(notes[0].duration,'4');
  assert.equal(notes[0].start,20);
  assert.equal(a.document.querySelectorAll('.engraved-hit').length,1);
  assert.equal(a.document.querySelectorAll('.vf-stavetie').length,0);
  assert.equal(events.reduce((sum,event)=>sum+event.ticks,0),64);
  assert.deepEqual(a.errors,[]);
});

test('note inspector and arrow keys edit shared score data; draft recovery preserves those edits', t => {
  const a = app(); t.after(a.close);
  const id = a.state.tracks[0].notes[0].id;
  a.window.selectOnlyNote(id); a.window.renderAll();
  a.change('#selected-note-pitch', '72');
  a.change('#selected-note-length', '32');
  a.key('ArrowRight'); a.key('ArrowUp', {shiftKey:true});
  const note = a.state.tracks[0].notes.find(n=>n.id===id);
  assert.equal(note.pitch,84); assert.equal(note.duration,32); assert.equal(note.start,4);
  assert.equal(a.window.flushDraft(),true);
  const saved=JSON.parse(a.window.localStorage.getItem('mabiscore-project'));
  a.window.applyProjectData(saved);
  assert.equal(a.state.tracks[0].notes.find(n=>n.id===id).pitch,84);
  assert.deepEqual(a.errors, []);
});

test('touch panning moves the roll without accidentally creating a note', t => {
  const a=app();t.after(a.close);
  const count=a.state.tracks[0].notes.length;
  a.click('#tool-draw');
  a.elements.gridScroll.scrollLeft=100;a.elements.gridScroll.scrollTop=100;
  const event=(x,y)=>({pointerType:'touch',pointerId:9,clientX:x,clientY:y,target:a.elements.noteGrid,preventDefault(){},stopPropagation(){}});
  a.window.beginRollTouch(event(100,100));
  a.window.moveRollTouch(event(50,60));
  a.window.endRollTouch(event(50,60));
  assert.equal(a.elements.gridScroll.scrollLeft,150);
  assert.equal(a.elements.gridScroll.scrollTop,140);
  assert.equal(a.state.tracks[0].notes.length,count);
});

test('opening a draft is undoable, and invalid drafts leave the current score intact', async t => {
  const a=app();t.after(a.close);
  const original=JSON.stringify(a.state.tracks);
  const draft=JSON.parse(JSON.stringify(a.window.createProjectData()));
  draft.tracks[0].notes[0].pitch=79;
  await a.window.openProjectFile({name:'edited.mabiscore.json',text:async()=>JSON.stringify(draft)});
  assert.equal(a.state.tracks[0].notes[0].pitch,79);
  a.window.undo();assert.equal(JSON.stringify(a.state.tracks),original);
  await a.window.openProjectFile({name:'invalid.json',text:async()=>'{"tracks":[{"notes":[null]}]}'});
  assert.equal(JSON.stringify(a.state.tracks),original);
});

test('copying an export selects the text when the clipboard API is unavailable', async t => {
  const a=app();t.after(a.close);
  a.click('[data-modal="export"]');
  await a.window.copyExport();
  assert.equal(a.elements.exportCode.selectionStart,0);
  assert.equal(a.elements.exportCode.selectionEnd,a.elements.exportCode.value.length);
  assert.match(a.elements.toast.textContent,/MML selected/);
});
