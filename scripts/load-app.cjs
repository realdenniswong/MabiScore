const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const from = html.indexOf('function readVariableLength(');
const until = html.indexOf('function arrangeMidiInThreeTracks(', from);
let next = 0;
const context = vm.createContext({
  COLORS: ['#ee6a5b', '#4f78c8', '#7b61c9'], TICKS_PER_BEAT: 16,
  PITCH_MIN: 24, PITCH_MAX: 95, uid: () => `source-${++next}`,
  velocityToVolume: v => Math.max(0, Math.min(15, Math.round((v+1)/8)-1)),
  volumeToVelocity: v => (v+1)*8-1,
});
vm.runInContext(html.slice(from, until), context);
exports.parseMidi = buffer => context.parseMidi(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), true);
