const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const MobileMml = require('../mobile-converter.js');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = html.match(/async function previewMobileMml\(part\) \{[\s\S]*?\n\}/)[0];

for (const constantTempo of [false, true]) for (const selectedTick of [0, 24, 99]) {
  test(`converted playback advances through tempo changes (flattened: ${constantTempo}, selected tick: ${selectedTick}) and stops updating after cancellation`, async () => {
    let frame;
    let renders = 0;
    const scheduled = [];
    const timers = [];
    const context = vm.createContext({
      MobileMml,
      mobileExportResult: { parts: ['t120c4t60d4', 't120r2', 't120r2'], duration: 2, tempo: 120, constantTempo, tracks: [{}, {}, {}] },
      audio: { playRequest: 0, context: { currentTime: 10 }, timers: [] },
      state: { tempo: 120, playhead: selectedTick, tracks: [{ tempoEvents: [{ tick: 0, tempo: 120 }, { tick: 16, tempo: 60 }] }] },
      elements: { playToggle: { setAttribute() {} } },
      stopPlayback() {}, ensureAudio: async () => 'fallback',
      songEnd: () => 64, renderPlayhead: () => renders++, revealPlayhead() {},
      requestAnimationFrame: callback => { frame = callback; return 1; },
      setTimeout: (callback, delay) => { timers.push(delay); return 1; }, SYNTH_CHANNELS: [0, 1, 2],
      scheduleFallbackNote: (...args) => scheduled.push(args), notify() {},
    });
    vm.runInContext(source, context);
    await context.previewMobileMml('all');
    const offset = selectedTick === 24 ? 1 : 0;
    assert.equal(context.state.playhead, offset ? 24 : 0);
    assert.equal(scheduled.length, offset ? 1 : 2);
    assert.ok(Math.abs(scheduled[0][2] - 10.08) < 1e-8);
    assert.ok(Math.abs(scheduled.at(-1)[3] - (11.58 - offset)) < 1e-8);
    assert.equal(timers[0], (2 - offset + .15) * 1000);
    context.audio.context.currentTime = offset ? 10.33 : 11.08;
    frame();
    assert.ok(Math.abs(context.state.playhead - (offset ? 28 : 24)) < 0.00001);
    const before = renders;
    context.audio.playRequest++;
    frame();
    assert.equal(renders, before);
  });
}

test('selecting a timeline position restarts active playback at the selected tick',()=>{
 const seek = html.match(/function setPlayheadAtPoint\(clientX\) \{[\s\S]*?\n\}/)[0];
 for (const preview of [false,true]) {
  const calls=[];
  const context=vm.createContext({
   state:{isPlaying:!preview,playhead:0},audio:{mobilePreview:preview,mobilePreviewPart:'1'},
   elements:{timeline:{getBoundingClientRect:()=>({left:20})}},totalTicks:100,tickWidth:2,
   stopPlayback:()=>calls.push('stop'),renderPlayhead(){},
   startPlayback:()=>calls.push(['score',context.state.playhead]),
   previewMobileMml:part=>calls.push([part,context.state.playhead]),
  });
  vm.runInContext(seek,context);context.setPlayheadAtPoint(68);
  assert.deepEqual(calls,['stop',[preview?'1':'score',24]]);
 }
});
