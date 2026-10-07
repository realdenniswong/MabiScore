const fs = require('node:fs');
const path = require('node:path');
const { parseMidi } = require('./load-app.cjs');
const MobileMml = require('../mobile-converter.js');
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath || !/\.mml$/i.test(outputPath)) throw new Error('Usage: node scripts/convert-midi-with-app.cjs input.mid output.mml');
const draftPath = outputPath.replace(/\.mml$/i, '.mabiscore.json');
const reportPath = outputPath.replace(/\.mml$/i, '.report.json');
for (const file of [outputPath, draftPath, reportPath]) if (fs.existsSync(file)) throw new Error(`Output already exists: ${file}`);
const parsed = parseMidi(fs.readFileSync(inputPath));
const tempo = parsed.tempo || 120;
const arrangement = MobileMml.arrange(parsed.tracks, tempo, parsed.tempoEvents);
const result = MobileMml.convert(arrangement.tracks, tempo, { fitLimit: process.argv.includes('--fit-limit') });
const report = {
  source: path.basename(inputPath), sourceVoices: parsed.tracks.length,
  sourceNotes: parsed.tracks.reduce((s,t)=>s+t.notes.length,0),
  sourceDuration: result.sourceDuration, exportedDuration: result.duration,
  maximumTimingAdjustmentMs: result.maxTimingErrorMs,
  collisionShorteningMs: result.collisionShorteningMs,
  fields: result.fields, characterCounts: result.counts, overLimit: result.overLimit, capacityFitting: result.fitting,
  omittedSourceNotes: arrangement.omittedNotes, omittedPercussion: arrangement.omittedPercussion,
  shortenedSourceOverlaps: arrangement.changes.shortened,
  sourceRoles: arrangement.roleSources, validation: result.validation, warnings: result.warnings,
  ending: result.tracks.map(t=>({role:t.sourceRole,notes:t.notes.slice(-16).map(n=>({pitch:n.pitch,startSeconds:n.start/48*60/result.tempo,durationSeconds:n.duration/48*60/result.tempo,sourceStart:n.sourceStart,sourceDuration:n.sourceDuration}))})),
};
const project={format:'mabiscore-project',version:1,tracks:arrangement.tracks,activeTrackId:arrangement.tracks[0].id,tempo,name:path.basename(inputPath).replace(/\.(mid|midi)$/i,''),snap:4,noteDuration:16,timingResolution:64};
fs.writeFileSync(outputPath, result.mml+'\n',{flag:'wx'});
fs.writeFileSync(draftPath, JSON.stringify(project,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(reportPath, JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,outputPath,draftPath,reportPath},null,2));
