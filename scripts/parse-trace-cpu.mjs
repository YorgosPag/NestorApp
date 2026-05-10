#!/usr/bin/env node
import fs from 'node:fs';
const path=process.argv[2], tsStart=Number(process.argv[3]), tsEnd=Number(process.argv[4]);
console.log('reading...');
const data=JSON.parse(fs.readFileSync(path,'utf8'));
const events=data.traceEvents||data;

const profile=events.filter(e=>e.name==='Profile')[0];
const chunks=events.filter(e=>e.name==='ProfileChunk').sort((a,b)=>a.ts-b.ts);
console.log(`Profile: ${profile?'yes':'no'}, ProfileChunks: ${chunks.length}`);

const nodes={};
const samples=[];
const timeDeltas=[];
let lastTs = profile?.args?.data?.startTime ?? 0;

if(profile?.args?.data?.cpuProfile?.nodes){
  for(const n of profile.args.data.cpuProfile.nodes) nodes[n.id]=n;
}

for(const c of chunks){
  const cp=c.args?.data?.cpuProfile;
  if(cp?.nodes) for(const n of cp.nodes) nodes[n.id]=n;
  if(cp?.samples && c.args.data.timeDeltas){
    for(let i=0;i<cp.samples.length;i++){
      lastTs += c.args.data.timeDeltas[i];
      samples.push({nodeId:cp.samples[i], ts:lastTs});
    }
  }
}
console.log(`nodes=${Object.keys(nodes).length} samples=${samples.length}`);

const inRange = samples.filter(s=>s.ts>=tsStart && s.ts<=tsEnd);
console.log(`samples in range ${tsStart}..${tsEnd}: ${inRange.length}`);

// Build parent map
const counts={};
for(const s of inRange){
  let nid=s.nodeId;
  while(nid && nodes[nid]){
    const n=nodes[nid];
    const f=n.callFrame;
    const key=`${f.functionName||'(anon)'} | ${(f.url||'').split('/').slice(-2).join('/')}:${f.lineNumber}`;
    counts[key]=(counts[key]||0)+1;
    nid=n.parent;
  }
}
const top=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,40);
console.log('\nTop 40 stack frames (samples count, ~1ms each):');
for(const [k,c] of top) console.log(`  ${String(c).padStart(5)}  ${k}`);

// Self time only (leaf samples)
const selfCounts={};
for(const s of inRange){
  const n=nodes[s.nodeId];
  if(!n) continue;
  const f=n.callFrame;
  const key=`${f.functionName||'(anon)'} | ${(f.url||'').split('/').slice(-2).join('/')}:${f.lineNumber}`;
  selfCounts[key]=(selfCounts[key]||0)+1;
}
const selfTop=Object.entries(selfCounts).sort((a,b)=>b[1]-a[1]).slice(0,30);
console.log('\nTop 30 SELF frames (leaf samples):');
for(const [k,c] of selfTop) console.log(`  ${String(c).padStart(5)}  ${k}`);
