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

- Draw, audition, select, drag, freely resize, and delete notes on a touch-friendly piano roll
- See every track layered in the piano roll, with the active track emphasized and faded notes clickable for quick track switching
- Choose a custom color for each track; its stripe, active indicator, and every layered note update together
- Zoom the score timeline with the ruler wheel, trackpad or touchscreen pinch, or the accessible zoom buttons while keeping the musical position under the gesture and preventing whole-page zoom
- Choose a Mabinogi instrument per track with the high-quality MabiMML SoundFont
- Set an independent MML `V0`–`V15` volume for every track
- Choose tempo and grid snapping from a practical 1/16 default down to 1/64 fine timing, with half-beat movement and freely resizable note lengths
- Import single- or multi-part Mabinogi MML
- Import standard MIDI files, preserve low notes down to C1, split polyphony into non-empty exportable voices, use Piano as the broad-range default, and expand the grid to the full song length with a trailing blank bar
- Preview piano keys, placed notes, and full-score playback in the browser, with per-track mute/unmute that takes effect immediately during playback
- Export any selection of monophonic tracks as `MML@...;`
- Save a local draft in browser storage

## Included three-channel test score

The editor opens with **Highland Sanctuary**, an original Highland pipe-and-cathedral-style test arrangement. Its three channels use Roncadora, Male Chorus, and Tuba, and its opening ornaments exercise 1/64 timing. The reusable MML is in `examples/highland-sanctuary-3-channel.mml`.

## Third-party audio

MabiScore includes SpessaSynth and the MabiMML high-quality instrument SoundFont. See `THIRD_PARTY_NOTICES.md` and the license files beside those assets.
