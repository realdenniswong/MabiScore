import "./app/globals.css";

const COLORS = ["#ee6a5b", "#4f78c8", "#7b61c9", "#2f9d78", "#d58a32", "#d04f88"];
const PITCH_MIN = 48;
const PITCH_MAX = 95;
const ROW_HEIGHT = 28;
const SIXTEENTH_WIDTH = 24;
const TOTAL_TICKS = 128;
const GRID_WIDTH = TOTAL_TICKS * SIXTEENTH_WIDTH;
const PITCHES = Array.from({ length: PITCH_MAX - PITCH_MIN + 1 }, (_, index) => PITCH_MAX - index);
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeNotes(rawNotes, prefix, velocity) {
  return rawNotes.map(([pitch, start, duration], index) => ({
    id: `${prefix}-${index}`,
    pitch,
    start,
    duration,
    velocity,
  }));
}

const demoTracks = [
  {
    id: "track-1",
    name: "Main melody",
    instrument: "Lute",
    color: COLORS[0],
    muted: false,
    notes: makeNotes([
      [60, 0, 4], [64, 4, 4], [67, 8, 4], [72, 12, 8], [71, 20, 4],
      [67, 24, 4], [69, 28, 8], [67, 36, 4], [64, 40, 4], [60, 44, 8],
    ], "demo", 104),
  },
  {
    id: "track-2",
    name: "Harmony",
    instrument: "Mandolin",
    color: COLORS[1],
    muted: false,
    notes: makeNotes([
      [48, 0, 8], [52, 8, 8], [55, 16, 8], [53, 24, 8], [48, 32, 8], [55, 40, 8],
    ], "harmony", 82),
  },
];

const state = {
  tracks: demoTracks,
  activeTrackId: demoTracks[0].id,
  tempo: 120,
  snap: 1,
  noteDuration: 4,
  selectedNoteId: null,
  isPlaying: false,
  playhead: 0,
  loop: false,
  saved: true,
  projectName: "New day in Tir Chonaill",
  history: [],
  future: [],
  exportSelection: new Set(),
};

const audio = {
  context: null,
  nodes: [],
  animationFrame: null,
  startedAt: 0,
  origin: 0,
};

const drag = {
  active: false,
  noteId: null,
  originX: 0,
  originY: 0,
  start: 0,
  pitch: 0,
  snapshot: null,
};

const elements = {
  projectTitle: document.querySelector("#project-title"),
  saveState: document.querySelector("#save-state"),
  tempo: document.querySelector("#tempo"),
  snap: document.querySelector("#snap"),
  noteDuration: document.querySelector("#note-duration"),
  playToggle: document.querySelector("#play-toggle"),
  loopToggle: document.querySelector("#loop-toggle"),
  trackList: document.querySelector("#track-list"),
  trackCount: document.querySelector("#track-count"),
  activeTrackName: document.querySelector("#active-track-name"),
  activeInstrument: document.querySelector("#active-instrument"),
  activeDot: document.querySelector("#active-dot"),
  selectionTools: document.querySelector("#selection-tools"),
  timelineScroll: document.querySelector("#timeline-scroll"),
  timeline: document.querySelector("#timeline"),
  timelinePlayhead: document.querySelector("#timeline-playhead"),
  keyScroll: document.querySelector("#key-scroll"),
  pianoKeys: document.querySelector("#piano-keys"),
  gridScroll: document.querySelector("#grid-scroll"),
  noteGrid: document.querySelector("#note-grid"),
  gridPlayhead: document.querySelector("#grid-playhead"),
  undo: document.querySelector("#undo-action"),
  redo: document.querySelector("#redo-action"),
  midiFile: document.querySelector("#midi-file"),
  modalBackdrop: document.querySelector("#modal-backdrop"),
  modalClose: document.querySelector("#modal-close"),
  mmlInput: document.querySelector("#mml-input"),
  exportTrackList: document.querySelector("#export-track-list"),
  exportSummary: document.querySelector("#export-summary"),
  exportCode: document.querySelector("#export-code"),
  toast: document.querySelector("#toast"),
};

function cloneTracks(tracks = state.tracks) {
  return tracks.map((track) => ({ ...track, notes: track.notes.map((note) => ({ ...note })) }));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function activeTrack() {
  return state.tracks.find((track) => track.id === state.activeTrackId) || state.tracks[0];
}

function noteLabel(pitch) {
  return `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

function markUnsaved() {
  state.saved = false;
  renderSaveState();
}

function notify(message) {
  elements.toast.textContent = `✓  ${message}`;
  elements.toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function commitTracks(nextTracks) {
  state.history.push(cloneTracks());
  state.history = state.history.slice(-25);
  state.future = [];
  state.tracks = typeof nextTracks === "function" ? nextTracks(cloneTracks()) : nextTracks;
  markUnsaved();
  renderAll();
}

function renderSaveState() {
  elements.saveState.textContent = state.saved ? "✓ Saved" : "Unsaved";
  elements.saveState.classList.toggle("is-saved", state.saved);
}

function renderHistory() {
  elements.undo.disabled = state.history.length === 0;
  elements.redo.disabled = state.future.length === 0;
}

function renderTracks() {
  elements.trackCount.textContent = state.tracks.length;
  elements.trackList.innerHTML = state.tracks.map((track, index) => `
    <article class="track-card ${track.id === state.activeTrackId ? "is-active" : ""}" data-track-id="${track.id}" style="--track-color:${track.color}">
      <span class="track-stripe"></span>
      <span class="track-index">${String(index + 1).padStart(2, "0")}</span>
      <div class="track-copy">
        <input value="${escapeHtml(track.name)}" aria-label="Name for track ${index + 1}" data-track-name="${track.id}" />
        <span>${escapeHtml(track.instrument)} · ${track.notes.length} notes</span>
      </div>
      <div class="track-tools">
        <button data-mute-track="${track.id}" aria-label="${track.muted ? "Unmute" : "Mute"} ${escapeHtml(track.name)}">${track.muted ? "⊘" : "◖"}</button>
        <button data-delete-track="${track.id}" aria-label="Delete ${escapeHtml(track.name)}">×</button>
      </div>
    </article>
  `).join("");

  elements.trackList.querySelectorAll(".track-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.activeTrackId = card.dataset.trackId;
      state.selectedNoteId = null;
      renderAll();
    });
  });
  elements.trackList.querySelectorAll("[data-track-name]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", (event) => {
      const track = state.tracks.find((item) => item.id === input.dataset.trackName);
      if (!track) return;
      track.name = event.target.value.trim() || "Untitled track";
      markUnsaved();
      renderTracks();
      renderRollHeading();
    });
  });
  elements.trackList.querySelectorAll("[data-mute-track]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = button.dataset.muteTrack;
      commitTracks((tracks) => tracks.map((track) => track.id === id ? { ...track, muted: !track.muted } : track));
    });
  });
  elements.trackList.querySelectorAll("[data-delete-track]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeTrack(button.dataset.deleteTrack);
    });
  });
}

function renderRollHeading() {
  const track = activeTrack();
  if (!track) return;
  elements.activeTrackName.textContent = track.name;
  elements.activeInstrument.textContent = track.instrument;
  elements.activeDot.style.background = track.color;
  if (state.selectedNoteId) {
    elements.selectionTools.innerHTML = '<button id="delete-note">⌫ Delete note</button>';
    document.querySelector("#delete-note").addEventListener("click", deleteSelectedNote);
  } else {
    elements.selectionTools.innerHTML = "<span>Select a note to move or delete it</span>";
  }
}

function renderNotes() {
  elements.noteGrid.querySelectorAll(".note-block").forEach((note) => note.remove());
  const track = activeTrack();
  if (!track) return;
  const fragment = document.createDocumentFragment();
  track.notes.forEach((note) => {
    const button = document.createElement("button");
    button.className = `note-block ${note.id === state.selectedNoteId ? "is-selected" : ""}`;
    button.dataset.noteId = note.id;
    button.style.left = `${note.start * SIXTEENTH_WIDTH + 2}px`;
    button.style.top = `${(PITCH_MAX - note.pitch) * ROW_HEIGHT + 3}px`;
    button.style.width = `${Math.max(18, note.duration * SIXTEENTH_WIDTH - 4)}px`;
    button.style.height = `${ROW_HEIGHT - 6}px`;
    button.style.background = track.color;
    button.title = `${noteLabel(note.pitch)} · ${note.duration}/16`;
    button.innerHTML = `<span>${noteLabel(note.pitch)}</span>`;
    button.addEventListener("pointerdown", beginNoteDrag);
    fragment.append(button);
  });
  elements.noteGrid.append(fragment);
}

function renderPlayhead() {
  const left = `${state.playhead * SIXTEENTH_WIDTH}px`;
  elements.timelinePlayhead.style.left = left;
  elements.gridPlayhead.style.left = left;
}

function renderAll() {
  renderTracks();
  renderRollHeading();
  renderNotes();
  renderPlayhead();
  renderHistory();
  renderSaveState();
}

function buildStaticGrid() {
  elements.timeline.style.width = `${GRID_WIDTH}px`;
  for (let index = 0; index < TOTAL_TICKS / 16; index += 1) {
    const label = document.createElement("span");
    label.style.left = `${index * 16 * SIXTEENTH_WIDTH}px`;
    label.textContent = index + 1;
    elements.timeline.insertBefore(label, elements.timelinePlayhead);
  }

  elements.pianoKeys.style.height = `${PITCHES.length * ROW_HEIGHT}px`;
  elements.pianoKeys.innerHTML = PITCHES.map((pitch) => `
    <div class="piano-key ${BLACK_KEYS.has(pitch % 12) ? "is-black" : ""} ${pitch % 12 === 0 ? "is-c" : ""}">
      <span>${pitch % 12 === 0 || BLACK_KEYS.has(pitch % 12) ? noteLabel(pitch) : ""}</span>
    </div>
  `).join("");

  elements.noteGrid.style.width = `${GRID_WIDTH}px`;
  elements.noteGrid.style.height = `${PITCHES.length * ROW_HEIGHT}px`;
  const fragment = document.createDocumentFragment();
  PITCHES.forEach((pitch, index) => {
    const row = document.createElement("span");
    row.className = `pitch-row ${BLACK_KEYS.has(pitch % 12) ? "is-black" : ""} ${pitch % 12 === 0 ? "is-c" : ""}`;
    row.style.top = `${index * ROW_HEIGHT}px`;
    fragment.append(row);
  });
  for (let tick = 0; tick <= TOTAL_TICKS; tick += 1) {
    const line = document.createElement("span");
    line.className = `tick-line ${tick % 16 === 0 ? "is-measure" : tick % 4 === 0 ? "is-beat" : ""}`;
    line.style.left = `${tick * SIXTEENTH_WIDTH}px`;
    fragment.append(line);
  }
  elements.noteGrid.insertBefore(fragment, elements.gridPlayhead);
}

function addTrack() {
  const next = {
    id: uid("track"),
    name: `Track ${state.tracks.length + 1}`,
    instrument: "Lute",
    color: COLORS[state.tracks.length % COLORS.length],
    muted: false,
    notes: [],
  };
  commitTracks((tracks) => [...tracks, next]);
  state.activeTrackId = next.id;
  renderAll();
}

function removeTrack(id) {
  if (state.tracks.length === 1) {
    notify("A score needs at least one track.");
    return;
  }
  const remaining = state.tracks.filter((track) => track.id !== id);
  commitTracks(remaining);
  if (state.activeTrackId === id) state.activeTrackId = remaining[0].id;
  renderAll();
}

function deleteSelectedNote() {
  if (!state.selectedNoteId) return;
  const selectedId = state.selectedNoteId;
  state.selectedNoteId = null;
  commitTracks((tracks) => tracks.map((track) => ({
    ...track,
    notes: track.notes.filter((note) => note.id !== selectedId),
  })));
}

function addNoteFromPointer(event) {
  if (event.target.closest(".note-block")) return;
  const track = activeTrack();
  if (!track) return;
  const rectangle = elements.noteGrid.getBoundingClientRect();
  const x = event.clientX - rectangle.left;
  const y = event.clientY - rectangle.top;
  const start = Math.max(0, Math.min(
    TOTAL_TICKS - state.noteDuration,
    Math.floor(x / (SIXTEENTH_WIDTH * state.snap)) * state.snap,
  ));
  const row = Math.max(0, Math.min(PITCHES.length - 1, Math.floor(y / ROW_HEIGHT)));
  const note = {
    id: uid("note"),
    pitch: PITCHES[row],
    start,
    duration: state.noteDuration,
    velocity: 104,
  };
  state.selectedNoteId = note.id;
  commitTracks((tracks) => tracks.map((item) => item.id === track.id ? { ...item, notes: [...item.notes, note] } : item));
}

function beginNoteDrag(event) {
  event.preventDefault();
  event.stopPropagation();
  const noteId = event.currentTarget.dataset.noteId;
  const note = activeTrack().notes.find((item) => item.id === noteId);
  if (!note) return;
  state.selectedNoteId = noteId;
  drag.active = true;
  drag.noteId = noteId;
  drag.originX = event.clientX;
  drag.originY = event.clientY;
  drag.start = note.start;
  drag.pitch = note.pitch;
  drag.snapshot = cloneTracks();
  renderRollHeading();
  renderNotes();
}

function moveNoteDrag(event) {
  if (!drag.active) return;
  const tickDelta = Math.round((event.clientX - drag.originX) / (SIXTEENTH_WIDTH * state.snap)) * state.snap;
  const pitchDelta = -Math.round((event.clientY - drag.originY) / ROW_HEIGHT);
  const track = activeTrack();
  const note = track.notes.find((item) => item.id === drag.noteId);
  if (!note) return;
  note.start = Math.max(0, Math.min(TOTAL_TICKS - note.duration, drag.start + tickDelta));
  note.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, drag.pitch + pitchDelta));
  markUnsaved();
  renderNotes();
}

function endNoteDrag() {
  if (!drag.active) return;
  state.history.push(drag.snapshot);
  state.history = state.history.slice(-25);
  state.future = [];
  drag.active = false;
  drag.snapshot = null;
  renderHistory();
}

function undo() {
  const previous = state.history.pop();
  if (!previous) return;
  state.future.unshift(cloneTracks());
  state.tracks = previous;
  if (!state.tracks.some((track) => track.id === state.activeTrackId)) state.activeTrackId = state.tracks[0].id;
  state.selectedNoteId = null;
  markUnsaved();
  renderAll();
}

function redo() {
  const next = state.future.shift();
  if (!next) return;
  state.history.push(cloneTracks());
  state.tracks = next;
  if (!state.tracks.some((track) => track.id === state.activeTrackId)) state.activeTrackId = state.tracks[0].id;
  state.selectedNoteId = null;
  markUnsaved();
  renderAll();
}

function songEnd() {
  const ends = state.tracks.flatMap((track) => track.notes.map((note) => note.start + note.duration));
  return Math.max(64, ...ends);
}

function stopPlayback(reset = false) {
  audio.nodes.forEach((node) => {
    try { node.stop(); } catch { /* The note already ended. */ }
  });
  audio.nodes = [];
  if (audio.animationFrame) cancelAnimationFrame(audio.animationFrame);
  audio.animationFrame = null;
  state.isPlaying = false;
  elements.playToggle.textContent = "▶";
  elements.playToggle.setAttribute("aria-label", "Play score");
  if (reset) {
    state.playhead = 0;
    renderPlayhead();
  }
}

async function startPlayback() {
  if (state.isPlaying) {
    stopPlayback();
    return;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    notify("Audio playback is not supported in this browser.");
    return;
  }
  if (!audio.context) audio.context = new AudioContextClass();
  const context = audio.context;
  await context.resume();
  const secondsPerTick = 60 / state.tempo / 4;
  const origin = state.playhead >= songEnd() ? 0 : state.playhead;
  audio.origin = origin;
  audio.startedAt = context.currentTime;
  state.isPlaying = true;
  elements.playToggle.textContent = "❚❚";
  elements.playToggle.setAttribute("aria-label", "Pause playback");

  state.tracks.filter((track) => !track.muted).forEach((track, trackIndex) => {
    track.notes.forEach((note) => {
      if (note.start + note.duration <= origin) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = trackIndex % 2 ? "sine" : "triangle";
      oscillator.frequency.value = 440 * Math.pow(2, (note.pitch - 69) / 12);
      const start = context.currentTime + Math.max(0, note.start - origin) * secondsPerTick;
      const end = context.currentTime + Math.max(0.04, note.start + note.duration - origin) * secondsPerTick;
      const volume = Math.min(0.12, (note.velocity / 127) * 0.09);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.setValueAtTime(volume, Math.max(start + 0.013, end - 0.035));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
      audio.nodes.push(oscillator);
    });
  });

  function update() {
    const position = audio.origin + (context.currentTime - audio.startedAt) / secondsPerTick;
    if (position >= songEnd()) {
      if (state.loop) {
        stopPlayback(true);
        setTimeout(startPlayback, 30);
      } else {
        stopPlayback(true);
      }
      return;
    }
    state.playhead = position;
    renderPlayhead();
    audio.animationFrame = requestAnimationFrame(update);
  }
  audio.animationFrame = requestAnimationFrame(update);
}

function tickLength(denominator, dots = 0) {
  let value = 16 / denominator;
  let addition = value / 2;
  for (let index = 0; index < dots; index += 1) {
    value += addition;
    addition /= 2;
  }
  return Math.max(1, Math.round(value));
}

function parseMml(source) {
  const body = source.trim().replace(/^MML@/i, "").replace(/;\s*$/, "");
  if (!body) throw new Error("No MML notes were found.");
  const parts = body.split(",").map((part) => part.replace(/\s+/g, ""));
  let importedTempo = null;

  const tracks = parts.map((part, partIndex) => {
    let cursor = 0;
    let octave = 4;
    let defaultLength = 4;
    let volume = 10;
    let index = 0;
    let pendingTie = false;
    const notes = [];

    function readNumber() {
      let raw = "";
      while (/\d/.test(part[index] || "")) raw += part[index++];
      return raw ? Number(raw) : null;
    }

    while (index < part.length) {
      const command = part[index++].toLowerCase();
      if (command === "<") { octave -= 1; continue; }
      if (command === ">") { octave += 1; continue; }
      if (command === "o") { octave = readNumber() ?? octave; continue; }
      if (command === "l") { defaultLength = readNumber() ?? defaultLength; continue; }
      if (command === "v") { volume = readNumber() ?? volume; continue; }
      if (command === "t") {
        const value = readNumber();
        if (value) importedTempo = Math.min(240, Math.max(32, value));
        continue;
      }
      if (command === "&") { pendingTie = true; continue; }
      if (command === "n") {
        const pitch = readNumber();
        if (pitch !== null) {
          const duration = tickLength(defaultLength);
          notes.push({ id: uid("note"), pitch, start: cursor, duration, velocity: Math.min(127, volume * 8) });
          cursor += duration;
        }
        pendingTie = part[index] === "&";
        if (pendingTie) index += 1;
        continue;
      }
      if (command !== "r" && !"cdefgab".includes(command)) continue;

      let accidental = 0;
      if (part[index] === "+" || part[index] === "#") { accidental = 1; index += 1; }
      else if (part[index] === "-") { accidental = -1; index += 1; }
      const denominator = readNumber() ?? defaultLength;
      let dots = 0;
      while (part[index] === ".") { dots += 1; index += 1; }
      const duration = tickLength(denominator, dots);
      if (command !== "r") {
        const semitone = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[command];
        const pitch = (octave + 1) * 12 + semitone + accidental;
        const previous = notes.at(-1);
        if (pendingTie && previous && previous.pitch === pitch && previous.start + previous.duration === cursor) {
          previous.duration += duration;
        } else {
          notes.push({
            id: uid("note"),
            pitch,
            start: cursor,
            duration,
            velocity: Math.min(127, Math.max(1, Math.round(volume * 8))),
          });
        }
      }
      cursor += duration;
      pendingTie = part[index] === "&";
      if (pendingTie) index += 1;
    }

    return {
      id: uid("track"),
      name: parts.length === 1 ? "Imported melody" : `MML part ${partIndex + 1}`,
      instrument: partIndex === 0 ? "Lute" : "Mandolin",
      color: COLORS[partIndex % COLORS.length],
      muted: false,
      notes: notes.filter((note) => note.pitch >= PITCH_MIN && note.pitch <= PITCH_MAX),
    };
  });
  return { tracks, tempo: importedTempo };
}

function splitDuration(duration) {
  const values = [16, 12, 8, 6, 4, 3, 2, 1];
  const labels = { 16: "1", 12: "2.", 8: "2", 6: "4.", 4: "4", 3: "8.", 2: "8", 1: "16" };
  const result = [];
  let left = Math.max(1, Math.round(duration));
  for (const value of values) {
    while (left >= value) {
      result.push(labels[value]);
      left -= value;
    }
  }
  return result;
}

function trackToMml(track, tempo) {
  const pitchNames = ["c", "c+", "d", "d+", "e", "f", "f+", "g", "g+", "a", "a+", "b"];
  const notes = [...track.notes].sort((a, b) => a.start - b.start || b.pitch - a.pitch);
  let cursor = 0;
  let octave = 4;
  let output = `t${tempo}v12o4`;
  for (const note of notes) {
    if (note.start < cursor) continue;
    const rest = Math.round(note.start - cursor);
    if (rest > 0) output += splitDuration(rest).map((length) => `r${length}`).join("");
    const targetOctave = Math.floor(note.pitch / 12) - 1;
    if (targetOctave !== octave) {
      output += `o${targetOctave}`;
      octave = targetOctave;
    }
    const pitchName = pitchNames[note.pitch % 12];
    output += splitDuration(note.duration)
      .map((length, index) => `${index ? "&" : ""}${pitchName}${length}`)
      .join("");
    cursor = Math.round(note.start + note.duration);
  }
  return output;
}

function toMml(tracks, tempo) {
  return `MML@${tracks.map((track) => trackToMml(track, tempo)).join(",")};`;
}

function trackHasPolyphony(track) {
  const notes = [...track.notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  let latestEnd = -1;
  for (const note of notes) {
    if (note.start < latestEnd) return true;
    latestEnd = Math.max(latestEnd, note.start + note.duration);
  }
  return false;
}

function readVariableLength(data, offset) {
  let value = 0;
  let byte = 0;
  let next = offset;
  do {
    byte = data.getUint8(next++);
    value = (value << 7) | (byte & 0x7f);
  } while (byte & 0x80);
  return { value, offset: next };
}

function parseMidi(buffer) {
  const data = new DataView(buffer);
  const text = (offset, length) => String.fromCharCode(...Array.from({ length }, (_, index) => data.getUint8(offset + index)));
  if (text(0, 4) !== "MThd") throw new Error("This does not look like a standard MIDI file.");
  const headerLength = data.getUint32(4);
  const trackCount = data.getUint16(10);
  const division = data.getUint16(12);
  if (division & 0x8000) throw new Error("SMPTE-timed MIDI files are not supported yet.");
  const ppq = division;
  let offset = 8 + headerLength;
  let tempo = null;
  const collected = [];
  const trackNames = {};

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (text(offset, 4) !== "MTrk") throw new Error("A MIDI track could not be read.");
    const length = data.getUint32(offset + 4);
    let cursor = offset + 8;
    const end = cursor + length;
    let absolute = 0;
    let runningStatus = 0;
    const active = new Map();
    while (cursor < end) {
      const delta = readVariableLength(data, cursor);
      absolute += delta.value;
      cursor = delta.offset;
      let status = data.getUint8(cursor);
      if (status < 0x80) status = runningStatus;
      else {
        cursor += 1;
        if (status < 0xf0) runningStatus = status;
      }
      if (status === 0xff) {
        const type = data.getUint8(cursor++);
        const metaLength = readVariableLength(data, cursor);
        cursor = metaLength.offset;
        if (type === 0x51 && metaLength.value === 3 && tempo === null) {
          const microseconds = (data.getUint8(cursor) << 16) | (data.getUint8(cursor + 1) << 8) | data.getUint8(cursor + 2);
          tempo = Math.round(60000000 / microseconds);
        }
        if (type === 0x03) trackNames[trackIndex] = text(cursor, metaLength.value);
        cursor += metaLength.value;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const sysexLength = readVariableLength(data, cursor);
        cursor = sysexLength.offset + sysexLength.value;
        continue;
      }
      const event = status & 0xf0;
      const channel = status & 0x0f;
      const data1 = data.getUint8(cursor++);
      const oneByte = event === 0xc0 || event === 0xd0;
      const data2 = oneByte ? 0 : data.getUint8(cursor++);
      if (event === 0x90 && data2 > 0) {
        const key = `${channel}:${data1}`;
        const stack = active.get(key) || [];
        stack.push({ start: absolute, velocity: data2 });
        active.set(key, stack);
      } else if (event === 0x80 || (event === 0x90 && data2 === 0)) {
        const key = `${channel}:${data1}`;
        const stack = active.get(key);
        const started = stack?.shift();
        if (started) collected.push({ pitch: data1, start: started.start, end: absolute, velocity: started.velocity, source: trackIndex, channel });
      }
    }
    offset = end;
  }

  const groups = new Map();
  collected.forEach((note) => {
    const key = `${note.source}:${note.channel}`;
    const group = groups.get(key) || [];
    group.push(note);
    groups.set(key, group);
  });
  const tracks = [];
  let colorIndex = 0;
  for (const [key, group] of groups) {
    const sourceIndex = Number(key.split(":")[0]);
    const lanes = [];
    group.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
    group.forEach((item) => {
      const start = Math.round((item.start / ppq) * 4);
      const duration = Math.max(1, Math.round(((item.end - item.start) / ppq) * 4));
      let lane = lanes.find((candidate) => candidate.end <= start);
      if (!lane) {
        lane = { end: 0, notes: [] };
        lanes.push(lane);
      }
      lane.notes.push({ id: uid("note"), pitch: item.pitch, start, duration, velocity: item.velocity });
      lane.end = start + duration;
    });
    lanes.forEach((lane, laneIndex) => {
      const baseName = trackNames[sourceIndex] || `MIDI track ${sourceIndex + 1}`;
      tracks.push({
        id: uid("track"),
        name: lanes.length > 1 ? `${baseName} · voice ${laneIndex + 1}` : baseName,
        instrument: "Lute",
        color: COLORS[colorIndex++ % COLORS.length],
        muted: false,
        notes: lane.notes.filter((note) => note.pitch >= PITCH_MIN && note.pitch <= PITCH_MAX),
      });
    });
  }
  if (!tracks.length) throw new Error("The MIDI file did not contain any playable notes.");
  return { tracks, tempo };
}

function syncTempoControl() {
  if (![...elements.tempo.options].some((option) => Number(option.value) === state.tempo)) {
    const option = document.createElement("option");
    option.value = state.tempo;
    option.textContent = `${state.tempo} BPM`;
    elements.tempo.append(option);
  }
  elements.tempo.value = state.tempo;
}

function openModal(name) {
  elements.modalBackdrop.hidden = false;
  document.querySelectorAll(".modal-view").forEach((view) => { view.hidden = true; });
  document.querySelector(`#${name}-modal`).hidden = false;
  if (name === "export") {
    state.exportSelection = new Set(state.tracks.filter((track) => !trackHasPolyphony(track)).map((track) => track.id));
    renderExport();
  }
  setTimeout(() => elements.modalClose.focus(), 0);
}

function closeModal() {
  elements.modalBackdrop.hidden = true;
}

function renderExport() {
  elements.exportTrackList.innerHTML = state.tracks.map((track, index) => {
    const hasPolyphony = trackHasPolyphony(track);
    const characters = trackToMml(track, state.tempo).length;
    return `
      <label class="export-track ${hasPolyphony ? "has-warning" : ""}">
        <input type="checkbox" value="${track.id}" ${state.exportSelection.has(track.id) ? "checked" : ""} ${hasPolyphony ? "disabled" : ""} />
        <span class="export-track-dot" style="background:${track.color}"></span>
        <span class="export-track-name"><strong>${escapeHtml(track.name)}</strong><small>${track.notes.length} notes</small></span>
        <span class="export-track-length">${hasPolyphony ? "Overlapping notes" : `${characters} chars`}</span>
        <span class="export-track-number">${index + 1}</span>
      </label>
    `;
  }).join("");
  elements.exportTrackList.querySelectorAll("input").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.exportSelection.add(checkbox.value);
      else state.exportSelection.delete(checkbox.value);
      renderExportPreview();
    });
  });
  renderExportPreview();
}

function renderExportPreview() {
  const selected = state.tracks.filter((track) => state.exportSelection.has(track.id));
  const value = toMml(selected, state.tempo);
  elements.exportCode.value = value;
  elements.exportSummary.innerHTML = `
    <span>${selected.length} ${selected.length === 1 ? "track" : "tracks"}</span>
    <span>${selected.reduce((sum, track) => sum + track.notes.length, 0)} notes</span>
    <span>${state.tempo} BPM</span>
    <span>${value.length} characters</span>
  `;
}

function importMml() {
  try {
    const result = parseMml(elements.mmlInput.value);
    commitTracks(result.tracks);
    state.activeTrackId = result.tracks[0].id;
    if (result.tempo) {
      state.tempo = result.tempo;
      syncTempoControl();
    }
    closeModal();
    renderAll();
    notify(`${result.tracks.length} MML ${result.tracks.length === 1 ? "track" : "tracks"} imported.`);
  } catch (error) {
    notify(error.message || "The MML could not be imported.");
  }
}

async function importMidiFile(file) {
  if (!file) return;
  try {
    const result = parseMidi(await file.arrayBuffer());
    commitTracks(result.tracks);
    state.activeTrackId = result.tracks[0].id;
    if (result.tempo) {
      state.tempo = Math.min(240, Math.max(32, result.tempo));
      syncTempoControl();
    }
    renderAll();
    notify(`${result.tracks.length} playable ${result.tracks.length === 1 ? "track" : "voices"} imported from MIDI.`);
  } catch (error) {
    notify(error.message || "The MIDI file could not be imported.");
  } finally {
    elements.midiFile.value = "";
  }
}

function saveProject() {
  localStorage.setItem("mabiscore-project", JSON.stringify({
    tracks: state.tracks,
    tempo: state.tempo,
    name: state.projectName,
  }));
  state.saved = true;
  renderSaveState();
  notify("Draft saved on this device.");
}

function loadProject() {
  const raw = localStorage.getItem("mabiscore-project");
  if (!raw) return;
  try {
    const project = JSON.parse(raw);
    if (!Array.isArray(project.tracks) || !project.tracks.length) return;
    state.tracks = project.tracks;
    state.activeTrackId = project.tracks[0].id;
    state.tempo = project.tempo || 120;
    state.projectName = project.name || "Untitled score";
    elements.projectTitle.value = state.projectName;
    syncTempoControl();
  } catch {
    // A damaged local draft should never prevent the editor from opening.
  }
}

function copyExport() {
  navigator.clipboard.writeText(elements.exportCode.value)
    .then(() => notify("MML copied to clipboard."))
    .catch(() => {
      elements.exportCode.select();
      notify("MML selected—copy it from the text box.");
    });
}

function downloadExport() {
  const blob = new Blob([elements.exportCode.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mabiscore"}.mml`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  document.querySelectorAll("[data-modal]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.modal));
  });
  document.querySelectorAll(".modal-cancel").forEach((button) => button.addEventListener("click", closeModal));
  elements.modalClose.addEventListener("click", closeModal);
  elements.modalBackdrop.addEventListener("pointerdown", (event) => {
    if (event.target === elements.modalBackdrop) closeModal();
  });
  document.querySelector("#add-track").addEventListener("click", addTrack);
  document.querySelector("#save-project").addEventListener("click", saveProject);
  document.querySelector("#return-start").addEventListener("click", () => stopPlayback(true));
  elements.playToggle.addEventListener("click", startPlayback);
  elements.loopToggle.addEventListener("click", () => {
    state.loop = !state.loop;
    elements.loopToggle.classList.toggle("is-active", state.loop);
  });
  elements.undo.addEventListener("click", undo);
  elements.redo.addEventListener("click", redo);
  elements.tempo.addEventListener("change", () => {
    state.tempo = Number(elements.tempo.value);
    markUnsaved();
  });
  elements.snap.addEventListener("change", () => { state.snap = Number(elements.snap.value); });
  elements.noteDuration.addEventListener("change", () => { state.noteDuration = Number(elements.noteDuration.value); });
  elements.projectTitle.addEventListener("input", () => {
    state.projectName = elements.projectTitle.value;
    markUnsaved();
  });
  document.querySelector("#import-midi").addEventListener("click", () => elements.midiFile.click());
  elements.midiFile.addEventListener("change", () => importMidiFile(elements.midiFile.files[0]));
  document.querySelector("#confirm-mml").addEventListener("click", importMml);
  document.querySelector("#paste-mml").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) elements.mmlInput.value = text;
    } catch {
      notify("Paste your MML into the text box below.");
    }
  });
  document.querySelector("#copy-export").addEventListener("click", copyExport);
  document.querySelector("#download-export").addEventListener("click", downloadExport);
  elements.noteGrid.addEventListener("pointerdown", addNoteFromPointer);
  window.addEventListener("pointermove", moveNoteDrag);
  window.addEventListener("pointerup", endNoteDrag);
  window.addEventListener("pointercancel", endNoteDrag);
  elements.gridScroll.addEventListener("scroll", () => {
    elements.timelineScroll.scrollLeft = elements.gridScroll.scrollLeft;
    elements.keyScroll.scrollTop = elements.gridScroll.scrollTop;
  });
  elements.timelineScroll.addEventListener("pointerdown", (event) => {
    const rectangle = elements.timeline.getBoundingClientRect();
    state.playhead = Math.max(0, Math.min(TOTAL_TICKS, (event.clientX - rectangle.left) / SIXTEENTH_WIDTH));
    renderPlayhead();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.modalBackdrop.hidden) closeModal();
    if (event.target.matches("input, textarea, select")) return;
    if ((event.key === "Delete" || event.key === "Backspace") && state.selectedNoteId) {
      event.preventDefault();
      deleteSelectedNote();
    }
    if (event.code === "Space") {
      event.preventDefault();
      startPlayback();
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    }
  });
}

buildStaticGrid();
loadProject();
bindEvents();
renderAll();
requestAnimationFrame(() => {
  elements.gridScroll.scrollTop = Math.max(0, (PITCH_MAX - 78) * ROW_HEIGHT);
});
