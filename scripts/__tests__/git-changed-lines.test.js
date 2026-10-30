/**
 * ADR-584 §9 — `scripts/lib/git-changed-lines.js`: «αγγίζει αυτή η αλλαγή τις γραμμές start..end;»
 * Ο parser ελέγχεται με χειρόγραφα patches (παγίδες: `+++ ` μέσα στο σώμα, καθαρή διαγραφή, όνομα με κενό)·
 * το ευρετήριο με ΠΡΑΓΜΑΤΙΚΟ git σε προσωρινό repo — το repo του έργου δεν αγγίζεται ποτέ.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  createChangedLineIndex, parseUnifiedZero, parseNameStatus, EMPTY_TREE,
} = require('../lib/git-changed-lines');

describe('parseUnifiedZero', () => {
  const PATCH = [
    'diff --git a/src/a.ts b/src/a.ts',
    'index 1111111..2222222 100644',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -3,0 +4,2 @@ export function a() {',
    '+++ looks like a header but is an ADDED line "++ looks…"',
    '+second added line',
    '@@ -10 +12 @@',
    '-old',
    '+new',
    '@@ -7,2 +6,0 @@',
    '-gone one',
    '-gone two',
    'diff --git a/src/my file.ts b/src/my file.ts',
    '--- a/src/my file.ts\t',
    '+++ b/src/my file.ts\t',
    '@@ -1 +1 @@',
    '-x',
    '+y',
    'diff --git a/src/deleted.ts b/src/deleted.ts',
    'deleted file mode 100644',
    '--- a/src/deleted.ts',
    '+++ /dev/null',
    '@@ -1,3 +0,0 @@',
    '-a',
  ].join('\n');

  const ranges = parseUnifiedZero(PATCH);

  it('additions and replacements map to the NEW numbering', () => {
    expect(ranges.get('src/a.ts')).toEqual([[4, 5], [12, 12], [6, 7]]);
  });

  it('a pure deletion (+c,0) touches the SEAM c..c+1 — removing what kept two halves apart', () => {
    expect(ranges.get('src/a.ts')).toContainEqual([6, 7]);
  });

  it('`+++ ` inside a hunk body is content, not a new file header', () => {
    expect([...ranges.keys()]).not.toContain('+ looks like a header but is an ADDED line "++ looks…"');
  });

  it('a path with a space (git appends a TAB) parses to the clean path', () => {
    expect(ranges.get('src/my file.ts')).toEqual([[1, 1]]);
  });

  it('a deleted file (+++ /dev/null) yields no entry', () => {
    expect([...ranges.keys()].sort()).toEqual(['src/a.ts', 'src/my file.ts']);
  });

  it('CRLF output parses the same as LF', () => {
    expect(parseUnifiedZero(PATCH.replace(/\n/g, '\r\n'))).toEqual(ranges);
  });
});

describe('parseNameStatus', () => {
  it('rename = changed under the NEW name, not added; add = added', () => {
    const { added, changed, moved } = parseNameStatus('M\0src/m.ts\0R087\0src/old.ts\0src/new.ts\0A\0src/n.ts\0');
    expect([...changed].sort()).toEqual(['src/m.ts', 'src/n.ts', 'src/new.ts']);
    expect([...added]).toEqual(['src/n.ts']);
    expect([...moved]).toEqual(['src/new.ts']);
  });
});

describe('createChangedLineIndex — real git', () => {
  const LINES = (tag) => Array.from({ length: 8 }, (_, i) => `export const ${tag}${i} = ${i};`).join('\n') + '\n';
  let tmp;
  const git = (...args) => {
    const r = spawnSync('git', ['-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], { cwd: tmp, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
  };
  const write = (rel, text) => fs.writeFileSync(path.join(tmp, rel), text);

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'changed-lines-'));
    git('init', '-q');
    fs.mkdirSync(path.join(tmp, 'src'));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('no HEAD (first commit) ⇒ base = empty tree ⇒ every staged line is new', () => {
    write('src/a.ts', LINES('a'));
    git('add', '-A');
    const index = createChangedLineIndex({ repoRoot: tmp, paths: ['src/a.ts'], cached: true });
    expect(index.base).toBe(EMPTY_TREE);
    expect(index.touches('src/a.ts', 1, 1)).toBe(true);
  });

  it('cached: only the staged change counts — an unstaged edit on disk does not', () => {
    write('src/a.ts', LINES('a'));
    write('src/b.ts', LINES('b'));
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    write('src/a.ts', LINES('a').replace('a2 = 2', 'a2 = 22'));
    git('add', 'src/a.ts');
    write('src/b.ts', LINES('b').replace('b5 = 5', 'b5 = 55'));   // ξένη, αστάδιοποίητη
    write('src/new.ts', LINES('n'));
    git('add', 'src/new.ts');
    const { touches } = createChangedLineIndex({ repoRoot: tmp, paths: ['src/a.ts', 'src/b.ts', 'src/new.ts'], cached: true });
    expect(touches('src/a.ts', 3, 3)).toBe(true);
    expect(touches('src/a.ts', 4, 8)).toBe(false);
    expect(touches('src/a.ts', 1, 2)).toBe(false);
    expect(touches('src/b.ts', 1, 8)).toBe(false);
    expect(touches('src/new.ts', 7, 8)).toBe(true);
  });

  it('working tree: tracked edits and UNTRACKED files are new; untouched tracked files are not', () => {
    write('src/a.ts', LINES('a'));
    write('src/b.ts', LINES('b'));
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    write('src/a.ts', LINES('a').replace('a6 = 6', 'a6 = 66'));
    write('src/u.ts', LINES('u'));
    const { touches } = createChangedLineIndex({ repoRoot: tmp, paths: ['src/a.ts', 'src/b.ts', 'src/u.ts'] });
    expect(touches('src/a.ts', 7, 7)).toBe(true);
    expect(touches('src/a.ts', 1, 6)).toBe(false);
    expect(touches('src/b.ts', 1, 8)).toBe(false);
    expect(touches('src/u.ts', 1, 1)).toBe(true);
  });

  it('a renamed file keeps its history: only its edited lines are new', () => {
    write('src/old.ts', LINES('r'));
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    git('mv', 'src/old.ts', 'src/renamed.ts');
    write('src/renamed.ts', LINES('r').replace('r7 = 7', 'r7 = 77'));
    git('add', 'src/renamed.ts');
    const { touches } = createChangedLineIndex({ repoRoot: tmp, paths: ['src/renamed.ts'], cached: true });
    expect(touches('src/renamed.ts', 8, 8)).toBe(true);
    expect(touches('src/renamed.ts', 1, 7)).toBe(false);
  });

  it('a PURE move (R100, no hunks) wrote nothing — fail-closed does not swallow it', () => {
    write('src/old.ts', LINES('p'));
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    git('mv', 'src/old.ts', 'src/moved.ts');
    const { touches } = createChangedLineIndex({ repoRoot: tmp, paths: ['src/moved.ts'], cached: true });
    expect(touches('src/moved.ts', 1, 8)).toBe(false);
  });

  it('fail-closed: a modified file whose hunks could not be read counts as wholly changed', () => {
    write('src/a.ts', LINES('a'));
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    fs.chmodSync(path.join(tmp, 'src/a.ts'), 0o755);
    git('update-index', '--chmod=+x', 'src/a.ts');   // αλλαγή ΜΟΝΟ mode: «M» χωρίς κανένα hunk
    const { touches } = createChangedLineIndex({ repoRoot: tmp, paths: ['src/a.ts'], cached: true });
    expect(touches('src/a.ts', 1, 8)).toBe(true);
  });
});
