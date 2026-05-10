#!/usr/bin/env node
import fs from 'node:fs';

const path = process.argv[2];
const tsStart = Number(process.argv[3]);
const tsEnd = Number(process.argv[4]);
if (!path || !tsStart || !tsEnd) { console.error('usage: node parse-trace-hover.mjs <trace> <tsStart> <tsEnd>'); process.exit(1); }

console.log(`reading trace, range ts ${tsStart}..${tsEnd} (${((tsEnd-tsStart)/1000).toFixed(0)}ms)`);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const events = data.traceEvents || data;
console.log(`total events: ${events.length}`);

const tids = new Map();
for (const e of events) {
  if (e.ts >= tsStart && e.ts <= tsEnd && e.dur > 0) {
    const tid = e.tid;
    tids.set(tid, (tids.get(tid) || 0) + e.dur);
  }
}
console.log('\nThreads with activity in range (tid, total ms):');
for (const [tid, total] of [...tids.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)) {
  console.log(`  tid=${tid}  ${(total/1000).toFixed(1)}ms`);
}
const mainTid = [...tids.entries()].sort((a,b)=>b[1]-a[1])[0][0];
console.log(`\nUsing main tid=${mainTid}`);

const inRange = events.filter(e => e.tid === mainTid && e.ts >= tsStart && e.ts <= tsEnd && e.dur > 0);
console.log(`events in range on main thread: ${inRange.length}`);

const byName = {};
for (const e of inRange) {
  if (!byName[e.name]) byName[e.name] = { count: 0, total: 0, max: 0 };
  byName[e.name].count++;
  byName[e.name].total += e.dur;
  if (e.dur > byName[e.name].max) byName[e.name].max = e.dur;
}
console.log('\nTop 30 by total dur in range:');
for (const [n, s] of Object.entries(byName).sort((a,b)=>b[1].total-a[1].total).slice(0,30)) {
  console.log(`  ${n.padEnd(38)} count=${String(s.count).padStart(5)}  total=${(s.total/1000).toFixed(1).padStart(8)}ms  max=${(s.max/1000).toFixed(1).padStart(7)}ms`);
}

console.log('\nFunctionCall hotspots (top 30 by dur):');
const fcalls = inRange.filter(e => e.name === 'FunctionCall' || e.name === 'v8.callFunction').map(e => ({
  name: e.name,
  dur: e.dur/1000,
  fn: e.args?.data?.functionName || e.args?.functionName || '?',
  url: (e.args?.data?.url || '').split('/').slice(-3).join('/'),
  line: e.args?.data?.lineNumber,
}));
fcalls.sort((a,b)=>b.dur-a.dur);
for (const f of fcalls.slice(0,30)) console.log(`  ${f.dur.toFixed(2).padStart(7)}ms  ${f.fn.padEnd(40)} ${f.url}:${f.line}`);

console.log('\nLargest top-level RunTask events in range:');
const runTasks = inRange.filter(e => e.name === 'RunTask').sort((a,b)=>b.dur-a.dur).slice(0,15);
for (const t of runTasks) console.log(`  ${(t.dur/1000).toFixed(1).padStart(7)}ms  ts=${t.ts}`);
