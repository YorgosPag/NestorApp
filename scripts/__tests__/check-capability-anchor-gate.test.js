/**
 * CHECK 5C — DXF Entity Capability Anchor gate (ADR-587 Φ11).
 *
 * Presubmit-grade test for the GATE ITSELF (mirror `check-ssot-discover-ratchet.test.js`):
 * a gate nobody tests is a gate nobody can trust — the exact failure mode this gate exists
 * to prevent, applied one level up.
 *
 * The test parses the LIVE hook (`scripts/git-hooks/pre-commit`) rather than re-declaring
 * its patterns, so the two cannot drift: rename the trigger in the hook and these fail.
 *
 * Guards three distinct regressions:
 *  1. Trigger correctness — fires on the domain SSoT + export table, silent otherwise
 *     (a blocking check that over-fires gets disabled; Google's <10% false-positive bar).
 *  2. Canary fail-OPEN — the `grep -c . || echo 0` idiom prints "0\n0" on no-match (grep -c
 *     prints 0 AND exits 1, so `|| echo 0` also fires) → `[[ -lt ]]` throws → evaluates FALSE
 *     → the canary passes in exactly the broken-convention case it exists to catch. Found by
 *     harness while building this gate, 2026-07-17.
 *  3. Convention coverage — the jest pattern must actually resolve to every on-disk anchor.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, 'scripts', 'git-hooks', 'pre-commit');
const ANCHOR_DIR = 'src/subapps/dxf-viewer';
const ANCHOR_GLOB_SUFFIX = '-coverage.test.ts';

const hookSource = fs.readFileSync(HOOK_PATH, 'utf8');

/** Pull the CHECK 5C `register_area` call out of the live hook (file + test pattern). */
function extractAnchorArea() {
  const call = hookSource.match(
    /register_area\s+"DXF Entity Capability Anchors"\s*\\\s*\n\s*"([^"]+)"\s*\\\s*\n\s*"([^"]+)"/,
  );
  if (!call) throw new Error('CHECK 5C register_area block not found in the hook');
  return { filePattern: call[1], testPattern: call[2] };
}

/**
 * Replay the hook's own trigger logic (register_area body) against a staged-file list.
 * The file list goes over STDIN, not argv: on Windows, execFileSync mangles arguments that
 * contain embedded newlines, which silently turned the multi-file case into a no-match.
 */
function triggers(stagedFiles, filePattern) {
  const script = `grep -E "$1" | grep -v '__tests__' | grep -v '\\.test\\.' || true`;
  const out = execFileSync('bash', ['-c', script, '_', filePattern], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: stagedFiles.join('\n'),
  });
  return out.trim().length > 0;
}

function anchorsOnDisk() {
  const out = execFileSync(
    'bash',
    ['-c', `find ${ANCHOR_DIR} -name '*${ANCHOR_GLOB_SUFFIX}' 2>/dev/null || true`],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

describe('CHECK 5C — capability anchor gate is registered in the live hook', () => {
  it('the anchor area is registered (the gate exists at all)', () => {
    expect(() => extractAnchorArea()).not.toThrow();
  });

  it('the trigger is the renderable domain SSoT + the export table bound to it', () => {
    const { filePattern } = extractAnchorArea();
    expect(filePattern).toContain('renderable-entity-type');
    expect(filePattern).toContain('entity-export-coverage');
  });
});

describe('CHECK 5C — trigger matrix (fires exactly when it should)', () => {
  const { filePattern } = extractAnchorArea();

  // Both real incidents (7f215980 topo-surface, 16e9f4cc leader) touched this file.
  it.each([
    ['domain SSoT (both 2026-07 incidents touched this)', `${ANCHOR_DIR}/rendering/contract/renderable-entity-type.ts`],
    ['declarative export table', `${ANCHOR_DIR}/export/core/entity-export-coverage.ts`],
  ])('FIRES on %s', (_desc, file) => {
    expect(triggers([file], filePattern)).toBe(true);
  });

  it('FIRES when the trigger is buried among unrelated staged files', () => {
    expect(
      triggers(['README.md', 'src/app/page.tsx', `${ANCHOR_DIR}/rendering/contract/renderable-entity-type.ts`], filePattern),
    ).toBe(true);
  });

  it.each([
    ['the anchor test file alone (tests are not triggers)', `${ANCHOR_DIR}/export/core/__tests__/entity-export-coverage.test.ts`],
    ['an unrelated dxf source file', `${ANCHOR_DIR}/canvas-v2/dxf-canvas/DxfRenderer.ts`],
    ['a similarly-named sibling (anchored regex, not substring)', `${ANCHOR_DIR}/rendering/contract/renderable-entity-type-extra.ts`],
  ])('SILENT on %s', (_desc, file) => {
    expect(triggers([file], filePattern)).toBe(false);
  });

  it('SILENT on an empty commit', () => {
    expect(triggers([], filePattern)).toBe(false);
  });
});

describe('CHECK 5C — canary must fail CLOSED when the convention breaks', () => {
  it('the canary counts with `wc -l`, never the fail-open `grep -c . || echo 0` idiom', () => {
    const canaryBlock = hookSource.slice(
      hookSource.indexOf('ANCHOR_ON_DISK='),
      hookSource.indexOf('ANCHOR_ON_DISK=') + 200,
    );
    expect(canaryBlock).toContain('wc -l');
    expect(canaryBlock).not.toMatch(/grep -c \. \|\| echo 0/);
  });

  it('REGRESSION: `grep -c . || echo 0` yields "0\\n0" on no match → arithmetic error → passes', () => {
    // Pin the defect itself, so nobody "simplifies" the canary back into it.
    const broken = execFileSync(
      'bash',
      ['-c', `find ${ANCHOR_DIR} -name '*-NOSUCHCONVENTION.test.ts' 2>/dev/null | grep -c . || echo 0`],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    ).trim();
    expect(broken.split('\n')).toHaveLength(2); // "0", "0" — not a number

    const guardFires = execFileSync(
      'bash',
      ['-c', `V=$(find ${ANCHOR_DIR} -name '*-NOSUCH.test.ts' 2>/dev/null | grep -c . || echo 0); [[ "$V" -lt 1 ]] && echo BLOCK || echo PASS`],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    ).trim();
    expect(guardFires).toBe('PASS'); // ← the bug: it should have blocked
  });

  it('the shipped `wc -l` form counts correctly and BLOCKS on a broken convention', () => {
    const verdict = execFileSync(
      'bash',
      ['-c', `V=$(find ${ANCHOR_DIR} -name '*-NOSUCH.test.ts' 2>/dev/null | wc -l | tr -d '[:space:]'); [[ "$V" -lt 1 ]] && echo BLOCK || echo PASS`],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    ).trim();
    expect(verdict).toBe('BLOCK');
  });

  it('the shipped `wc -l` form PASSES against the real anchors on disk', () => {
    const verdict = execFileSync(
      'bash',
      ['-c', `V=$(find ${ANCHOR_DIR} -name '*${ANCHOR_GLOB_SUFFIX}' 2>/dev/null | wc -l | tr -d '[:space:]'); [[ "$V" -lt 1 ]] && echo BLOCK || echo PASS`],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    ).trim();
    expect(verdict).toBe('PASS');
  });
});

describe('CHECK 5C — the jest pattern resolves to the real anchors (self-truthing)', () => {
  it('every on-disk anchor matches the hook\'s test pattern (no silent omission)', () => {
    const { testPattern } = extractAnchorArea();
    const rx = new RegExp(testPattern);
    const files = anchorsOnDisk();
    expect(files.length).toBeGreaterThanOrEqual(16); // 20 at 2026-07-17; floor guards deletion
    const unmatched = files.filter((f) => !rx.test(f));
    expect(unmatched).toEqual([]);
  });

  it('the pattern is convention-driven, not a hand-written manifest of paths', () => {
    const { testPattern } = extractAnchorArea();
    expect(testPattern).toContain(ANCHOR_GLOB_SUFFIX.replace(/\./g, '\\.'));
    // A manifest would name individual suites; a convention names none.
    expect(testPattern).not.toContain('move-entity-geometry');
    expect(testPattern).not.toContain('rotate-entity');
  });

  it('every anchor binding the renderable domain is covered by the pattern', () => {
    const { testPattern } = extractAnchorArea();
    const rx = new RegExp(testPattern);
    const bound = execFileSync(
      'bash',
      ['-c', `grep -rl "RENDERABLE_ENTITY_TYPES" ${ANCHOR_DIR} --include=*.test.ts || true`],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(bound.length).toBeGreaterThanOrEqual(16);
    expect(bound.filter((f) => !rx.test(f))).toEqual([]);
  });
});
