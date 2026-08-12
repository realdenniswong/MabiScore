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
- Import one-part MML into the selected track—with or without an `MML@...;` wrapper—or replace the full score with multi-track `MML@...;`; dotted lengths, per-note volume changes, and tempo automation inside each track are preserved on export
- Import standard MIDI files, preserve low notes down to C1, split polyphony into non-empty exportable voices, use Piano as the broad-range default, and expand the grid to the full song length with a trailing blank bar
- Preview piano keys, placed notes, aligned notes from every unmuted track when creating a note, and full-score playback in the browser, with live per-track mute/unmute
- Undo and redo all score-editing actions, including notes, tracks, imports, merge, names, colors, instruments, volume, tempo, and note settings
- Export any selection of monophonic tracks as `MML@...;`
- Save a local draft in browser storage

## Included three-channel test score

The editor opens with **Highland Sanctuary**, an original Highland pipe-and-cathedral-style test arrangement. Its three channels use Roncadora, Male Chorus, and Tuba, and its opening ornaments exercise 1/64 timing. The reusable MML is in `examples/highland-sanctuary-3-channel.mml`.

## Third-party audio

MabiScore includes SpessaSynth and the MabiMML high-quality instrument SoundFont. See `THIRD_PARTY_NOTICES.md` and the license files beside those assets.
