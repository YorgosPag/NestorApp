#!/usr/bin/env node
import fs from 'node:fs';

const path = process.argv[2];
if (!path) { console.error('usage: node parse-trace-inp.mjs <trace.json>'); process.exit(1); }

console.log('reading trace...');
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const events = data.traceEvents || data;
console.log(`total events: ${events.length}`);

const interactionEvents = events.filter(e =>
  e.name === 'EventTiming' ||
  e.name === 'Interaction' ||
  e.name === 'InteractionRecord' ||
  e.cat?.includes('devtools.timeline') && (e.name === 'EventDispatch')
);

console.log(`\ncandidate interaction events: ${interactionEvents.length}`);
const nameSet = {};
for (const e of events) nameSet[e.name] = (nameSet[e.name] || 0) + 1;
const topNames = Object.entries(nameSet).sort((a,b)=>b[1]-a[1]).slice(0,40);
console.log('\nTop 40 event names:');
for (const [n,c] of topNames) console.log(`  ${n.padEnd(40)} ${c}`);

const eventTiming = events.filter(e => e.name === 'EventTiming');
console.log(`\nEventTiming entries: ${eventTiming.length}`);
if (eventTiming.length) {
  console.log('Sample EventTiming:');
  console.log(JSON.stringify(eventTiming[0], null, 2).slice(0, 1500));
}
