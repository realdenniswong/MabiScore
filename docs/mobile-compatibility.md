# Mabinogi Mobile conversion notes

Research checked 2026-09-21. This targets **Mabinogi Mobile**, with three instrument-neutral voices; piano is only the browser preview sound. It does not assume PC Mabinogi limits, instrument tuning, or playback semantics.

## Evidence and limits

- **Official:** Nexon's [Mobile composition guide](https://mabinogimobile.nexon.com/Info/Guide/2751071) specifies three initial fields, expandable to six, and **2,400 MML characters per field**. The [December 18, 2025 update](https://mabinogimobile.nexon.com/News/Update/3311104) increased the former 1,200-character limit. The converter checks each field separately, excluding the combined `MML@` wrapper and commas. The default Fit option first compresses notation losslessly, then removes lower-priority notes while preserving full duration and protected ending material. Over-limit fields are marked and copy/download is blocked if the protected score still cannot fit. No automatic cut or split occurs. Disable Fit to inspect the unreduced export.
- **First-hand community tests, not a publisher specification:** [Mobile MML analysis, March 30, 2025](https://gall.dcinside.com/mgallery/board/view/?id=mml&no=463) reports triplets and 96 MIDI ticks per quarter, intermittent missing notes, and problems with multiple tempos.
- **First-hand community tests, potentially outdated:** [Edgestorm's Mobile analysis, April 8, 2025, subsequently edited](https://edgestorm.tistory.com/513) reports tempo/voice-allocation problems and unreliable harmony ties. Its original restrictive length claim is crossed out. The exporter uses ordinary letter notes, sharps, octave commands, `t`, `v`, `l`, rests, dotted binary values and triplet values through 64. It avoids numeric-note and exotic compression. Ties remain necessary for exact long sustains and duration sums; exports containing harmony ties carry a specific warning. Removing them would change repeated attacks. **No in-game verification has been performed.**
- **Requested community workarounds:** approximately 20 ms accompaniment staggering and putting the main melody in Harmony 2 are exposed and labeled as community workarounds. The exact delay and slot advantage could not be independently established from current publisher documentation or the first-hand sources above. They are not represented as confirmed fixes.
- **Piano range remains unverified:** the official Mobile guide does not publish a piano-specific playable or sounding range. MIDI pitches are retained without PC-style octave transposition, folding, or silent range deletion; the actual exported MIDI pitch span appears in the warning report. Browser SoundFont playback does not establish Mobile's sounding octave or instrument limits. Notes outside the existing editor's C1–B6 grid remain in Mobile exports but may be off-screen in the piano roll. Ordinary all-voice MIDI import keeps its existing editor-range behavior.

## Arrangement

Source tracks/channels are grouped across program changes. A bounded dynamic-programming path uses instrument family, local monophony, register, repeated interval motifs, velocity, duration, pitch continuity, and source continuity. Switching sources is cheaper at phrase starts and after rests. Every passage is processed; ending material receives additional weight. The resulting melody can move between instruments. Bass is selected next, then supporting harmony/countermelody from unused notes. Synchronized upper octave doublings are removed from harmony while retaining the bass foundation. GM timpani, unpitched percussion, sound effects and channel-10 drums are excluded from the piano reduction.

Selection is heuristic, not semantic theme recognition. Dense scores necessarily lose notes. Inspect important responses and climaxes by ear. Selected pitches and attacks remain source-derived; overlapping notes in one phrase may be shortened to preserve the following attack. The reduction never synthesizes replacement passages, sustains across source rests, or cuts a finale for capacity. Optional capacity fitting can remove additional notes, as described below.

The MIDI reader retains raw onset/ending precision and fractional BPM before export quantization, supports sustain-pedal releases and repeated attacks, and closes unterminated notes at the track boundary. Pitch bends, expression controllers, alternate timebases, and asynchronous format-2 songs are not rendered as new pitches. Format 2 and SMPTE timing are rejected explicitly.

## Timing and synchronization

The default export retains the original tempo map, rounding BPM values to supported integers. Optional tempo flattening integrates the entire original tempo map into absolute seconds, then converts both boundaries of every note/rest to a user-selected constant playback BPM (initially the source BPM). 180 BPM is not required. A note spanning several tempos uses the full integral. This preserves ending slowdowns. All three fields declare tempo, octave, volume and default length explicitly.

The internal export grid is 48 ticks per quarter. A quarter is 48, an eighth-note triplet 16, and a 1/64 note 3 ticks. Allowed duration sums must be positive and representable by the supported binary/dotted/triplet tokens. Absolute boundaries are rounded and moved to nearby representable positions; rounding never accumulates from one phrase into the next. Ordinary quantization adjustments are checked against **six ticks (41.67 ms at 180 BPM)**. Start, duration and ending adjustments are measured, not assumed. Larger discrepancies remain visible warnings rather than claims of timing fidelity. Collision shortening is an intentional arrangement change and reported separately from quantization error. The shared final cursor is rounded to the nearest 12 ticks: total elapsed duration differs from the source by at most six ticks, except for explicitly warned incompatibilities.

Compatibility mode targets 20 ms at the local playback tempo, with a minimum of three ticks / one 1/64 note (20.833 ms at 180 BPM, 31.25 ms at 120 BPM, 62.5 ms at 60 BPM). The actual delay range is displayed, and slow-tempo limitations are warned. It delays each middle-accompaniment attack, leaving its nominal end at the original absolute time. This shortens its sustain and redistributes rests instead of repeatedly inserting delays. Very short notes may need a representable duration adjustment; that is counted. It does not delay the melody or change the common end. Pitch collisions are checked *after* timing changes: melody wins, then bass. A lower-priority note is shortened before the collision or omitted if it cannot be retained without a new attack. There are no synthetic resume notes.

The default mode retains explicit tempo events in every field and splits held notes with ties at tempo boundaries. Unrepresentable splits block that export with an explanation; constant tempo remains available. Mobile synchronization with tempo changes is unverified and warned. Browser audition interprets each field's actual tempo commands.

Default paste order: **Melody = bass, Harmony 1 = accompaniment, Harmony 2 = main melody**. Disabling Harmony 2 placement gives Melody = main melody, Harmony 1 = accompaniment, Harmony 2 = bass. Labels always describe the actual game fields, not just the musical roles.

## Validation and preview

The exporter decodes its actual strings, checks pitches, attack count and positions, held durations, silence intervals, tempo boundaries, monophony, overlapping unisons, and shared endings against the intended export arrangement. A failed check blocks export. The source-to-arrangement changes and the quantization report are separate from this exact round-trip check.

**Audition combined MML** and **Audition part** parse those same strings and schedule the existing piano SoundFont, including rests and tempo changes. If the SoundFont cannot load, the UI announces a synthetic fallback. Neither audio path models Mobile's voice stealing, envelopes, octave mapping, or bugs, so the preview cannot guarantee identical in-game playback.

Tests also use the independent MIT-licensed [mml-iterator](https://github.com/mohayonao/mml-iterator) parser. A test-only adapter changes Mabinogi's `&pitch[length]` to that parser's `^length` tie dialect, explicitly supplying the default length. It shares no exporter duration decomposition. Tests compare independent pitch, attack time, duration and final elapsed time. Its tie grammar cannot represent a tempo command inside a tie, so that case is checked by the strict round-trip parser and dedicated expected timing assertions; independent variable-tempo tests cover changes between attacks. This is additional parser evidence, not a Mobile emulator.

## Supplied-file regression results

The following historical results use the explicit 180 BPM flattened setting; default exports now preserve the source tempo map. All three user-provided files were tested locally. Complete MML, editable drafts and per-note ending reports are in `exports/mobile/` (local outputs, not committed).

| MIDI | Source / exported seconds | Maximum quantization adjustment | Melody / Harmony 1 / Harmony 2 characters |
| --- | --- | --- | --- |
| 1812 Overture | 66.5787 / 66.5833 | 19.87 ms | 2817 / 1898 / 3289 |
| Laufey – From The Start | 172.8008 / 172.8333 | 16.67 ms | 4632 / 2988 / 4632 |
| Yankee Doodle Dandy | 118.9394 / 118.9167 | 29.72 ms | 3076 / 4321 / 6756 |

All exceed at least one field's verified 2,400-character limit; none was truncated. For 1812, the last violin run is checked against the source pitches **75, 77, 79, 80, 82, 84, 86, 87**, followed by the final three **63** attacks. The final main-melody hold remains approximately four seconds under the ending slowdown. This verifies source-derived note retention and timing, not human recognition or successful in-game performance.

Browser checks covered local MIDI import, current field labels, switching the melody slot, disabling the offset, combined and solo SoundFont auditions, and stopping playback. No browser errors were observed in these flows. The existing staff-editor regression tests also pass.

## Equal volume boost

The optional **Boost volumes equally so the loudest reaches V15** checkbox finds the highest sounding MML volume across all three exported parts, including per-note dynamics, then adds `15 - highest` to every note's volume. For example, V8/V9/V10 becomes V13/V14/V15. Existing V15 peaks leave no headroom, so the offset is zero. Preview and copy/export use the same boosted score; the editable source is unchanged. The export summary shows the applied offset.

## Fit each part to 2,400 characters

Enabled by default in the browser. The lossless first pass chooses a compact default note length and relative octave commands; pitches, attacks, dynamics, rests and tempo are unchanged. If necessary, the fitter removes lower-salience notes from each over-limit part, prioritizing quiet/short interior notes over phrase starts, motifs, strong beats, and one anchor per bar. The opening note and last 16 melody notes / 8 accompaniment notes are protected. Every retained note keeps its pitch, onset, duration and volume; removed notes become silence and the common endpoint is unchanged. Only deletions that actually save characters are accepted.

The report lists removals per game field. More than 30% removed triggers an explicit substantial-reduction warning. This is a heuristic arrangement, not a promise of identical sound or a globally optimal solution. Particularly long protected passages can still exceed the limit; copy/download is then disabled instead of deleting the ending. Exported MML, audition and round-trip validation all use the fitted score. The editable source remains untouched so fitting is reversible.

With the original tempo map and default compatibility settings, the supplied files fit as follows (Melody / Harmony 1 / Harmony 2):

| File | Characters | Notes removed for capacity |
| --- | --- | --- |
| 1812 Overture | 2391 / 1660 / 2389 | 11 / 0 / 50 |
| From the Start | 1160 / 2398 / 1212 | 0 / 40 / 0 |
| Yankee Doodle Dandy | 2392 / 2398 / 2391 | 38 / 115 / 392 |

Yankee needs substantial thinning, so its arrangement will sound noticeably sparser. The regression suite checks capacity, unchanged ending notes and duration, and independently parses the flattened fitted outputs. Earlier tables above describe the full unfitted outputs.
