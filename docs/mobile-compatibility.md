# Mabinogi Mobile conversion notes

Research checked 2026-09-21. This targets **Mabinogi Mobile**, with three instrument-neutral voices; piano is only the browser preview sound. It does not assume PC Mabinogi limits, instrument tuning, or playback semantics.

## Evidence and limits

- **Official:** Nexon's [Mobile composition guide](https://mabinogimobile.nexon.com/Info/Guide/2751071) specifies three initial fields, expandable to six, and **2,400 MML characters per field**. The [December 18, 2025 update](https://mabinogimobile.nexon.com/News/Update/3311104) increased the former 1,200-character limit. The converter checks each field separately, excluding the combined `MML@` wrapper and commas. The optional Fit setting first compresses notation losslessly, then simplifies accompaniment by phrase while protecting the complete selected main melody, full duration and closing notes. Over-limit fields are marked and copy/download is blocked if the protected score still cannot fit. No automatic cut or split occurs. Fit is off by default; enable it to request accompaniment simplification.
- **First-hand community tests, not a publisher specification:** [Mobile MML analysis, March 30, 2025](https://gall.dcinside.com/mgallery/board/view/?id=mml&no=463) reports triplets and 96 MIDI ticks per quarter, intermittent missing notes, and problems with multiple tempos.
- **First-hand community tests, potentially outdated:** [Edgestorm's Mobile analysis, April 8, 2025, subsequently edited](https://edgestorm.tistory.com/513) reports tempo/voice-allocation problems and unreliable harmony ties. Its original restrictive length claim is crossed out. The exporter uses ordinary letter notes, sharps, octave commands, `t`, `v`, `l`, rests, dotted binary values and triplet values through 64. It avoids numeric-note and exotic compression. Ties remain necessary for exact long sustains and duration sums; exports containing harmony ties carry a specific warning. Removing them would change repeated attacks. **No in-game verification has been performed.**
- **Requested community workarounds:** approximately 20 ms accompaniment staggering and putting the main melody in Harmony 2 are exposed and labeled as community workarounds. The exact delay and slot advantage could not be independently established from current publisher documentation or the first-hand sources above. They are not represented as confirmed fixes.
- **Piano range remains unverified:** the official Mobile guide does not publish a piano-specific playable or sounding range. MIDI pitches are retained without PC-style octave transposition, folding, or silent range deletion; the actual exported MIDI pitch span appears in the warning report. Browser SoundFont playback does not establish Mobile's sounding octave or instrument limits. Notes outside the existing editor's C1–B6 grid remain in Mobile exports but may be off-screen in the piano roll. Ordinary all-voice MIDI import keeps its existing editor-range behavior.

## Arrangement

Source tracks/channels are grouped across program changes. A bounded dynamic-programming path uses instrument family, local monophony, register, repeated interval motifs, velocity, duration, pitch continuity, and source continuity. Switching sources is cheaper at phrase starts and after rests. Every passage is processed; ending material receives additional weight. The resulting melody can move between instruments. Bass is selected next, then supporting harmony/countermelody from unused notes. Synchronized upper octave doublings are removed from harmony while retaining the bass foundation. GM timpani, unpitched percussion, sound effects and channel-10 drums are excluded from the piano reduction.

Polyphony is measured for every instrument family, including synths and strings. Chordal sources receive duration-weighted note scores, including opening/ending rewards, and a duration-scaled source-continuity bonus. This prevents fast chord attacks from accumulating the large per-note rewards intended for a monophonic tune. The separate piano/guitar held-note protection remains in place; monophonic instrument handoffs keep their original continuity scoring.

Selection is heuristic, not semantic theme recognition. Dense scores necessarily lose notes. Inspect important responses and climaxes by ear. Concurrent piano/guitar sources with clearly separated registers are classified as upper tune and lower accompaniment; a busy lower track is excluded from automatic melody selection. Other instrument handoffs remain available. The import export panel lets the user choose a melody source explicitly; suspicious large leaps and source switches show bar numbers for review. Source controls are disabled after edits or project restoration to avoid replacing those edits; re-import to change them.

Rhythm tidying is enabled by default for piano/guitar sources. It requires at least 16 eligible notes, 95% onset alignment to a supported grid, and a dominant key-length ratio (80%, 85%, 90% or 95%) matching at least 85% of eligible notes with a clear margin over exact note values and competing ratios. Each four-bar phrase additionally needs eight samples and 85% local support. Only matching notes are normalized; exact note values, inconsistent sections, off-grid attacks and staggered rolls remain intact. Endpoints never extend beyond the original song timeline. This changes articulation and sometimes onsets, and can misinterpret deliberate uniform staccato. The checkbox can be disabled to retain raw timing; note counts, inferred gates and overlap shortening are reported separately from export quantization. The selected melody is still a three-voice reduction, not a guarantee that every source theme was recognized. No replacement pitches or passages are generated.

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

Off by default in the browser. Lossless compression always runs first and can change default lengths across rhythmic sections without changing the arranged notes. If requested and still necessary, accompaniment reduction works within four-bar phrases, progressively retaining a regular rhythmic skeleton and one strong anchor per bar. The first note and final eight accompaniment notes are protected. Retained notes keep their pitch, onset, duration and volume; removed notes become silence and the common endpoint is unchanged. Only phrase reductions that actually save characters are accepted.

The entire selected melody is protected from capacity deletion. A melody over 2,400 characters is reported intact and copy/download remains blocked until it is split or edited. Accompaniment with too much protected material can also remain over limit. This favors musical continuity over claiming that every song fits automatically.

The report lists removal counts and simplified phrases per field. More than 30% removed triggers a substantial-reduction warning. Audition, export and validation all use the fitted score. Source notes remain untouched so fitting is reversible.

The following results describe the earlier per-note fitter and are retained as historical observations, not current guarantees:

With the original tempo map and default compatibility settings, the supplied files fit as follows (Melody / Harmony 1 / Harmony 2):

| File | Characters | Notes removed for capacity |
| --- | --- | --- |
| 1812 Overture | 2391 / 1660 / 2389 | 11 / 0 / 50 |
| From the Start | 1160 / 2398 / 1212 | 0 / 40 / 0 |
| Yankee Doodle Dandy | 2392 / 2398 / 2391 | 38 / 115 / 392 |

Yankee needs substantial thinning, so its arrangement will sound noticeably sparser. The regression suite checks capacity, unchanged ending notes and duration, and independently parses the flattened fitted outputs. Earlier tables above describe the full unfitted outputs.

## Autumn Tale regression (2026-10-11)

The updated default arrangement of the supplied `autumn_tale.mid` selects its upper piano source for melody and keeps more than 400 lower-hand notes in accompaniment. Rhythm inference identifies 80% and 90% gates without source-specific track rules. The three fields contain 1,186 / 883 / 1,262 characters with the default Harmony 2 melody placement; none needs capacity deletion. All three end at 160 seconds at 96 BPM. The regression checks the source selection, unchanged input, field lengths, duration, and independent parsing of pitches, attacks and note durations. Disabling rhythm tidying retains raw articulation while keeping the improved source selection. These are structural checks, not an in-game or listening evaluation.

## Crocodile Rock investigation (2026-10-18)

The supplied MIDI is a format-1 file with two source tracks, 384 ticks per quarter, 796 notes, and a source tempo of approximately 37 BPM. A separate MIDI event reader confirms these values and the 36.081-second endpoint. Electric piano contains the low foundation and chords; Synth Pluck contains repeated upper chords. The previous piano/guitar-only polyphony scoring treated the synth as monophonic, rewarding every short attack and source-continuity transition. Consequently 102 of 128 selected bass-part notes came from the synth; at source tick 24 the bass jumped to pitch 62 instead of the simultaneous piano pitch 31. All three voices followed the upper chord rhythm. Neither rhythm tidying nor capacity fitting altered notes in this file, and export quantization error was zero.

The instrument-independent polyphony scoring fix keeps all 111 selected bass notes in the piano source, and 90 of 104 harmony notes also come from piano. The default fields contain 245 / 245 / 208 characters, remain 36.081 seconds long, and need no capacity fitting. Synthetic and supplied-file regressions verify the bass foundation, source immutability, independent MML parsing, and unchanged timing. This corrects a demonstrated selection error; it does not establish audible fidelity or diagnose clipping/static in a particular browser or game session.
