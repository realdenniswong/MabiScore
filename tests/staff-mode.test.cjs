const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const staffSource = html.match(/function isNaturalPitch\(pitch\) \{[\s\S]*?\n\}\n\nfunction instrumentByName/)[0]
  .replace(/\n\nfunction instrumentByName$/, "");
const exporterSource = html.match(/function splitDuration\(duration\) \{[\s\S]*?\n\}\n\nfunction readVariableLength/)[0]
  .replace(/\n\nfunction readVariableLength$/, "");
const context = vm.createContext({
  BLACK_KEYS: new Set([1, 3, 6, 8, 10]),
  SHEET_MIDDLE_C_Y: 180,
  SHEET_STEP_HEIGHT: 6,
  TICKS_PER_WHOLE: 64,
  normalizeVolume: (volume) => Math.max(0, Math.min(15, Math.round(volume))),
  normalizeMmlTempo: (tempo) => Math.max(1, Math.min(255, Math.round(tempo))),
  velocityToVolume: (velocity) => Math.max(0, Math.min(15, Math.round((velocity + 1) / 8) - 1)),
  trackEndTick: (track) => Math.max(0, ...track.notes.map((note) => note.start + note.duration)),
});
vm.runInContext(`${staffSource}\n${exporterSource}`, context);

test("middle C is the shared centre of the grand staff", () => {
  assert.equal(context.staffStepToNaturalPitch(0), 60);
  assert.equal(context.naturalPitchToStaffStep(60), 0);
  assert.equal(context.staffPitchToY({ pitch: 60 }), 180);
});

test("treble and bass staff anchor notes map symmetrically around middle C", () => {
  assert.equal(context.staffStepToNaturalPitch(2), 64); // Treble bottom line E4.
  assert.equal(context.staffStepToNaturalPitch(-2), 57); // Bass top line A3.
  assert.equal(context.staffPitchToY({ pitch: 64 }), 168);
  assert.equal(context.staffPitchToY({ pitch: 57 }), 192);
});

test("staff clicks support natural, sharp, and flat spelling", () => {
  assert.deepEqual(
    { ...context.staffPitchForStep(0, "natural") },
    { pitch: 60, basePitch: 60, accidental: "natural" },
  );
  assert.deepEqual(
    { ...context.staffPitchForStep(0, "sharp") },
    { pitch: 61, basePitch: 60, accidental: "sharp" },
  );
  assert.deepEqual(
    { ...context.staffPitchForStep(0, "flat") },
    { pitch: 59, basePitch: 60, accidental: "flat" },
  );
  assert.deepEqual(
    { ...context.staffNoteSpelling({ pitch: 61, staffBasePitch: 62, staffAccidental: "flat" }) },
    { basePitch: 62, accidental: "flat" },
  );
});

test("ledger lines include middle C and notes outside either staff", () => {
  assert.deepEqual(Array.from(context.staffLedgerSteps(0)), [0]);
  assert.deepEqual(Array.from(context.staffLedgerSteps(14)), [12, 14]);
  assert.deepEqual(Array.from(context.staffLedgerSteps(-14)), [-12, -14]);
});

test("a note entered on the staff exports through the normal MML path", () => {
  const entered = context.staffPitchForStep(0, "sharp");
  const track = {
    volume: 12,
    notes: [{ ...entered, staffBasePitch: entered.basePitch, staffAccidental: entered.accidental, start: 0, duration: 16, velocity: 103 }],
  };
  const mml = context.toMml([track], 120);
  assert.match(mml, /^MML@t120v12/);
  assert.match(mml, /(c\+|n49)/);
  assert.match(mml, /;$/);
});
