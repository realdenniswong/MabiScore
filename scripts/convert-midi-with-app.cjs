const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath || !/\.mml$/i.test(outputPath)) {
  throw new Error("Usage: node scripts/convert-midi-with-app.cjs input.mid output.mml");
}
const draftPath = outputPath.replace(/\.mml$/i, ".mabiscore.json");
if (fs.existsSync(outputPath) || fs.existsSync(draftPath)) {
  throw new Error("An output file already exists; choose a different name to avoid overwriting it.");
}

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
function appCode(from, until) {
  const start = html.indexOf(from);
  const end = html.indexOf(until, start + from.length);
  if (start < 0 || end < 0) throw new Error("Could not locate MabiScore conversion code.");
  return html.slice(start, end);
}
let nextId = 0;
const app = vm.createContext({
  COLORS: ["#ee6a5b", "#4f78c8", "#7b61c9", "#2f9d78", "#d58a32", "#d04f88"],
  PITCH_MIN: 24,
  PITCH_MAX: 95,
  TICKS_PER_WHOLE: 64,
  TICKS_PER_BEAT: 16,
  uid: (prefix) => `${prefix}-${++nextId}`,
});
vm.runInContext(
  appCode("function normalizeVolume(", "function synthChannelForTrack(")
    + appCode("function splitDuration(", "function syncTempoControl("),
  app,
);

const midi = fs.readFileSync(inputPath);
const parsed = app.parseMidi(midi.buffer.slice(midi.byteOffset, midi.byteOffset + midi.byteLength));
const tempo = parsed.tempo ? Math.min(240, Math.max(32, parsed.tempo)) : 84;
const arrangement = app.arrangeMidiInThreeTracks(parsed.tracks, tempo, parsed.tempoEvents);
const parts = arrangement.tracks.map((track) => app.trackToMml(track, tempo));
const mml = app.toMml(arrangement.tracks, tempo);
if (arrangement.tracks.length !== 3 || parts.some((part) => !part)) {
  throw new Error("The conversion did not produce three MML parts.");
}

const sourceNotes = parsed.tracks.flatMap((track) => track.notes);
const sourceSignatures = new Set(sourceNotes.map((note) =>
  `${note.pitch}:${note.start}:${note.duration}:${note.velocity}`));
arrangement.tracks.forEach((track) => {
  if (app.trackHasPolyphony(track)) throw new Error(`Overlapping notes remain in ${track.name}.`);
  track.notes.forEach((note) => {
    const signature = `${note.pitch}:${note.start}:${note.duration}:${note.velocity}`;
    if (!sourceSignatures.has(signature)) {
      throw new Error(`A note in ${track.name} changed its timing or pitch.`);
    }
  });
});

const project = {
  format: "mabiscore-project",
  version: 1,
  tracks: arrangement.tracks,
  activeTrackId: arrangement.tracks[0].id,
  tempo,
  name: path.basename(inputPath).replace(/\.(mid|midi)$/i, "").replace(/[_-]+/g, " "),
  snap: 4,
  noteDuration: 16,
  timingResolution: 64,
};
fs.writeFileSync(outputPath, `${mml}\n`, { flag: "wx" });
fs.writeFileSync(draftPath, `${JSON.stringify(project, null, 2)}\n`, { flag: "wx" });

console.log(JSON.stringify({
  sourceVoices: parsed.tracks.length,
  sourcePlayableNotes: sourceNotes.length,
  skippedOutOfRange: parsed.skippedNotes,
  omittedPercussion: arrangement.omittedPercussion,
  omittedOtherNotes: arrangement.omittedNotes,
  characterLimitOmissions: arrangement.characterLimitOmissions,
  detectedRoles: arrangement.roleSources,
  tempoEvents: parsed.tempoEvents,
  outputNotes: arrangement.tracks.map((track) => track.notes.length),
  tempo,
  mmlCharacters: parts.map((part) => part.length),
  over2400Characters: parts.map((part) => part.length > 2400),
  outputPath,
  draftPath,
}, null, 2));
