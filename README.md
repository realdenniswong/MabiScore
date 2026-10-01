# MabiScore

A responsive Mabinogi MML piano-roll composer built with framework-free HTML, CSS, and JavaScript.

## Use it locally

Open `index.html` in a modern browser. No installation, Node.js, package manager, or build command is required. On first playback, direct `file://` use downloads the audio worklet and Mabinogi SoundFont over HTTPS; the GitHub Pages version serves the same assets from the repository.

## Edit it

The interface and application code are inside `index.html`:

- Page structure is ordinary HTML.
- Visual styles are inside the `<style>` element.
- Application behavior is inside the `<script>` element.

The favicon, social sharing image, SpessaSynth runtime, audio worklet, and Mabinogi SoundFont are separate static assets.

Run `npm ci` then `npm test` for arrangement, timing, independent MML-parser, MIDI regression, and existing staff-editor tests. Supplied MIDI regressions run when the three files are present in `MIDI_REGRESSION_DIR` (defaults to the original local Downloads folder); otherwise they are explicitly skipped. No copyrighted input files are committed.

## Publish it

GitHub Pages publishes the root of the `main` branch directly. Push an updated `index.html` to `main` and GitHub will refresh the site automatically.

Live site: <https://realdenniswong.github.io/MabiScore/>

## Features

- Draw, audition, rectangle-select, drag, freely resize, and delete notes on a touch-friendly piano roll, including modifier multi-select, Command/Control+A, and group movement in both time and pitch
- See every track layered in the piano roll, or use **Hide others** to focus completely on the active track
- Merge two or more tracks into the active destination even when notes overlap, then resolve those overlaps before MML export
- Choose a custom color for each track; its stripe, active indicator, and every layered note update together
- Zoom the score timeline with the ruler wheel, trackpad or touchscreen pinch, or the accessible zoom buttons while keeping the musical position under the gesture and preventing whole-page zoom
- Choose a Mabinogi instrument per track with the high-quality MabiMML SoundFont
- Set an independent MML `V0`–`V15` volume for every track
- Choose tempo and new-note grid snapping from a practical 1/16 default down to 1/64, move every existing note freely in 1/64 steps, and resize notes to any 1/64 length
- Import one-part MML into the selected track—with or without an `MML@...;` wrapper—or replace the full score with multi-track `MML@...;`; numeric notes, dotted default lengths, per-note volume changes, and tempo automation are preserved, and untouched imported tracks export verbatim
- Re-export edited tracks with compact `L`, relative-octave, and numeric-note notation, with a visible warning whenever a part exceeds 2,400 characters
- Import standard MIDI files, preserve low notes down to C1, split polyphony into non-empty exportable voices, use Piano as the broad-range default, and expand the grid to the full song length with a trailing blank bar
- Use **MIDI → 3 MML** for an instrument-neutral Mobile arrangement with exactly three voices. Phrase continuity, instrument family, register, repeated motifs, dynamics, and ending material guide melody/harmony/bass selection across source tracks. Repeated attacks can shorten overlapping sustains; rests are not automatically filled with invented holds. Orchestral duplicates and percussion are reduced, and no song is truncated to fit. **Fit each part to 2,400 characters** is enabled by default: lossless notation compression comes first, then lower-priority notes are removed where needed. The full timeline and protected ending remain; removal counts are shown and the preview plays the reduced export.
- The Mobile export offers an approximately 20 ms middle-accompaniment delay, optional melody placement in **Harmony 2**, opt-in tempo flattening with a selectable playback BPM (original tempo map by default), three individually copyable game fields, character-limit warnings, and a piano audition decoded from the exported MML. Read [Mobile compatibility research and limits](docs/mobile-compatibility.md).
- Preview piano keys, placed notes, aligned notes from every unmuted track when creating a note, and full-score playback in the browser, with live per-track mute/unmute
- Switch between the piano roll and an interactive piano grand staff. The score view joins treble and bass staves around a labelled middle C, supports natural, sharp, and flat note entry, and edits the same track data used for playback, undo/redo, project saves, and MML export.
- Turn on GarageBand-style Musical Typing with `Cmd/Ctrl+K`, enter notes with the A–K piano layout, and change octave with Z/X; step input advances the playhead by the selected note length
- Copy, cut, and paste selected notes with `Cmd/Ctrl+C`, `Cmd/Ctrl+X`, and `Cmd/Ctrl+V`; timing and pitch relationships are preserved, paste starts at the playhead, and repeated paste builds consecutive loops
- Undo and redo all score-editing actions, including notes, tracks, imports, merge, names, colors, instruments, volume, tempo, and note settings
- Export any selection of monophonic tracks as `MML@...;`
- Save a local browser draft and download a portable `.mabiscore.json` backup that can be opened again on any device

## Included three-channel test score

The editor opens with **Highland Sanctuary**, an original Highland pipe-and-cathedral-style test arrangement. Its three channels use Roncadora, Male Chorus, and Tuba, and its opening ornaments exercise 1/64 timing. The reusable MML is in `examples/highland-sanctuary-3-channel.mml`.

## Third-party audio

MabiScore includes SpessaSynth and the MabiMML high-quality instrument SoundFont. See `THIRD_PARTY_NOTICES.md` and the license files beside those assets.

## Mobile conversion artifacts

`node scripts/convert-midi-with-app.cjs input.mid output.mml` uses the same converter as the browser. It writes the complete combined score, an editable `.mabiscore.json` draft, and a `.report.json` with actual field mapping, character counts, timing errors, omissions, and finale notes. Existing outputs are never overwritten. Over-limit scores are preserved for editing, not certified as paste-ready.
