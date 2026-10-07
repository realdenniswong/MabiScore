const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const html = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const context = vm.createContext({});
vm.runInContext(html.match(/function cutTimeFromTracks\(tracks, start, end\) \{[\s\S]*?\n\}/)[0],context);
test('time deletion closes all tracks, clips boundary notes and preserves the input',()=>{
 const notes=[[0,8],[8,12],[18,4],[20,24],[8,40],[32,8],[48,8]].map(([start,duration],id)=>({id,start,duration,pitch:60,rawStart:start,rawDuration:duration}));
 const tracks=[{notes,endTick:64,sourceMml:'old',tempoEvents:[{tick:0,tempo:120},{tick:20,tempo:90},{tick:28,tempo:60},{tick:48,tempo:100}]},{notes:[{start:48,duration:8}],endTick:80}];
 const before=JSON.stringify(tracks);
 const result=JSON.parse(JSON.stringify(context.cutTimeFromTracks(tracks,16,32)));
 assert.equal(JSON.stringify(tracks),before);
 assert.deepEqual(result[0].notes.map(n=>[n.start,n.duration]),[[0,8],[8,8],[16,12],[8,24],[16,8],[32,8]]);
 assert.equal(result[1].notes[0].start,32);
 assert.deepEqual(result.map(t=>t.endTick),[48,64]);
 assert.deepEqual(result[0].tempoEvents,[{tick:0,tempo:120},{tick:16,tempo:60},{tick:32,tempo:100}]);
 assert.ok(!('sourceMml' in result[0]));
 assert.ok(result[0].notes.every(n=>!('rawStart' in n)));
});
test('cutting from the beginning retains the tempo effective at the new beginning',()=>{
 const result=context.cutTimeFromTracks([{notes:[{start:0,duration:8}],tempoEvents:[{tick:0,tempo:120},{tick:8,tempo:90},{tick:16,tempo:60}],endTick:16}],0,16);
 assert.equal(result[0].notes.length,0);
 assert.equal(result[0].endTick,0);
 assert.equal(result[0].tempoEvents.length,1);
 assert.equal(result[0].tempoEvents[0].tempo,60);
 assert.equal(result[0].tempoEvents[0].tick,0);
});
