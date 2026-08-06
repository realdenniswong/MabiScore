# MabiScore

A responsive Mabinogi MML piano-roll composer built with plain HTML, CSS, and JavaScript.

## Features

- Draw, select, drag, and delete notes on a touch-friendly piano roll
- Choose tempo, grid snapping, and new-note length
- Import single- or multi-part Mabinogi MML
- Import standard MIDI files and split polyphony into exportable voices
- Preview playback in the browser
- Export any selection of monophonic tracks as `MML@...;`
- Save a local draft in browser storage

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Live sites

- GitHub Pages: <https://realdenniswong.github.io/MabiScore/>
- Codex Sites: <https://mabiscore-mml-composer.realdenniswong.chatgpt.site>

Every push to `main` automatically refreshes the GitHub Pages deployment.

## Implementation

The application has no React, Vue, TypeScript, or runtime UI dependency. The app lives in `index.html`, `main.js`, and `app/globals.css`; Vite is used only as the development server and production bundler.
