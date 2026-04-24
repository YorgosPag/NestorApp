import { execSync } from 'child_process';

// Get dead types from knip
let knipOutput;
try {
  knipOutput = execSync('npx knip --include types --reporter json', {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch (e) {
  // knip exits with non-zero when issues found — stdout still has the JSON
  knipOutput = e.stdout || '';
}

const data = JSON.parse(knipOutput);
const issues = data.issues;

const deadTypes = [];
for (const item of issues) {
  for (const t of (item.types || [])) {
    if (t.name) deadTypes.push({ file: item.file, name: t.name });
  }
}

console.error(`Total dead types from knip: ${deadTypes.length}`);

const safeToRemove = [];
const hasExternalUsage = [];

for (const t of deadTypes) {
  const { name, file } = t;
  try {
    const result = execSync(
      `grep -rl --include="*.ts" --include="*.tsx" "${name}" src/`,
      { encoding: 'utf8', cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const files = result.trim().split('\n').filter(Boolean);
    const external = files.filter(f => f !== file);
    if (external.length === 0) {
      safeToRemove.push(t);
    } else {
      hasExternalUsage.push({ ...t, usedIn: external.slice(0, 3) });
    }
  } catch {
    // grep returns exit 1 when no match = truly dead
    safeToRemove.push(t);
  }
}

console.error(`Safe to remove: ${safeToRemove.length}`);
console.error(`Has external usage: ${hasExternalUsage.length}`);

const byFile = {};
for (const t of safeToRemove) {
  if (!byFile[t.file]) byFile[t.file] = [];
  byFile[t.file].push(t.name);
}

console.log('=== SAFE TO REMOVE ===');
for (const [f, names] of Object.entries(byFile).sort()) {
  console.log(`${f}|||${names.join(',')}`);
}

console.log('=== EXTERNAL USAGE ===');
for (const t of hasExternalUsage) {
  console.log(`${t.file}|||${t.name}|||${t.usedIn.join(',')}`);
}
