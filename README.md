# MabiScore

A responsive Mabinogi MML piano-roll composer built with framework-free HTML, CSS, and JavaScript.

## Use it locally

Open `index.html` in a modern browser. No installation, Node.js, package manager, or build command is required. On first playback, direct `file://` use downloads the audio worklet and Mabinogi SoundFont over HTTPS; the GitHub Pages version serves the same assets from the repository.

## Edit it

The interface and application code are primarily inside `index.html`:

- Page structure is ordinary HTML.
- Visual styles are inside the `<style>` element.
- Application behavior is inside the `<script>` element.
- `score-engraver.js` builds the editable grand-staff notation using the locally bundled VexFlow runtime.
- `mobile-converter.js` handles the three-part Mobile arrangement and export.

The favicon, social sharing image, SpessaSynth runtime, audio worklet, and Mabinogi SoundFont are separate static assets.

Run `npm ci` then `npm test` for arrangement, timing, independent MML-parser, MIDI regression, and existing staff-editor tests. Supplied MIDI regressions run when the three files are present in `MIDI_REGRESSION_DIR` (defaults to the original local Downloads folder); otherwise they are explicitly skipped. No copyrighted input files are committed.

The suite also opens the complete editor in an isolated DOM, engraves its actual SVG, and checks both typing layouts, note selection/deletion/Undo, note-property editing, automatic saving, and music-preservation regressions. This verifies application wiring without opening a browser; touch feel, responsive browser layout and audible playback still need real-device checks.

## Everyday editing

- **Select** (V) selects and moves notes. A click on empty space moves the playhead without creating a note. Use Shift/Command/Control-click, **Multi-select**, or **Box** for groups.
- **Draw** (N) adds notes at the chosen grid and length. In Score, the Length control is visible beside the accidental selector. Hovering over the staff previews the actual note symbol and shades its duration; a readout names the pitch, bar, starting beat, duration in beats and ending position, including ties across barlines. Click to place it. On touch screens, tap to preview, then choose **Place note** or **Cancel**; scrolling never places a note. The preview does not change the score or history. **Erase** (E) removes a tapped note. Delete/Backspace removes selected notes and leaves the timing of other notes intact. A visible **Undo** action restores a deletion.
- Selecting a note reveals its pitch, starting beat and musical length. Arrow keys move the selection in time or pitch; Shift+up/down transposes an octave. Escape clears the selection. Every edit supports Undo/Redo.
- **Keys** (Command/Control+K) opens an on-screen guide and touch keyboard. Choose **Piano keys** or **MML letters** in **Settings → Keyboard input**. Piano keys use A/S/D/F/G/H/J for C/D/E/F/G/A/B and W/E/T/Y/U for the five sharps; K is the next C. MML letters use C/D/E/F/G/A/B directly, followed by `=` or `+` for sharp, `-` for flat, or `0` for natural. `=` is the unshifted sharp shortcut because Shift+= raises the octave. Shift+- lowers the octave. Z/X and the octave buttons remain available in both layouts; R advances by one note length as a rest.
- **Settings** groups keyboard input, grid snapping, score spacing/other-track visibility, draft backups, track volume and advanced deletion of a time range. **Import…** groups MML, MIDI, Mobile conversion and opening a saved draft.
- Edits save automatically to this browser after a short pause and when leaving the page. **Save draft** downloads a portable backup. Automatic browser storage is local to that browser, not a cloud backup; storage failure keeps a visible warning and triggers a leave-page warning while work remains unsaved.
- **Score** renders a wrapping grand staff with clefs, 4/4 bars, chords, rests, duration-specific flags/beams, dots, ties and accidentals. Note spacing is independent of the roll zoom and adjustable in Settings or with the score zoom buttons. Its click targets edit the same note objects as the roll. This version uses 4/4 throughout; it does not infer key or time signatures from MIDI. Fractional note boundaries are rounded to 1/64 for notation only, with a visible notice; source timing remains available to Mobile playback and export.
- Every score system has an always-visible beat ruler with subdivision marks. The orange playhead names the current bar, beat and elapsed time, and the same readout stays visible in the score toolbar. Times account for tempo changes. Click a beat number or a snapped position between beats to move the playhead; active playback resumes at that position. The ruler is available in Select, Draw and keyboard-entry modes and does not add notes.

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
- Import standard MIDI files, preserve the full MIDI pitch range (0–127) in the editor, split polyphony into non-empty exportable voices, use Piano as the broad-range default, and expand the grid to the full song length with a trailing blank bar. Imported tempo maps are used by ordinary playback and export. Notes below C0 remain editable and playable; ordinary MML export asks for transposition because its notation cannot represent those pitches.
- Use **MIDI → 3 MML** for an instrument-neutral Mobile arrangement with exactly three voices. Phrase continuity, instrument family, register, repeated motifs, dynamics, and ending material guide melody/harmony/bass selection across source tracks. Repeated attacks can shorten overlapping sustains; rests are not automatically filled with invented holds. Orchestral duplicates and percussion are reduced, and no song is truncated to fit. Lossless notation compression is always enabled: it chooses default note lengths across rhythmic sections and shorter octave commands while preserving attacks, pitches, timing, dynamics, and tempo changes. The export displays the character savings. **Simplify accompaniment to fit 2,400 characters** is opt-in because deleting notes changes the arrangement. When enabled, accompaniment is simplified in four-bar phrases while the complete selected main melody is protected. If that melody still exceeds the limit, split or edit the song; it is never automatically deleted to fit. The full timeline and protected closing notes remain; removal counts are shown and the preview plays the reduced export.
- Polyphonic piano and guitar conversion protects held tones, recognizes staggered chord attacks, and uses phrase register to keep low accompaniment out of the tune. Concurrent piano/guitar tracks with distinct upper/lower registers are recognized as melody and accompaniment sources so busy left-hand arpeggios do not take over the tune. A source selector can override the automatic melody choice immediately after MIDI import. Rhythm tidying is enabled by default: sufficiently consistent, metrical passages can have repeated short key releases restored to standard note lengths. It estimates the ratio per source and requires local phrase support; it is a musical edit, not lossless compression. Disable it to retain raw articulation. Once the score is edited or restored, re-import to change source settings. Suspicious melody transitions show review bar numbers. This is a deterministic reduction; ambiguous voice crossings can still need manual editing. The Mobile export offers an opt-in middle-accompaniment delay (nearest supported duration), optional melody placement in **Harmony 2**, opt-in tempo flattening with a selectable playback BPM (original tempo map by default), three individually copyable game fields, character-limit warnings, and a piano audition decoded from the exported MML. Read [Mobile compatibility research and limits](docs/mobile-compatibility.md).
- Preview piano keys, placed notes, aligned notes from every unmuted track when creating a note, and full-score playback in the browser, with live per-track mute/unmute
- Switch between the piano roll and an engraved, editable grand staff, with wider spacing and wrapping systems. Draw mode supports natural, sharp and flat note entry; selection edits the same track data used for playback, Undo/Redo, project saves and MML export.
- Turn on Musical Typing with `Cmd/Ctrl+K`, choose Piano keys or MML letters, and change octave with the existing Z/X keys or octave buttons, or Shift+= / Shift+-; step input advances the playhead by the selected note length.
- Copy, cut, and paste selected notes with `Cmd/Ctrl+C`, `Cmd/Ctrl+X`, and `Cmd/Ctrl+V`; timing and pitch relationships are preserved, paste starts at the playhead, and repeated paste builds consecutive loops
- Undo and redo all score-editing actions, including notes, tracks, imports, merge, names, colors, instruments, volume, tempo, and note settings
- Export any selection of monophonic tracks as `MML@...;`
- Save a local browser draft and download a portable `.mabiscore.json` backup that can be opened again on any device

## Included three-channel test score

The editor opens with **Highland Sanctuary**, an original Highland pipe-and-cathedral-style test arrangement. Its three channels use Roncadora, Male Chorus, and Tuba, and its opening ornaments exercise 1/64 timing. The reusable MML is in `examples/highland-sanctuary-3-channel.mml`.

## Third-party audio

MabiScore includes SpessaSynth and the MabiMML high-quality instrument SoundFont. See `THIRD_PARTY_NOTICES.md` and the license files beside those assets.

## Mobile conversion artifacts

`node scripts/convert-midi-with-app.cjs input.mid output.mml` uses the same converter as the browser. It writes the complete combined score, an editable `.mabiscore.json` draft, and a `.report.json` with actual field mapping, character counts, timing errors, omissions, and finale notes. Add `--fit-limit` to allow phrase-based accompaniment reduction. The selected main melody remains protected even if it exceeds the limit. Add `--raw-rhythm` to retain the original articulation, or `--melody-source=track:channel` to choose a source key from the report. The report includes inferred rhythm changes and melody continuity review points. Existing outputs are never overwritten. Over-limit scores are preserved for editing, not certified as paste-ready.

### AI-assisted MIDI melody arrangement

After **MIDI → 3 MML**, open **AI arrangement settings** in Export and click **Analyze melody with AI**. The AI selects a melody source for each four-bar phrase; the existing arranger generates all three voices and the exporter performs its normal compression and validation. Preview before copying. A manual melody source overrides the AI plan; **Use automatic arrangement** removes it. Edited/restored scores require re-import before changing the arrangement.

Each visitor supplies their own API key under **AI arrangement settings**. Requests go directly from their browser to the configured HTTPS provider and use their account’s quota. Defaults are `https://tianyuai.lol/v1/responses`, model `gpt-6.1-sol`, Responses protocol. There is no backend or shared owner key. MabiScore does not read ChatBot credentials or persist AI settings/keys in browser storage, drafts, exports, or history. The key remains in memory for the current page session; **Clear API key**, reloading, or leaving the page clears it. Provider browser/CORS support is required. The person using the browser can inspect their own key in requests.

Clicking Analyze sends bounded musical summaries (source identifiers, programs, registers, density, and sampled notes) to the configured provider. It does not send the MIDI file or filename. Plans must cover every supplied phrase and reference available sources. Invalid responses leave the arrangement unchanged; requests can be cancelled and time out after two minutes. Scores changed during analysis are protected from stale results. This first AI layer selects melody sources; harmony/bass selection and character-budget reduction remain deterministic. Analysis supports up to 512 nonempty four-bar phrases.
