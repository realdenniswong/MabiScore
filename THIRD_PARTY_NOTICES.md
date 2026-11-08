# Third-party notices

## MabiMML instrument SoundFont

`soundfonts/mabi_instruments_high_quality.sf3` and the instrument program mapping are sourced from [Daderic/MabiMML](https://github.com/Daderic/MabiMML), copyright Daderic and distributed under the MIT License. The complete notice is in `soundfonts/LICENSE-MabiMML.txt`.

## SpessaSynth

`vendor/spessasynth.min.js` and `vendor/worklet_processor.min.js` are built from `spessasynth_lib` 3.24.0. SpessaSynth is distributed under its MIT and Apache-2.0 licensing terms. The package license is in `vendor/LICENSE-spessasynth.txt`.

## Independent regression parser

The development-only `mml-iterator` 1.1.0 package by mohayonao is MIT-licensed and installed through `npm ci`. It is used to cross-check exported notes and elapsed timing in tests; it is not shipped in the browser bundle. Its license is included in the installed package.

## VexFlow

`vendor/vexflow-bravura.js` is the VexFlow 4.2.5 Bravura build, used to engrave the editable grand staff. It is bundled locally so notation works without a CDN. VexFlow is copyright Mohit Muthanna Cheppudira and contributors and distributed under the MIT License; the complete notice is in `vendor/LICENSE-vexflow.txt`. The matching pinned development package supplies the same runtime for verification.

## Editor verification

The development-only `jsdom` and `@napi-rs/canvas` packages run complete editor workflows and render score previews without a browser or audio device. Their licenses are included in their installed packages; neither is shipped to the web app.
