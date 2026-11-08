const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('./helpers/app.cjs');

function setup(t, notes = []) {
  const a=app();t.after(a.close);
  a.state.tracks=[{id:'part',name:'Preview test',instrument:'Piano',volume:12,color:'#ee6a5b',notes}];
  a.state.activeTrackId='part';
  a.click('#sheet-mode');a.click('#tool-draw');
  a.point=tick=>({x:a.getScoreLayout().locate(tick).x,y:a.getScoreLayout().positions[Math.floor(tick/64)].treble.getYForLine(4)+12});
  a.pointer=(type,point,pointerType='mouse',pointerId=1)=>{
    const event=new a.window.MouseEvent(type,{bubbles:true,clientX:point.x,clientY:point.y});
    Object.defineProperties(event,{pointerType:{value:pointerType},pointerId:{value:pointerId}});
    a.elements.sheetScore.dispatchEvent(event);
  };
  return a;
}

test('hovering previews pitch, beat and duration without changing notes, history or saved data', t => {
  const a=setup(t),original=JSON.stringify(a.state.tracks),history=a.state.history.length;
  a.pointer('pointermove',a.point(16));
  assert.match(a.document.querySelector('#score-placement-status').textContent,/C4 · Bar 1, beat 2 · Quarter note · 1 beat · Ends bar 1, beat 3/);
  const ghost=a.document.querySelector('.vf-score-placement-ghost');
  assert.ok(ghost.querySelector('path'));
  assert.equal(ghost.dataset.start,'16');assert.equal(ghost.dataset.duration,'16');
  assert.ok(a.document.querySelector('.score-placement-label'));
  assert.equal(JSON.stringify(a.state.tracks),original);
  assert.equal(a.state.history.length,history);
  assert.equal(a.document.querySelector('#confirm-score-note').hidden,true);
  a.pointer('pointerleave',a.point(16));
  assert.equal(a.document.querySelector('.vf-score-placement-ghost'),null);
  assert.deepEqual(a.errors,[]);
});

test('score length controls and accidentals update the preview and match the placed note', t => {
  const a=setup(t),point=a.point(16);
  a.pointer('pointermove',point);
  a.change('#score-note-duration','32');
  assert.equal(a.elements.noteDuration.value,'32');
  assert.match(a.document.querySelector('#score-placement-status').textContent,/Half note · 2 beats/);
  assert.equal(a.document.querySelector('.vf-score-placement-ghost').dataset.duration,'32');
  a.change('#sheet-accidental','sharp');
  assert.match(a.document.querySelector('#score-placement-status').textContent,/C♯4/);
  assert.equal(a.state.tracks[0].notes.length,0);
  a.elements.sheetScore.dispatchEvent(new a.window.MouseEvent('click',{bubbles:true,clientX:point.x,clientY:point.y}));
  assert.equal(a.state.tracks[0].notes.length,1);
  const note=a.state.tracks[0].notes[0];
  assert.equal(note.pitch,61);assert.equal(note.start,16);assert.equal(note.duration,32);
  assert.equal(a.document.querySelector('.vf-score-placement-ghost'),null);
  a.change('#note-duration','8');
  assert.equal(a.document.querySelector('#score-note-duration').value,'8');
  assert.deepEqual(a.errors,[]);
});

test('touch previews first, suppresses the compatibility click and places only on confirmation', t => {
  const a=setup(t),point=a.point(16);
  a.pointer('pointerdown',point,'touch');a.pointer('pointerup',point,'touch');
  a.elements.sheetScore.dispatchEvent(new a.window.MouseEvent('click',{bubbles:true,clientX:point.x,clientY:point.y}));
  assert.equal(a.state.tracks[0].notes.length,0);
  assert.equal(a.state.history.length,0);
  assert.equal(a.document.querySelector('#confirm-score-note').hidden,false);
  a.pointer('pointerleave',point,'touch');
  assert.ok(a.document.querySelector('.vf-score-placement-ghost'));
  a.click('#confirm-score-note');
  assert.equal(a.state.tracks[0].notes.length,1);
  assert.equal(a.state.tracks[0].notes[0].start,16);
  assert.equal(a.state.history.length,1);
  assert.equal(a.document.querySelector('#confirm-score-note').hidden,true);
  assert.deepEqual(a.errors,[]);
});

test('cancel, Escape and tool changes dismiss the preview without making an edit', t => {
  const a=setup(t),point=a.point(16);
  const preview=()=>{a.pointer('pointerdown',point,'touch');a.pointer('pointerup',point,'touch');};
  preview();a.click('#cancel-score-note');
  assert.equal(a.document.querySelector('.vf-score-placement-ghost'),null);
  preview();a.key('Escape');
  assert.equal(a.document.querySelector('.vf-score-placement-ghost'),null);
  preview();a.click('#tool-select');
  assert.equal(a.document.querySelector('.vf-score-placement-ghost'),null);
  assert.equal(a.document.querySelector('#confirm-score-note').hidden,true);
  assert.equal(a.state.tracks[0].notes.length,0);
  assert.equal(a.state.history.length,0);
  assert.deepEqual(a.errors,[]);
});

test('panning and multi-touch gestures do not create a pending placement or insert a note', t => {
  const a=setup(t),point=a.point(16),moved={x:point.x+30,y:point.y+30};
  a.pointer('pointerdown',point,'touch');a.pointer('pointermove',moved,'touch');a.pointer('pointerup',moved,'touch');
  assert.equal(a.document.querySelector('.vf-score-placement-ghost'),null);
  a.pointer('pointerdown',point,'touch',1);a.pointer('pointerdown',moved,'touch',2);
  a.pointer('pointerup',point,'touch',1);a.pointer('pointerup',moved,'touch',2);
  assert.equal(a.document.querySelector('.vf-score-placement-ghost'),null);
  assert.equal(a.state.tracks[0].notes.length,0);
  assert.deepEqual(a.errors,[]);
});

test('a duration crossing a barline previews its tied pieces and names its ending position', t => {
  const a=setup(t,[{id:'later',pitch:67,start:96,duration:16,velocity:100}]);
  a.change('#score-note-duration','32');
  const original=JSON.stringify(a.state.tracks);
  a.pointer('pointermove',a.point(48));
  assert.match(a.document.querySelector('#score-placement-status').textContent,/Ends bar 2, beat 2 · Tied across the barline/);
  const ghost=a.document.querySelector('.vf-score-placement-ghost');
  assert.equal(ghost.querySelectorAll('.vf-stavenote').length,2);
  assert.ok(ghost.querySelector('.vf-stavetie'));
  assert.equal(JSON.stringify(a.state.tracks),original);
  assert.deepEqual(a.errors,[]);
});
