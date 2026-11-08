/* Editable grand-staff notation. Display quantization never changes source notes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ScoreEngraver = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VALUES = [[64, '1', 0], [48, '2', 1], [32, '2', 0], [24, '4', 1],
    [16, '4', 0], [12, '8', 1], [8, '8', 0], [6, '16', 1], [4, '16', 0],
    [3, '32', 1], [2, '32', 0], [1, '64', 0]];

  function spell(note) {
    const pitch = Math.round(note.pitch);
    const shift = note.staffAccidental === 'sharp' ? 1 : note.staffAccidental === 'flat' ? -1 : 0;
    const stored = Number(note.staffBasePitch);
    const natural = [0, 2, 4, 5, 7, 9, 11];
    const valid = Number.isFinite(stored) && natural.includes(stored % 12) && stored + shift === pitch;
    const chromatic = [1, 3, 6, 8, 10].includes(pitch % 12);
    const base = valid ? stored : chromatic ? pitch - 1 : pitch;
    const accidental = valid ? shift : chromatic ? 1 : 0;
    const letter = ['c', '', 'd', '', 'e', 'f', '', 'g', '', 'a', '', 'b'][base % 12];
    return `${letter}${accidental === 1 ? '#' : accidental === -1 ? 'b' : ''}/${Math.floor(base / 12) - 1}`;
  }

  function splitSpan(start, end, alignRests = false) {
    // A normal note keeps its duration symbol wherever it starts in a bar.
    // Only rests need beat-aligned decomposition for readable empty beats.
    // Bar-crossing notes are already separated by buildMeasures below.
    const best = new Map([[end, []]]);
    for (let cursor = end - 1; cursor >= start; cursor--) {
      let choice = null;
      for (const [ticks, duration, dots] of VALUES) {
        if (cursor + ticks > end || alignRests && cursor % (dots ? ticks * 2 / 3 : ticks) !== 0) continue;
        const tail = best.get(cursor + ticks);
        if (tail && (!choice || tail.length + 1 < choice.length)) choice = [{ start: cursor, ticks, duration, dots }, ...tail];
      }
      best.set(cursor, choice);
    }
    return best.get(start) || [];
  }

  function buildMeasures(tracks, endTick) {
    let rounded = false;
    const lanes = [];
    let end = Math.max(64, Number(endTick) || 0);
    for (const track of tracks) {
      for (const clef of ['treble', 'bass']) {
        const groups = new Map();
        for (const original of track.notes || []) {
          if (!Number.isFinite(original.start) || !Number.isFinite(original.duration) || !Number.isFinite(original.pitch)) continue;
          if ((original.pitch >= 60 ? 'treble' : 'bass') !== clef) continue;
          const start = Math.max(0, Math.round(original.start));
          const finish = Math.max(start + 1, Math.round(original.start + original.duration));
          rounded ||= Math.abs(start - original.start) > 1e-6 || Math.abs(finish - original.start - original.duration) > 1e-6;
          const note = { ...original, trackId: track.id, color: track.color, muted: track.muted, displayStart: start, displayEnd: finish };
          const key = `${start}:${finish}`;
          if (!groups.has(key)) groups.set(key, { start, end: finish, notes: [] });
          groups.get(key).notes.push(note);
          end = Math.max(end, finish);
        }
        const local = [];
        for (const group of [...groups.values()].sort((a, b) => a.start - b.start || a.end - b.end)) {
          let lane = local.find(item => item.end <= group.start);
          if (!lane) { lane = { clef, trackId: track.id, color: track.color, end: 0, groups: [] }; local.push(lane); }
          group.notes.sort((a, b) => a.pitch - b.pitch);
          lane.groups.push(group);
          lane.end = group.end;
        }
        lanes.push(...local);
      }
    }
    // Even a single-register part has a complete, readable grand staff.
    for (const clef of ['treble', 'bass']) if (!lanes.some(lane => lane.clef === clef)) lanes.push({ clef, groups: [] });
    const measures = Array.from({ length: Math.ceil(end / 64) }, (_, index) => ({ index, voices: [] }));
    for (const lane of lanes) {
      for (const measure of measures) {
        const start = measure.index * 64, finish = start + 64;
        const events = [];
        let cursor = start;
        for (const group of lane.groups) {
          if (group.end <= start || group.start >= finish) continue;
          const from = Math.max(start, group.start), to = Math.min(finish, group.end);
          if (from > cursor) events.push(...splitSpan(cursor, from, true).map(event => ({ ...event, notes: [] })));
          events.push(...splitSpan(from, to).map(event => ({ ...event, notes: group.notes })));
          cursor = to;
        }
        if (cursor < finish) events.push(...splitSpan(cursor, finish, true).map(event => ({ ...event, notes: [] })));
        measure.voices.push({ ...lane, events });
      }
    }
    return { measures, rounded };
  }

  function render(container, options) {
    const { tracks, activeTrackId, selectedIds = new Set(), width = 960, spacing = 38, onSelect, onSeek } = options;
    const VF = options.VF || globalThis.Vex.Flow;
    const model = buildMeasures(tracks, options.endTick);
    const pageWidth = Math.max(620, width);
    const widths = model.measures.map(measure => {
      const count = Math.max(...measure.voices.map(voice => voice.events.length));
      return Math.max(230, count * spacing + 100);
    });
    const actualWidth = Math.max(pageWidth, ...widths.map(w => w + 48));
    const systems = [];
    for (let i = 0; i < model.measures.length;) {
      const system = { indices: [], widths: [], width: 0 };
      while (i < widths.length && (!system.indices.length || system.width + widths[i] <= actualWidth - 48)) {
        system.indices.push(i); system.widths.push(widths[i]); system.width += widths[i++];
      }
      const extra = (actualWidth - 48 - system.width) / system.indices.length;
      system.widths = system.widths.map(w => w + extra);
      systems.push(system);
    }
    const pitches = tracks.flatMap(track => track.notes.map(note => note.pitch));
    const topExtra = Math.max(0, (Math.max(84, ...pitches) - 84) * 5);
    const bottomExtra = Math.max(0, (36 - Math.min(36, ...pitches)) * 5);
    const systemHeight = 340 + topExtra + bottomExtra;
    container.replaceChildren();
    container.style.width = `${actualWidth}px`;
    container.style.height = `${systems.length * systemHeight + 100}px`;
    const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
    renderer.resize(actualWidth, systems.length * systemHeight + 100);
    const context = renderer.getContext();
    context.setFont('Georgia', 14);
    context.fillText(options.title || 'Untitled score', 26, 30);
    context.setFont('Arial', 10);
    context.fillText('4/4 · Click a note to select it · Use Draw to add notes', 26, 51);
    const positions = [], hits = [], ties = new Map();
    systems.forEach((system, row) => {
      let x = 24;
      const top = 120 + row * systemHeight + topExtra;
      system.indices.forEach((index, column) => {
        const measure = model.measures[index];
        const w = system.widths[column];
        const treble = new VF.Stave(x, top, w, { spacing_between_lines_px: 12 });
        const bass = new VF.Stave(x, top + 140, w, { spacing_between_lines_px: 12 });
        if (column === 0) {
          treble.addClef('treble'); bass.addClef('bass');
          if (row === 0) { treble.addTimeSignature('4/4'); bass.addTimeSignature('4/4'); }
        }
        if (index === model.measures.length - 1) { treble.setEndBarType(VF.Barline.type.END); bass.setEndBarType(VF.Barline.type.END); }
        const noteStart = Math.max(treble.getNoteStartX(), bass.getNoteStartX());
        treble.setNoteStartX(noteStart); bass.setNoteStartX(noteStart);
        treble.setContext(context).draw(); bass.setContext(context).draw();
        new VF.StaveConnector(treble, bass).setType(VF.StaveConnector.type.SINGLE_LEFT).setContext(context).draw();
        new VF.StaveConnector(treble, bass).setType(VF.StaveConnector.type.SINGLE_RIGHT).setContext(context).draw();
        if (column === 0) new VF.StaveConnector(treble, bass).setType(VF.StaveConnector.type.BRACE).setContext(context).draw();
        context.setFont('Arial', 10); context.fillText(String(index + 1), x + 2, top - 10);
        // Empty extra voices contribute no music and would stack redundant rests.
        const visibleVoices = measure.voices.filter((lane, voiceIndex, voices) => {
          if (lane.events.some(event => event.notes.length)) return true;
          const sameClef = voices.filter(voice => voice.clef === lane.clef);
          if (sameClef.some(voice => voice.events.some(event => event.notes.length))) return false;
          return voices.findIndex(voice => voice.clef === lane.clef) === voiceIndex;
        });
        const data = visibleVoices.map(lane => {
          const notes = lane.events.map(event => {
            const keys = event.notes.length ? event.notes.map(spell) : [lane.clef === 'treble' ? 'b/4' : 'd/3'];
            const note = new VF.StaveNote({ clef: lane.clef, keys, duration: event.duration + (event.notes.length ? '' : 'r'), dots: event.dots, auto_stem: true });
            if (event.dots) VF.Dot.buildAndAttach([note], { all: true });
            if (!event.notes.length && event.ticks === 64) note.setCenterAlignment(true);
            const inactive = lane.trackId && lane.trackId !== activeTrackId;
            note.setStyle({ fillStyle: inactive ? '#a3a7ae' : '#20252f', strokeStyle: inactive ? '#a3a7ae' : '#20252f' });
            return note;
          });
          const voice = new VF.Voice({ num_beats: 4, beat_value: 4 }).addTickables(notes);
          const stave = lane.clef === 'treble' ? treble : bass;
          voice.setStave(stave);
          const beams = VF.Beam.generateBeams(notes, { groups: [new VF.Fraction(1, 4)] });
          return { lane, notes, voice, stave, beams };
        });
        for (const clef of ['treble', 'bass']) VF.Accidental.applyAccidentals(data.filter(d => d.lane.clef === clef).map(d => d.voice), 'C');
        const formatter = new VF.Formatter();
        for (const clef of ['treble', 'bass']) formatter.joinVoices(data.filter(d => d.lane.clef === clef).map(d => d.voice));
        formatter.format(data.map(d => d.voice), w - (noteStart - x) - 24);
        const anchors = new Map([[index * 64, noteStart + 12], [(index + 1) * 64, x + w - 15]]);
        for (const d of data) {
          d.voice.draw(context, d.stave);
          d.beams.forEach(beam => beam.setContext(context).draw());
          d.notes.forEach((engraved, e) => {
            const event = d.lane.events[e];
            const noteX = engraved.getNoteHeadBeginX() + 6;
            if (event.notes.length || event.ticks !== 64) anchors.set(event.start, noteX);
            event.notes.forEach((original, keyIndex) => {
              const id = `${original.trackId}:${original.id}`;
              const previous = ties.get(id);
              if (previous && event.start > original.displayStart) {
                const shared = { first_indices: [previous.keyIndex], last_indices: [keyIndex] };
                if (previous.row === row) new VF.StaveTie({ ...shared, first_note: previous.note, last_note: engraved }).setContext(context).draw();
                else {
                  new VF.StaveTie({ ...shared, first_note: previous.note }).setContext(context).draw();
                  new VF.StaveTie({ ...shared, last_note: engraved }).setContext(context).draw();
                }
              }
              ties.set(id, { note: engraved, keyIndex, row });
              hits.push({ note: original, x: noteX, y: engraved.getYs()[keyIndex] });
            });
          });
        }
        positions.push({ index, row, x, width: w, top, treble, bass, anchors: [...anchors].sort((a, b) => a[0] - b[0]) });
        x += w;
      });
    });
    const document = container.ownerDocument;
    const fragment = document.createDocumentFragment();
    for (const hit of hits) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `engraved-hit${selectedIds.has(hit.note.id) && hit.note.trackId === activeTrackId ? ' is-selected' : ''}`;
      button.dataset.noteId = hit.note.id; button.dataset.trackId = hit.note.trackId;
      button.style.left = `${hit.x - 14}px`; button.style.top = `${hit.y - 15}px`;
      button.title = `${hit.note.pitch} · Click to select; Delete removes this note`;
      button.setAttribute('aria-label', `${options.noteLabel ? options.noteLabel(hit.note.pitch) : hit.note.pitch}, bar ${Math.floor(hit.note.start / 64) + 1}`);
      button.setAttribute('aria-pressed', String(selectedIds.has(hit.note.id) && hit.note.trackId === activeTrackId));
      button.addEventListener('click', onSelect);
      fragment.append(button);
    }
    for (const p of positions) {
      const seek = document.createElement('button');
      seek.type = 'button'; seek.className = 'score-bar-seek';
      seek.style.cssText = `left:${p.x}px;top:${p.top - 30}px;width:${p.width}px`;
      seek.setAttribute('aria-label', `Playhead to bar ${p.index + 1}`);
      seek.addEventListener('click', event => { event.stopPropagation(); onSeek?.(p.index * 64); });
      fragment.append(seek);
    }
    container.append(fragment);
    const locateInMeasure = (p, tick) => {
      let a = p.anchors[0], b = p.anchors.at(-1);
      for (let i = 1; i < p.anchors.length; i++) if (p.anchors[i][0] >= tick) { a = p.anchors[i - 1]; b = p.anchors[i]; break; }
      const fraction = Math.max(0, Math.min(1, (tick - a[0]) / (b[0] - a[0] || 1)));
      return { x: a[1] + (b[1] - a[1]) * fraction, y: p.top + 22, height: 210 };
    };
    const locate = tick => locateInMeasure(positions[Math.min(positions.length - 1, Math.max(0, Math.floor(tick / 64)))], tick);
    const tickAtX = (p, px) => {
      let a = p.anchors[0], b = p.anchors.at(-1);
      for (let i = 1; i < p.anchors.length; i++) if (p.anchors[i][1] >= px) { a = p.anchors[i - 1]; b = p.anchors[i]; break; }
      return a[0] + Math.max(0, Math.min(1, (px - a[1]) / (b[1] - a[1] || 1))) * (b[0] - a[0]);
    };
    const beatGuides = document.createDocumentFragment();
    const beatLabels = new Map();
    for (const p of positions) {
      const ruler = document.createElement('button');
      ruler.type = 'button'; ruler.className = 'score-time-ruler'; ruler.tabIndex = -1;
      const firstX = locateInMeasure(p, p.index * 64).x, lastX = locateInMeasure(p, (p.index + 1) * 64).x;
      ruler.style.cssText = `left:${firstX - 12}px;top:${p.top + 5}px;width:${lastX - firstX + 24}px`;
      ruler.setAttribute('aria-label', `Bar ${p.index + 1} beat ruler`);
      const rulerTick = event => {
        const step = typeof options.snapStep === 'function' ? options.snapStep() : 4;
        const tick = tickAtX(p, event.clientX - container.getBoundingClientRect().left);
        return Math.max(p.index * 64, Math.min((p.index + 1) * 64, Math.round(tick / step) * step));
      };
      const positionTitle = tick => {
        const seconds = options.timeAtTick?.(tick);
        return `Bar ${1 + Math.floor(tick / 64)}, beat ${1 + (tick % 64) / 16}${Number.isFinite(seconds) ? ` · ${options.formatTime ? options.formatTime(seconds) : `${seconds.toFixed(2)} s`}` : ''} · click to move the playhead`;
      };
      ruler.addEventListener('pointermove', event => { ruler.title = positionTitle(rulerTick(event)); });
      ruler.addEventListener('click', event => { event.stopPropagation(); onSeek?.(rulerTick(event)); });
      beatGuides.append(ruler);
      for (let offset = 0; offset <= 64; offset += 4) {
        const tick = p.index * 64 + offset, point = locateInMeasure(p, tick);
        const mark = document.createElement('span'); mark.className = `score-ruler-tick${offset % 16 === 0 ? ' is-beat' : ''}`;
        mark.setAttribute('aria-hidden', 'true');
        mark.style.cssText = `left:${point.x}px;top:${p.top + (offset % 16 === 0 ? 25 : 29)}px`;
        beatGuides.append(mark);
      }
      for (let beat = 0; beat < 4; beat++) {
        const tick = p.index * 64 + beat * 16;
        const point = locate(tick);
        const line = document.createElement('span');
        line.className = 'score-beat-guide';
        line.setAttribute('aria-hidden', 'true');
        line.style.cssText = `left:${point.x}px;top:${p.top + 43}px;height:195px`;
        const label = document.createElement('button');
        label.type = 'button'; label.className = 'score-beat-seek';
        label.dataset.tick = String(tick);
        label.textContent = String(beat + 1);
        label.title = positionTitle(tick);
        label.setAttribute('aria-label', `Bar ${p.index + 1}, beat ${beat + 1} · move the playhead here`);
        label.style.cssText = `left:${point.x - 12}px;top:${p.top + 5}px`;
        label.addEventListener('pointerenter', () => { label.title = positionTitle(tick); });
        label.addEventListener('click', event => { event.stopPropagation(); onSeek?.(tick); });
        beatLabels.set(tick, label);
        beatGuides.append(line, label);
      }
    }
    container.append(beatGuides);
    let currentBeat = null;
    const setCurrentBeat = tick => {
      const beat = Math.floor(tick / 16) * 16;
      if (beat === currentBeat) return;
      beatLabels.get(currentBeat)?.removeAttribute('aria-current');
      beatLabels.get(beat)?.setAttribute('aria-current', 'time');
      currentBeat = beat;
    };
    const pointToNote = (px, py, snap) => {
      const p = positions.find(p => px >= p.x && px <= p.x + p.width && py >= p.top - 5 && py <= p.top + 245);
      if (!p) return null;
      const tick = tickAtX(p, px);
      const clef = py < p.top + 125 ? 'treble' : 'bass';
      const stave = clef === 'treble' ? p.treble : p.bass;
      // VexFlow line 0 is the bottom staff line: E4 in treble, G2 in bass.
      const step = (clef === 'treble' ? 2 : -10) + Math.round((stave.getYForLine(4) - py) / 6);
      return { start: Math.max(p.index * 64, Math.min((p.index + 1) * 64 - 1, Math.round(tick / snap) * snap)), step };
    };
    let placementGroup = null;
    const clearPlacement = () => { placementGroup?.remove(); placementGroup = null; };
    const previewPlacement = proposed => {
      clearPlacement();
      const finish = proposed.start + proposed.duration;
      const clef = proposed.pitch >= 60 ? 'treble' : 'bass';
      const color = { fillStyle: '#d85246', strokeStyle: '#d85246' };
      placementGroup = context.openGroup('score-placement-ghost');
      placementGroup.setAttribute('aria-hidden', 'true');
      placementGroup.setAttribute('pointer-events', 'none');
      placementGroup.setAttribute('opacity', '0.72');
      placementGroup.dataset.start = String(proposed.start);
      placementGroup.dataset.duration = String(proposed.duration);
      context.save();
      let first = null, previous = null;
      try {
        for (const p of positions) {
          const from = Math.max(p.index * 64, proposed.start), to = Math.min((p.index + 1) * 64, finish);
          if (from >= to) continue;
          const stave = clef === 'treble' ? p.treble : p.bass;
          for (const part of splitSpan(from, to)) {
            const note = new VF.StaveNote({ clef, keys: [spell(proposed)], duration: part.duration, dots: part.dots, auto_stem: true });
            if (part.dots) VF.Dot.buildAndAttach([note], { all: true });
            if (proposed.staffAccidental === 'sharp' || proposed.staffAccidental === 'flat') note.addModifier(new VF.Accidental(proposed.staffAccidental === 'sharp' ? '#' : 'b'), 0);
            note.setStave(stave).setStyle(color);
            VF.Formatter.SimpleFormat([note]);
            const point = locateInMeasure(p, part.start);
            const tickContext = note.getTickContext();
            tickContext.setX(tickContext.getX() + point.x - 6 - note.getNoteHeadBeginX());
            const y = note.getYs()[0];
            first ||= { x: point.x, y };
            const ending = locateInMeasure(p, part.start + part.ticks);
            context.setFillStyle('rgba(239,103,89,0.16)');
            context.fillRect(point.x - 7, y - 10, Math.max(14, ending.x - point.x + 7), 20);
            note.setContext(context).draw();
            if (previous) {
              const indices = { first_indices: [0], last_indices: [0] };
              if (previous.row === p.row) new VF.StaveTie({ ...indices, first_note: previous.note, last_note: note }).setStyle(color).setContext(context).draw();
              else {
                new VF.StaveTie({ ...indices, first_note: previous.note }).setStyle(color).setContext(context).draw();
                new VF.StaveTie({ ...indices, last_note: note }).setStyle(color).setContext(context).draw();
              }
            }
            previous = { note, row: p.row };
          }
        }
      } finally {
        context.restore();
        context.closeGroup();
      }
      return first;
    };
    return { locate, pointToNote, setCurrentBeat, previewPlacement, clearPlacement, rounded: model.rounded, measures: model.measures, positions };
  }
  return { spell, splitSpan, buildMeasures, render };
});
