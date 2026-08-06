# MabiScore

A responsive Mabinogi MML piano-roll composer built as one self-contained HTML file.

## Use it locally

Open `index.html` in a modern browser. No installation, Node.js, package manager, build command, or local server is required.

## Edit it

Everything is inside `index.html`:

- Page structure is ordinary HTML.
- Visual styles are inside the `<style>` element.
- Application behavior is inside the `<script>` element.

The favicon and social sharing image remain separate static assets.

## Publish it

GitHub Pages publishes the root of the `main` branch directly. Push an updated `index.html` to `main` and GitHub will refresh the site automatically.

Live site: <https://realdenniswong.github.io/MabiScore/>

## Features

- Draw, select, drag, and delete notes on a touch-friendly piano roll
- Choose tempo, grid snapping, and new-note length
- Import single- or multi-part Mabinogi MML
- Import standard MIDI files and split polyphony into exportable voices
- Preview playback in the browser
- Export any selection of monophonic tracks as `MML@...;`
- Save a local draft in browser storage
