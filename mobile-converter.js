/* Mobile arrangement and round-trip validation. No DOM or audio dependencies. */
(function(root) {
  'use strict';
  const PPQ = 48, WHOLE = 192, LIMIT = 2400;
  const fields = ['Melody', 'Harmony 1', 'Harmony 2'];
  const names = ['c','c+','d','d+','e','f','f+','g','g+','a','a+','b'];
  const legal = n => n === 0 || n === 3 || n === 4 || n >= 6;
  const endOf = notes => notes.reduce((v,n) => Math.max(v,n.start+n.duration),0);
  const overlap = (a,b) => a.start < b.start+b.duration-1e-8 && b.start < a.start+a.duration-1e-8;
  function timeline(events, fallback=120) {
    const sorted = [{tick:0,tempo:120}, ...events].sort((a,b)=>a.tick-b.tick);
    if (!events.length) sorted[0].tempo = fallback;
    return tick => {
      let seconds=0, at=0, bpm=120;
      for (const e of sorted) {
        if (e.tick>tick) break;
        seconds += (e.tick-at)/16*60/bpm;
        at=e.tick; bpm=e.tempo;
      }
      return seconds+(tick-at)/16*60/bpm;
    };
  }
  function arrange(imported, tempo=120, tempoEvents=[]) {
    const pitched=imported.filter(t=>t.midiChannel!==9 && t.instrument!=='Drum Kit' && ![47,115,116,117,118,119,120,121,122,123,124,125,126,127].includes(t.midiProgram));
    if (!pitched.length) throw new Error('This MIDI contains percussion only; a pitched piano arrangement needs pitched notes.');
    const groups=new Map();
    pitched.forEach((t,i)=>{
      const key=t.midiGroupKey ? t.midiGroupKey.split(':').slice(0,2).join(':') : `${t.midiSource??i}:${t.midiChannel??0}`;
      if (!groups.has(key)) groups.set(key,{key,name:t.name||key,program:t.midiProgram||0,notes:[]});
      t.notes.forEach(n=>groups.get(key).notes.push({...n,start:n.rawStart??n.start,duration:n.rawDuration??n.duration,source:key,sourceId:n.id}));
    });
    const all=[...groups.values()].flatMap(g=>g.notes);
    const end=Math.max(endOf(all),...imported.map(t=>t.endTick||0)), used=new Set(), signatures=new Set();
    for (const g of groups.values()) {
      g.notes.sort((a,b)=>a.start-b.start||b.pitch-a.pitch);
      g.mean=g.notes.reduce((s,n)=>s+n.pitch,0)/g.notes.length;
      g.mono=new Set(g.notes.map(n=>n.start)).size/g.notes.length;
      g.family=Math.floor(g.program/8);
      const rolled = g.notes.some((n,i)=>g.notes.slice(i+1,i+4).some(p=>
        p.pitch!==n.pitch && p.start>n.start && p.start-n.start<=4 && n.start+n.duration-p.start>4));
      g.voiceAware=[0,3].includes(g.family) && (g.mono<.9 || rolled);
      // Repeated interval motifs carry more weight than one-off orchestral decoration.
      const motifs=new Map();
      g.notes.forEach((n,i)=>{const k=g.notes.slice(i,i+4).map((x,j,a)=>j?x.pitch-a[j-1].pitch:0).join(','); n.motif=k; motifs.set(k,(motifs.get(k)||0)+1);});
      g.notes.forEach((n,i)=>{n.motifWeight=Math.min(2,Math.log2(motifs.get(n.motif))); n.phraseStart=i===0||n.start-(g.notes[i-1].start+g.notes[i-1].duration)>4;});
    }
    const changes={shortened:0,doublings:0};
    function line(role) {
      const candidates=[];
      for(const g of groups.values()) for(const n of g.notes) {
        const sig=`${n.pitch}:${n.start}:${n.duration}`;
        if(used.has(n.sourceId)||signatures.has(sig)) continue;
        // Remove upper orchestral octave doublings, but never remove the bass foundation.
        if(role==='harmony' && melody.some(m=>m.source!==n.source && (m.pitch-n.pitch)%12===0 && Math.abs(m.start-n.start)<=1 && Math.abs(m.duration-n.duration)<=2)) {changes.doublings++;continue;}
        const register=role==='bass'?(72-n.pitch)/12:role==='melody'?(n.pitch-48)/24:1-Math.abs(n.pitch-60)/36;
        const family=role==='bass'?(g.family===4?4:0):role==='melody'?([5,6,7,8,9,10].includes(g.family)?2:g.family===4?-7:0):([0,3,6].includes(g.family)?2:0);
        const local=g.notes.filter(x=>Math.abs(x.start-n.start)<32);
        const localMono=new Set(local.map(x=>x.start)).size/local.length;
        // A polyphonic source is not a single musical voice. Restrict its tune
        // to the local upper register, including nearby held notes and rolls.
        // Monophonic sources retain their full range (including phrase handoffs).
        const polyphonic = g.voiceAware;
        const phrase = g.notes.filter(x=>Math.abs(x.start-n.start)<128).map(x=>x.pitch).sort((a,b)=>a-b);
        const upper = phrase[phrase.length-1];
        if(role==='melody' && polyphonic && n.pitch < upper-12) continue;
        const affinity=family+register+(role==='melody'?localMono*3:0) - (role==='bass'?Math.max(0,n.pitch-55)*.35:role==='melody'?Math.max(0,55-n.pitch)*.4:0);
        candidates.push({...n,affinity,voiceAware:g.voiceAware,score:g.voiceAware
          ? .5+(3+affinity+n.velocity/127+n.motifWeight*.35)*Math.min(8,n.duration/8)+(n.start>end-128?1:0)
          : 3+affinity+Math.min(2,n.duration/16)+n.velocity/127+n.motifWeight*.35+(n.start>end-128?1:0)});
      }
      candidates.sort((a,b)=>a.start-b.start||b.score-a.score);
      // Bounded dynamic programming follows coherent sources but permits phrase handoffs.
      const best=[], prev=[];
      for(let i=0;i<candidates.length;i++) {
        const n=candidates[i]; best[i]=n.score; prev[i]=-1;
        for(let j=Math.max(0,i-240);j<i;j++) {
          const p=candidates[j]; if(p.start>=n.start-1e-8) continue;
          const crossing=p.start+p.duration>n.start+1e-8;
          // Preserve held chord tones. Only repeated attacks or a tiny key-release
          // overlap may interrupt a note; another pitch in a roll may not.
          const overlapTicks=p.start+p.duration-n.start;
          if(crossing && (p.source!==n.source || n.start-p.start<1 ||
            (p.voiceAware && p.pitch!==n.pitch && overlapTicks>1))) continue;
          const gap=Math.max(0,n.start-p.start-p.duration);
          const continuity=p.source===n.source?(p.voiceAware?.5:2.8):n.phraseStart||gap>=4?.2:-2.8;
          const leap=Math.max(0,Math.abs(n.pitch-p.pitch)-7)*.13;
          const value=best[j]+n.score+continuity-leap-(crossing?1.2:0);
          if(value>best[i]) {best[i]=value;prev[i]=j;}
        }
      }
      let at=best.reduce((v,s,i)=>v<0||s>best[v]?i:v,-1), out=[];
      while(at>=0){out.push(candidates[at]);at=prev[at];} out.reverse();
      out=out.map((n,i)=>{
        const duration=Math.min(n.duration,out[i+1]?out[i+1].start-n.start:n.duration);
        if(duration<n.duration-1e-8) changes.shortened++;
        used.add(n.sourceId); signatures.add(`${n.pitch}:${n.start}:${n.duration}`);
        return {...n,duration,sourceDuration:n.duration,sourceStart:n.start};
      });
      return out;
    }
    const melody=line('melody'), bass=line('bass'), harmony=line('harmony');
    const roles=[['melody',melody],['harmony',harmony],['bass',bass]];
    const tracks=roles.map(([role,notes],i)=>({id:`mobile-${i}`,name:role[0].toUpperCase()+role.slice(1),instrument:'Piano',volume:role==='melody'?12:10,color:['#ee6a5b','#4f78c8','#7b61c9'][i],muted:false,sourceRole:role,mobileArrangement:true,endTick:end,tempoEvents:tempoEvents.map(e=>({...e})),notes:notes.map((n,j)=>({...n,id:`mobile-${i}-${j}`}))}));
    return {tracks,omittedNotes:all.length-tracks.reduce((s,t)=>s+t.notes.length,0),omittedPercussion:imported.filter(t=>!pitched.includes(t)).reduce((s,t)=>s+t.notes.length,0),characterLimitOmissions:0,trimmedNotes:0,trimTick:null,originalEndTick:end,smoothedGaps:0,extendedTicks:0,changes,roleSources:roles.map(([r,ns])=>`${r}: ${[...new Set(ns.map(n=>groups.get(n.source).name))].join(' → ')}`)};
  }
  // Every duration is an exact sum of binary/dotted notes or triplets, never N commands.
  const lengths=[];
  for(const d of [1,2,4,8,16,32,64,3,6,12,24,48]) for(const dot of [0,1]) {
    const ticks=WHOLE/d*(dot?1.5:1);
    if(Number.isInteger(ticks)) lengths.push({ticks,label:`${d}${dot?'.':''}`});
  }
  lengths.sort((a,b)=>b.ticks-a.ticks);
  const durationCache=new Map([[0,[]]]);
  function durations(ticks) {
    if(durationCache.has(ticks)) return durationCache.get(ticks);
    if(ticks>576) {const count=Math.floor((ticks-192)/192);return [...Array(count).fill('1'),...durations(ticks-count*192)];}
    const dp=Array(ticks+1).fill(null); dp[0]=[];
    for(let i=1;i<=ticks;i++) for(const l of lengths) if(l.ticks<=i && dp[i-l.ticks]) {
      const v=[...dp[i-l.ticks],l.label];
      if(!dp[i] || v.join('&').length<dp[i].join('&').length) dp[i]=v;
    }
    if(!dp[ticks]) throw new Error(`Unrepresentable duration ${ticks}`);
    durationCache.set(ticks,dp[ticks]); return dp[ticks];
  }
  function parsePart(text) {
    let i=0,octave=4,volume=10,length=4,tick=0,tie=false;
    const notes=[],events=[],rests=[];
    const number=()=>{const m=/^\d+/.exec(text.slice(i));if(!m)return null;i+=m[0].length;return +m[0];};
    while(i<text.length) {
      const c=text[i++].toLowerCase();
      if('tolv'.includes(c)){const v=number();if(v===null)throw new Error(`Missing value after ${c}`);if(c==='t')events.push({tick,tempo:v});if(c==='o')octave=v;if(c==='l')length=v;if(c==='v')volume=v;continue;}
      if(c==='>'){octave++;continue;}if(c==='<'){octave--;continue;}
      if(c==='&'){if(tie||!notes.length)throw new Error('Invalid tie');tie=true;continue;}
      if(!'abcdefgr'.includes(c))throw new Error(`Unsupported MML token ${c}`);
      let accidental=0;if(text[i]==='+'){accidental=1;i++;}else if(text[i]==='-'){accidental=-1;i++;}
      const d=number()??length; if(d<1||d>64)throw new Error('Unsupported note length');
      let duration=WHOLE/d;if(text[i]==='.'){duration*=1.5;i++;}
      const pitch=(octave+1)*12+({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[c]??0)+accidental;
      if(c==='r'){if(tie)throw new Error('Rest cannot be tied');rests.push({start:tick,duration});}
      else if(tie){const p=notes.at(-1);if(p.pitch!==pitch||Math.abs(p.start+p.duration-tick)>1e-7)throw new Error('Invalid tie target');p.duration+=duration;}
      else notes.push({pitch,start:tick,duration,velocity:(volume+1)*8-1});
      tie=false;tick+=duration;
    }
    if(tie)throw new Error('Unfinished tie');
    return {notes,rests,tempoEvents:events,endTick:tick};
  }
  function encode(track,tempo) {
    let text=`t${tempo}o4v${track.volume??10}l4`,cursor=0,octave=4,volume=track.volume??10;
    const events=(track.exportTempoEvents||[]).filter(e=>e.tick>0);
    let ei=0;
    function segment(start,end,pitch) {
      let at=start,continued=false;
      while(at<end) {
        while(ei<events.length && events[ei].tick<=at){text+=`t${events[ei++].tempo}`;}
        const until=Math.min(end,events[ei]?.tick??end);
        if(until<=at)continue;
        const seq=durations(until-at);
        seq.forEach((l,j)=>{text+=`${pitch===null?'':continued||j?'&':''}${pitch===null?'r':names[pitch%12]}${l==='4'?'':l}`;});
        at=until;continued=true;
      }
    }
    for(const n of track.notes) {
      segment(cursor,n.start,null);
      const o=Math.floor(n.pitch/12)-1;if(o!==octave){text+=`o${o}`;octave=o;}
      const v=Math.max(0,Math.min(15,Math.round((n.velocity+1)/8)-1));if(v!==volume){text+=`v${v}`;volume=v;}
      segment(n.start,n.start+n.duration,n.pitch);cursor=n.start+n.duration;
    }
    segment(cursor,track.endTick,null);return text;
  }
  // Choose default-length changes globally, retaining every attack and command.
  // Only ordinary lengths, ties and octave commands: no dialect-specific shortcuts.
  function compactPart(text) {
    const tokens=text.match(/[tolv]\d+|[<>]|&|[a-gr][+-]?\d*\.?/g)||[];
    if(tokens.join('')!==text)return text;
    let length='4',octave=4;
    const atoms=[];
    for(const token of tokens) {
      if(token[0]==='l'){length=token.slice(1);continue;}
      if(token[0]==='o') {
        const next=Number(token.slice(1)),delta=next-octave;
        const relative=delta>0?'>'.repeat(delta):'<'.repeat(-delta);
        // Keep the initialized octave explicit for standalone game fields.
        atoms.push({command:atoms.length===1?token:relative.length<token.length?relative:token});
        octave=next;continue;
      }
      if(token==='>'||token==='<'){octave+=token==='>'?1:-1;atoms.push({command:token});continue;}
      const note=/^([a-gr][+-]?)(\d*)(\.?)$/.exec(token);
      if(note)atoms.push({name:note[1],length:note[2]||length,dot:note[3]});
      else atoms.push({command:token});
    }
    const choices=new Set(['4',...atoms.filter(a=>a.name).map(a=>a.length)]);
    const initialized=/^(t\d+o\d+v\d+)l\d+/.exec(text);
    let states=new Map();
    let remaining=atoms;
    if(initialized) {
      remaining=atoms.slice(3);
      for(const value of choices)states.set(value,{cost:initialized[1].length+value.length+1,chunk:initialized[1]+'l'+value,prev:null});
    } else states.set('4',{cost:0,chunk:'',prev:null});
    let tied=false;
    for(const atom of remaining) {
      const next=new Map();
      const keep=(value,prev,chunk)=>{
        const cost=prev.cost+chunk.length;
        if(!next.has(value)||cost<next.get(value).cost)next.set(value,{cost,chunk,prev});
      };
      for(const [value,state] of states) {
        if(atom.command!==undefined){keep(value,state,atom.command);continue;}
        keep(value,state,atom.name+(atom.length===value?'':atom.length)+atom.dot);
        if(!tied && atom.length!==value)keep(atom.length,state,'l'+atom.length+atom.name+atom.dot);
      }
      if(atom.command==='&')tied=true;
      else if(atom.name)tied=false;
      states=next;
    }
    let best=[...states.values()].reduce((a,b)=>a.cost<=b.cost?a:b);
    if(best.cost>=text.length)return text;
    const chunks=[];
    while(best){chunks.push(best.chunk);best=best.prev;}
    return chunks.reverse().join('');
  }
  function fitPart(track,tempo,limit=LIMIT) {
    const render=()=>compactPart(encode(track,tempo));
    const original=encode(track,tempo),originalNotes=track.notes.length;
    let text=render();
    const compressedCharacters=text.length;
    if(text.length<=limit)return {text,removed:0,originalNotes,originalCharacters:original.length,compressedCharacters};
    const endingCount=track.sourceRole==='melody'?16:8;
    const protectedNotes=new Set([track.notes[0],...track.notes.slice(-endingCount)]);
    const anchors=new Map();
    const strength=n=>n.duration/PPQ+(n.velocity||0)/127+(n.motifWeight||0)+(n.phraseStart?3:0);
    for(const n of track.notes) {
      const bar=Math.floor(n.start/(PPQ*4));
      if(!anchors.has(bar)||strength(n)>strength(anchors.get(bar)))anchors.set(bar,n);
    }
    const anchorSet=new Set(anchors.values());
    const candidates=track.notes.filter(n=>!protectedNotes.has(n)).map((n,i)=>({n,score:strength(n)+(anchorSet.has(n)?100:0)+(n.start%(PPQ*4)<3?4:0),i})).sort((a,b)=>a.score-b.score||a.i-b.i);
    for(const {n} of candidates) {
      if(text.length<=limit)break;
      const index=track.notes.indexOf(n);
      track.notes.splice(index,1);
      let candidate;
      try {candidate=render();}catch {track.notes.splice(index,0,n);continue;}
      // Removing notes can sometimes cost more rest text. Only keep useful reductions.
      if(candidate.length<text.length)text=candidate;else track.notes.splice(index,0,n);
    }
    return {text,removed:originalNotes-track.notes.length,originalNotes,originalCharacters:original.length,compressedCharacters};
  }
  function convert(tracks,inputTempo=120,options={}) {
    if(tracks.length!==3)throw new Error('Mobile export requires exactly three voices.');
    const compatibility=options.compatibility===true,constant=options.constantTempo===true;
    const tempo=Math.max(32,Math.min(255,Math.round(constant?(options.tempo||inputTempo):inputTempo)));
    const events=tracks.flatMap(t=>t.tempoEvents||[]).sort((a,b)=>a.tick-b.tick).filter((e,i,a)=>i===a.length-1||e.tick!==a[i+1].tick);
    const seconds=timeline(events,inputTempo);
    const playbackEvents=events.map(e=>({tick:Math.round(e.tick*3),tempo:Math.max(32,Math.min(255,Math.round(e.tempo)))}));
    const playbackSeconds=timeline(playbackEvents.map(e=>({...e,tick:e.tick/3})),tempo);
    const bpmAt=t=>constant?tempo:playbackEvents.filter(e=>e.tick<=t*3).at(-1)?.tempo||tempo;
    const offsets=[];
    const cuts=constant?[]:playbackEvents.map(e=>e.tick);
    function spanLegal(start,finish) {
      let at=start;
      for(const cut of cuts) if(cut>start&&cut<finish){if(!legal(cut-at))return false;at=cut;}
      return legal(finish-at);
    }
    const map=t=>constant?seconds(t)*tempo/60*PPQ:t*3;
    const sourceEnd=Math.max(...tracks.map(t=>Math.max(t.endTick||0,endOf(t.notes))));
    // A common absolute end avoids accumulated rounding error and keeps trailing rests.
    const end=Math.round(map(sourceEnd)/12)*12;
    const warnings=['Instrument ranges and sounding octaves may differ in-game; source pitches are retained without transposition. Piano is only the browser preview sound.','Browser piano preview cannot guarantee identical in-game playback.'];
    if(compatibility)warnings.push('Accompaniment delay and Harmony 2 placement are community workarounds, not verified game fixes.');
    if(!constant&&events.length>1)warnings.push('Tempo changes retained: Mobile players report synchronization problems. Constant tempo is recommended.');
    let maxError=0,shortened=0,removed=0,collisions=0,collisionShorteningMs=0;
    const ordered=['melody','bass','harmony'].map((r,i)=>tracks.find(t=>t.sourceRole===r)||tracks[[0,2,1][i]]);
    const prepared=[];
    for(const t of ordered) {
      let cursor=0;
      const role=t.sourceRole||['melody','bass','harmony'][prepared.length];
      const ns=[];
      const source=t.notes.slice().sort((a,b)=>a.start-b.start);
      for(let i=0;i<source.length;i++) {
        const n=source[i];
        const localTempo=bpmAt(n.start);
        const shift=compatibility&&role==='harmony'?Math.max(3,Math.round(.020*localTempo/60*PPQ)):0;
        if(shift)offsets.push(shift/PPQ*60/localTempo*1000);
        const wanted=map(n.start)+shift;
        let start=Math.max(cursor,Math.round(wanted));
        let attempts=0;
        while(!spanLegal(cursor,start) || cuts.some(c=>c>start&&c-start<3)) {
          if(++attempts>48)throw new Error('Unrepresentable rest around a tempo change; enable tempo flattening');
          start++;
        }
        let finish=Math.min(end,Math.round(map(n.start+n.duration)),i+1<source.length?Math.round(map(source[i+1].start))+shift:end);
        if(finish<start+3) {finish=start+3;shortened++;}
        while(finish>start&&(!spanLegal(start,finish)||!legal((cuts.find(c=>c>finish)??finish)-finish)))finish--;
        if(finish>end||finish<=start){removed++;continue;}
        maxError=Math.max(maxError,Math.abs(start-wanted),Math.abs(finish-map(n.start+n.duration)));
        let candidate={...n,start,duration:finish-start};
        // Do not retrigger or resume a lower-priority unison in the middle of a held melody.
        const blockers=prepared.flatMap(p=>p.notes).filter(p=>p.pitch===n.pitch&&overlap(candidate,p));
        if(blockers.length) {
          collisions++;
          const first=Math.min(...blockers.map(p=>p.start));
          if(first<=start){removed++;continue;}
          collisionShorteningMs=Math.max(collisionShorteningMs,(finish-first)/PPQ*60/tempo*1000);
          finish=first;while(finish>start&&(!spanLegal(start,finish)||!legal((cuts.find(c=>c>finish)??finish)-finish)))finish--;
          if(finish-start<3){removed++;continue;}candidate.duration=finish-start;shortened++;
        }
        ns.push(candidate);cursor=finish;
      }
      // Any unrepresentable trailing sliver is absorbed into a rest by shortening the last note.
      if(ns.length&&!spanLegal(cursor,end)){
        const last=ns.at(-1);
        while(last.duration>0&&(!spanLegal(last.start+last.duration,end)||!spanLegal(last.start,last.start+last.duration)))last.duration--;
        if(last.duration<=0)throw new Error('A very short final note cannot be represented with these tempo boundaries');
        shortened++;
      }
      prepared.push({...t,sourceRole:role,notes:ns,endTick:end,exportTempoEvents:[]});
    }
    // Variable tempo needs boundaries that can split both notes and rests. Refuse lossy placement.
    if(!constant) {
      const converted=playbackEvents;
      for(const t of prepared)t.exportTempoEvents=converted;
    }
    const byRole=r=>prepared.find(t=>t.sourceRole===r);
    const gameTracks=options.melodyHarmony2===false?[byRole('melody'),byRole('harmony'),byRole('bass')]:[byRole('bass'),byRole('harmony'),byRole('melody')];
    const initial=constant?tempo:(playbackEvents.find(e=>e.tick===0)?.tempo||tempo);
    const noteVolume=n=>Math.max(0,Math.min(15,Math.round((n.velocity+1)/8)-1));
    const soundingVolumes=gameTracks.flatMap(t=>t.notes.map(noteVolume));
    const volumeBoost=options.boostVolume && soundingVolumes.length ? 15-Math.max(...soundingVolumes) : 0;
    if(options.boostVolume)gameTracks.forEach(t=>{
      t.notes=t.notes.map(n=>({...n,velocity:(noteVolume(n)+volumeBoost+1)*8-1}));
      t.volume=t.notes.length?noteVolume(t.notes[0]):Math.min(15,(t.volume??10)+volumeBoost);
    });
    gameTracks.forEach(t=>{t.initialTempo=initial;});
    const fitting=gameTracks.map(t=>options.fitLimit?fitPart(t,initial):({text:compactPart(encode(t,initial)),removed:0,originalNotes:t.notes.length,originalCharacters:encode(t,initial).length}));
    const parts=fitting.map(f=>f.text);
    fitting.forEach((f,i)=>{if(f.removed>f.originalNotes*.3)warnings.push(`${fields[i]} requires substantial reduction (${Math.round(f.removed/f.originalNotes*100)}% of notes). It will sound sparser; fitting cannot guarantee the same musical character.`);});
    fitting.forEach((f,i)=>{
      if(f.removed)warnings.push(`${fields[i]}: removed ${f.removed} of ${f.originalNotes} notes to fit 2,400 characters. Full duration and protected ending retained; audition the reduced arrangement.`);
    });
    if(parts.slice(1).some(p=>p.includes('&')))warnings.push('Harmony fields contain ties to preserve held notes. Older Mobile community tests report unreliable ties; verify sustains in-game.');
    const range=gameTracks.flatMap(t=>t.notes).map(n=>n.pitch);
    if(range.length)warnings.push(`Exported MIDI pitch range: ${Math.min(...range)}–${Math.max(...range)}. No octave folding or transposition applied.`);
    const parsed=parts.map(parsePart);
    const validation=validate(gameTracks,parsed);
    if(!validation.ok)throw new Error(`Export validation failed: ${validation.errors.join('; ')}`);
    const counts=parts.map(p=>p.length),overLimit=counts.map(n=>n>LIMIT);
    overLimit.forEach((over,i)=>{if(over)warnings.push(`${fields[i]} has ${counts[i]} characters: exceeds ${LIMIT}. Full duration retained. Shorten or split the score, or explicitly enable note removal before pasting.`);});
    if(collisions)warnings.push(`${collisions} overlapping same-pitch accompaniment notes resolved in favor of the melody, then bass.`);
    if(removed)warnings.push(`${removed} notes omitted during compatibility/timing resolution.`);
    if(shortened)warnings.push(`${shortened} note endings adjusted for timing or collisions.`);
    const errorMs=maxError/PPQ*60/(constant?tempo:Math.min(tempo,...playbackEvents.map(e=>e.tempo)))*1000;
    const offsetMinMs=offsets.length?Math.min(...offsets):0,offsetMaxMs=offsets.length?Math.max(...offsets):0;
    if(compatibility&&offsetMaxMs>30)warnings.push(`At this tempo, the shortest supported delay is approximately ${offsetMaxMs.toFixed(1)} ms. Disable the accompaniment delay or optionally flatten to a faster playback clock for a delay nearer 20 ms.`);
    if(errorMs>60/tempo/PPQ*6000+.01)warnings.push(`Timing adjustments exceed the normal six-tick tolerance: maximum ${errorMs.toFixed(1)} ms. Review short notes and overlaps.`);
    return {parts,mml:`MML@${parts.join(',')};`,tracks:gameTracks,parsed,counts,overLimit,warnings,validation,tempo:initial,constantTempo:constant,volumeBoost,fitting:fitting.map(({text,...report})=>report),duration:constant?end/PPQ*60/tempo:playbackSeconds(end/3),sourceDuration:seconds(sourceEnd),maxTimingErrorMs:errorMs,collisionShorteningMs,offsetMs:offsetMinMs,offsetMinMs,offsetMaxMs,fields:fields.map((f,i)=>`${f} — ${gameTracks[i].sourceRole}`)};
  }
  function validate(intended,parsed) {
    const errors=[];
    intended.forEach((t,i)=>{
      const p=parsed[i];
      if(p && t.initialTempo && (p.tempoEvents[0]?.tick!==0 || p.tempoEvents[0]?.tempo!==t.initialTempo))errors.push('initial tempo');
      if(!p||p.notes.length!==t.notes.length){errors.push(`part ${i+1}: attack count`);return;}
      t.notes.forEach((n,j)=>{const q=p.notes[j];if(n.pitch!==q.pitch||Math.abs(n.start-q.start)>1e-7||Math.abs(n.duration-q.duration)>1e-7||Math.max(0,Math.min(15,Math.round((n.velocity+1)/8)-1))!==Math.round((q.velocity+1)/8)-1)errors.push(`part ${i+1}: note ${j+1}`);if(j&&n.start<t.notes[j-1].start+t.notes[j-1].duration-1e-7)errors.push('polyphony');});
      if(Math.abs(p.endTick-t.endTick)>1e-7)errors.push('end time');
      // Compare silence as intervals; adjacent rest tokens may encode one source rest.
      const silence=[];let cursor=0;
      for(const n of t.notes){if(n.start>cursor)silence.push([cursor,n.start]);cursor=n.start+n.duration;}
      if(t.endTick>cursor)silence.push([cursor,t.endTick]);
      const actual=[];for(const r of p.rests){const last=actual.at(-1);if(last&&Math.abs(last[1]-r.start)<1e-7)last[1]+=r.duration;else actual.push([r.start,r.start+r.duration]);}
      if(silence.length!==actual.length||silence.some((r,j)=>r.some((x,k)=>Math.abs(x-actual[j][k])>1e-7)))errors.push('rest intervals');
      const wanted=t.exportTempoEvents||[];
      for(const e of wanted.filter(e=>e.tick>0&&e.tick<t.endTick))if(!p.tempoEvents.some(q=>q.tick===e.tick&&q.tempo===e.tempo))errors.push('tempo event');
    });
    for(let i=0;i<parsed.length;i++)for(let j=i+1;j<parsed.length;j++)for(const a of parsed[i].notes)for(const b of parsed[j].notes)if(a.pitch===b.pitch&&overlap(a,b))errors.push('overlapping unison');
    if(parsed.some(p=>Math.abs(p.endTick-parsed[0].endTick)>1e-7))errors.push('parts finish at different times');
    const elapsed=parsed.map(p=>timeline(p.tempoEvents.map(e=>({...e,tick:e.tick/3})))(p.endTick/3));
    if(elapsed.some(t=>Math.abs(t-elapsed[0])>1e-7))errors.push('elapsed synchronization');
    return {ok:!errors.length,errors};
  }
  const api={arrange,convert,parsePart,encode,compactPart,fitPart,validate,timeline,PPQ,LIMIT,fields};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.MobileMml=api;
})(typeof globalThis!=='undefined'?globalThis:this);
