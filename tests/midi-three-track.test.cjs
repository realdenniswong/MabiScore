const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const arrangementSource = html.match(/function midiProgramFamily\(program\) \{[\s\S]*?\n\}\n\nfunction syncTempoControl/)[0]
  .replace(/\n\nfunction syncTempoControl$/, "");
const parserSource = html.match(/function readVariableLength\(data, offset\) \{[\s\S]*?\n\}\n\nfunction midiProgramFamily/)[0]
  .replace(/\n\nfunction midiProgramFamily$/, "");
const exporterSource = html.match(/function splitDuration\(duration\) \{[\s\S]*?\n\}\n\nfunction readVariableLength/)[0]
  .replace(/\n\nfunction readVariableLength$/, "");
let nextId = 0;
const context = vm.createContext({
  COLORS: ["#ee6a5b", "#4f78c8", "#7b61c9"],
  PITCH_MIN: 24,
  PITCH_MAX: 95,
  TICKS_PER_WHOLE: 64,
  TICKS_PER_BEAT: 16,
  uid: (prefix) => `${prefix}-${++nextId}`,
  volumeToVelocity: (volume) => Math.max(1, Math.min(127, (volume + 1) * 8 - 1)),
  velocityToVolume: (velocity) => Math.max(0, Math.min(15, Math.round((velocity + 1) / 8) - 1)),
  normalizeVolume: (volume) => Math.max(0, Math.min(15, Math.round(volume))),
  normalizeMmlTempo: (tempo) => Math.max(1, Math.min(255, Math.round(tempo))),
  trackEndTick: (track) => Math.max(0, ...track.notes.map((note) => note.start + note.duration)),
});
vm.runInContext(`${parserSource}\n${arrangementSource}\n${exporterSource}`, context);
const arrange = context.arrangeMidiInThreeTracks;

function inputTrack(instrument, notes, metadata = {}) {
  inputTrack.sequence = (inputTrack.sequence || 0) + 1;
  return {
    id: `source-${inputTrack.sequence}`,
    instrument,
    ...metadata,
    notes: notes.map(([pitch, start, duration, velocity = 90], index) => ({
      id: `source-${inputTrack.sequence}-note-${index}`,
      pitch,
      start,
      duration,
      velocity,
    })),
  };
}

function assertMonophonic(tracks) {
  assert.equal(tracks.length, 3);
  tracks.forEach((track) => {
    const notes = [...track.notes].sort((a, b) => a.start - b.start);
    for (let index = 1; index < notes.length; index += 1) {
      assert.ok(notes[index - 1].start + notes[index - 1].duration <= notes[index].start);
    }
    notes.forEach((note) => assert.ok(note.duration >= 1));
  });
}

function assertOriginalNotes(sourceTracks, outputTracks) {
  const originals = new Set(sourceTracks.flatMap((track) => track.notes.map((note) =>
    `${note.pitch}:${note.start}:${note.duration}:${note.velocity}`)));
  outputTracks.flatMap((track) => track.notes).forEach((note) => {
    assert.ok(originals.has(`${note.pitch}:${note.start}:${note.duration}:${note.velocity}`),
      `The note ${note.pitch} at ${note.start} must retain its original duration and velocity`);
  });
}

test("reduces a chord to three non-overlapping MML parts", () => {
  const result = arrange([inputTrack("Piano", [
    [48, 0, 16], [60, 0, 16], [64, 0, 16], [72, 0, 16],
  ])]);
  assertMonophonic(result.tracks);
  assert.equal(result.tracks.reduce((sum, track) => sum + track.notes.length, 0), 3);
  assert.equal(result.omittedNotes, 1);
  const mml = context.toMml(result.tracks, 120);
  assert.match(mml, /^MML@.+,.+,.+;$/);
  assert.equal((mml.match(/,/g) || []).length, 2);
});

test("drops a conflicting note whole instead of shortening its sustain", () => {
  const source = [
    inputTrack("Piano", [[48, 0, 32, 25], [60, 0, 32, 25], [72, 0, 32, 25]]),
    inputTrack("Piano", [[84, 8, 16, 127]]),
  ];
  const result = arrange(source);
  assertMonophonic(result.tracks);
  assertOriginalNotes(source, result.tracks);
  assert.equal(result.omittedNotes, 1);
  assert.ok(result.tracks.some((track) => track.notes.some((note) => note.pitch === 84)));
});

test("a quiet same-pitch reattack uses another part instead of truncating a held note", () => {
  const source = [
    inputTrack("Piano", [[60, 0, 32, 100]]),
    inputTrack("Piano", [[60, 8, 8, 20]]),
  ];
  const result = arrange(source);
  assertMonophonic(result.tracks);
  assertOriginalNotes(source, result.tracks);
  assert.equal(result.omittedNotes, 0);
  assert.ok(result.tracks.some((track) => track.notes.some((note) =>
    note.pitch === 60 && note.start === 0 && note.duration === 32)));
});

test("omits percussion when pitched material is available", () => {
  const result = arrange([
    inputTrack("Piano", [[60, 0, 16]]),
    inputTrack("Drum Kit", [[36, 0, 16], [38, 16, 16]]),
  ]);
  assertMonophonic(result.tracks);
  assert.equal(result.omittedPercussion, 2);
  assert.equal(result.tracks.reduce((sum, track) => sum + track.notes.length, 0), 1);
});

test("still creates exactly three parts from a single voice", () => {
  const result = arrange([inputTrack("Piano", [[60, 0, 16], [62, 16, 16]])]);
  assertMonophonic(result.tracks);
  assert.equal(result.tracks.filter((track) => track.notes.length).length, 1);
  assert.equal((context.toMml(result.tracks, 120).match(/,/g) || []).length, 2);
});

test("dense staggered passages remain monophonic", () => {
  const notes = Array.from({ length: 120 }, (_, index) => [
    36 + (index * 7) % 48,
    Math.floor(index / 4) * 4,
    4 + (index % 5) * 3,
    45 + (index * 11) % 80,
  ]);
  const result = arrange([inputTrack("Piano", notes)]);
  assertMonophonic(result.tracks);
  assertOriginalNotes([inputTrack("Piano", notes)], result.tracks);
  const kept = result.tracks.reduce((sum, track) => sum + track.notes.length, 0);
  assert.equal(kept + result.omittedNotes, notes.length);
});

test("uses MIDI programs and channels to detect melody, harmony, and bass", () => {
  const source = [
    inputTrack("Piano", [[60, 0, 16], [64, 0, 16], [67, 0, 16], [62, 16, 16], [65, 16, 16], [69, 16, 16]],
      { midiChannel: 0, midiProgram: 0, midiGroupKey: "0:0:0" }),
    inputTrack("Piano", [[72, 0, 8], [74, 8, 8], [76, 16, 8], [77, 24, 8]],
      { midiChannel: 3, midiProgram: 48, midiGroupKey: "0:3:48" }),
    inputTrack("Piano", [[36, 0, 16], [38, 16, 16]],
      { midiChannel: 1, midiProgram: 33, midiGroupKey: "0:1:33" }),
  ];
  const result = arrange(source);
  assert.deepEqual(Array.from(result.tracks, (track) => track.sourceMidiChannel), [3, 0, 1]);
  assert.deepEqual(Array.from(result.tracks, (track) => track.sourceRole), ["melody", "harmony", "bass"]);
  assert.match(result.roleSources.join(" "), /Melody: Ensemble.*Harmony: Piano.*Bass: Bass/);
});

test("removes low-salience whole notes until every MML part fits 2,400 characters", () => {
  const notes = Array.from({ length: 1600 }, (_, index) => [48 + (index * 5) % 36, index, 1, 80]);
  const result = arrange([inputTrack("Piano", notes, { midiChannel: 0, midiProgram: 0, midiGroupKey: "0:0:0" })]);
  assertMonophonic(result.tracks);
  assert.ok(result.characterLimitOmissions > 0);
  result.tracks.forEach((track) => assert.ok(context.trackToMml(track, 120).length <= 2400));
  assertOriginalNotes([inputTrack("Piano", notes)], result.tracks);
});

test("a standard MIDI file converts through to a three-part MML score", () => {
  const midiTrack = Buffer.from([
    0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
    0x00, 0x90, 48, 90, 0x00, 0x90, 60, 90,
    0x00, 0x90, 64, 90, 0x00, 0x90, 72, 90,
    0x60, 0x80, 48, 0, 0x00, 0x80, 60, 0,
    0x00, 0x80, 64, 0, 0x00, 0x80, 72, 0,
    0x00, 0xff, 0x2f, 0x00,
  ]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(midiTrack.length);
  const midi = Buffer.concat([
    Buffer.from([0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96]),
    Buffer.from([0x4d, 0x54, 0x72, 0x6b]),
    length,
    midiTrack,
  ]);
  const parsed = context.parseMidi(midi.buffer.slice(midi.byteOffset, midi.byteOffset + midi.byteLength));
  assert.equal(parsed.tempo, 120);
  assert.deepEqual(Array.from(parsed.tempoEvents, (event) => ({ tick: event.tick, tempo: event.tempo })), [{ tick: 0, tempo: 120 }]);
  assert.equal(parsed.tracks.length, 4);
  const result = arrange(parsed.tracks);
  assertMonophonic(result.tracks);
  assert.equal((context.toMml(result.tracks, parsed.tempo).match(/,/g) || []).length, 2);
});
