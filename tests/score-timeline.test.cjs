const test=require('node:test');
const assert=require('node:assert/strict');
const app=require('./helpers/app.cjs');

function setup(t,source) {
  const a=app();t.after(a.close);
  a.state.tempo=120;
  a.state.tracks=source?a.window.parseMml(source).tracks:[{id:'part',name:'Test',instrument:'Piano',volume:12,color:'#ee6a5b',notes:[]}];
  a.state.activeTrackId=a.state.tracks[0].id;
  a.click('#sheet-mode');
  return a;
}

test('the score beat ruler remains visible in Select, Draw and musical typing',t=>{
  const a=setup(t);
  const beats=()=>[...a.document.querySelectorAll('.score-beat-seek')];
  assert.deepEqual(beats().map(b=>b.dataset.tick),['0','16','32','48']);
  for(const tool of ['select','draw','select']) {
    a.click(`#tool-${tool}`);
    assert.ok(beats().every(b=>a.window.getComputedStyle(b).display==='block'));
  }
  a.click('#keyboard-input-toggle');
  assert.ok(beats().every(b=>a.window.getComputedStyle(b).display==='block'));
  assert.equal(a.window.songEnd(),64);
  assert.deepEqual(a.errors,[]);
});

test('the orange line reports the exact bar, fractional beat and elapsed time while paused',t=>{
  const a=setup(t);
  a.state.playhead=24;a.window.renderPlayhead();
  const text='Bar 1 · Beat 2.5 · 0:00.75';
  assert.equal(a.document.querySelector('#score-position-readout').textContent,text);
  assert.equal(a.document.querySelector('#score-playhead-label').textContent,text);
  assert.equal(a.document.querySelector('.score-beat-seek[aria-current="time"]').dataset.tick,'16');
  assert.equal(parseFloat(a.elements.sheetPlayhead.style.left),a.getScoreLayout().locate(24).x);
  a.state.playhead=17;a.window.renderPlayhead();
  assert.match(a.document.querySelector('#score-playhead-label').textContent,/Beat 2\.0625/);
  assert.equal(a.window.formatScoreTime(59.999),'1:00.00');
  assert.deepEqual(a.errors,[]);
});

test('timeline timestamps integrate tempo changes and refresh after a tempo edit',t=>{
  const a=setup(t,'t120c4t60d4');
  a.state.playhead=32;a.window.renderPlayhead();
  assert.equal(a.document.querySelector('#score-playhead-label').textContent,'Bar 1 · Beat 3 · 0:01.50');
  assert.match(a.document.querySelector('.score-beat-seek[data-tick="16"]').title,/0:00\.50/);
  a.change('#tempo','60');
  assert.equal(a.document.querySelector('#score-playhead-label').textContent,'Bar 1 · Beat 3 · 0:03.00');
  assert.match(a.document.querySelector('.score-beat-seek[data-tick="16"]').title,/0:01\.00/);
  assert.deepEqual(a.errors,[]);
});

test('clicking a beat or subdivision on the ruler seeks without changing score data',t=>{
  const a=setup(t),original=JSON.stringify(a.state.tracks);
  const point=a.getScoreLayout().locate(24);
  const ruler=a.document.querySelector('.score-time-ruler');
  ruler.dispatchEvent(new a.window.MouseEvent('click',{bubbles:true,clientX:point.x}));
  assert.equal(a.state.playhead,24);
  a.click('.score-beat-seek[data-tick="48"]');
  assert.equal(a.state.playhead,48);
  assert.equal(a.document.querySelector('#score-position-readout').textContent,'Bar 1 · Beat 4 · 0:01.50');
  assert.equal(JSON.stringify(a.state.tracks),original);
  assert.equal(a.state.history.length,0);
  assert.deepEqual(a.errors,[]);
});

test('the timing label follows actual playback through a slowdown',async t=>{
  const a=setup(t,'t120c4t60d4');
  let frame;
  a.audio.context={currentTime:10};
  a.window.ensureAudio=async()=> 'fallback';a.window.scheduleFallbackNote=()=>{};
  a.window.requestAnimationFrame=callback=>{frame=callback;return 1;};
  await a.window.startPlayback();
  a.audio.context.currentTime=11;frame();
  assert.equal(a.state.playhead,24);
  assert.equal(a.document.querySelector('#score-playhead-label').textContent,'Bar 1 · Beat 2.5 · 0:01.00');
  assert.equal(a.document.querySelector('.score-beat-seek[aria-current="time"]').dataset.tick,'16');
  a.window.stopPlayback();
  assert.deepEqual(a.errors,[]);
});

test('seeking in the score restarts active playback at the selected beat',t=>{
  const a=setup(t),calls=[];
  a.state.isPlaying=true;
  a.window.stopPlayback=()=>{calls.push('stop');a.state.isPlaying=false;};
  a.window.startPlayback=()=>calls.push(['start',a.state.playhead]);
  a.click('.score-beat-seek[data-tick="32"]');
  assert.deepEqual(calls,['stop',['start',32]]);
  assert.equal(a.document.querySelector('#score-playhead-label').textContent,'Bar 1 · Beat 3 · 0:01.00');
});
