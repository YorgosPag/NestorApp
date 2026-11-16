/**
 * `wt:prune` (ADR-925 §17): ορφανοί φάκελοι worktree. ΠΡΑΓΜΑΤΙΚΟ git σε προσωρινό repo,
 * γιατί ο κίνδυνος (σβήσιμο ζωντανής δουλειάς) ζει ακριβώς στην κρίση «το ξέρει το git;».
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { git, worktrees } = require('../lib/agent-worktree/git');
const { findOrphans, pruneOrphans } = require('../lib/agent-worktree/prune');
const { commitIn, createSandbox, openWorkspace, removeSandbox, write } = require('./agent-worktree-fixture');

jest.setTimeout(60000);

let box;
const noWait = { attempts: 1, delayMs: 0 };
const options = (extra = {}) => ({ cwd: box.primary, env: box.env, ...extra });
const harnessRoot = () => path.join(box.primary, '.claude', 'worktrees');
const registered = () => worktrees(box.primary).map((item) => path.basename(item.dir));
const entryFor = (result, dir) => result.orphans.find((item) => path.relative(item.dir, dir) === '');

beforeEach(() => {
  box = createSandbox();
});

afterEach(() => removeSandbox(box));

/** Όπως το άφησε ένα μισό σβήσιμο: φάκελος με `.git` αρχείο, χωρίς καταχώρηση στο git. */
function orphanFromWorkspace(task) {
  const { dir } = openWorkspace(box, task);
  const admin = git(dir, ['rev-parse', '--git-dir']);
  fs.rmSync(path.resolve(dir, admin), { recursive: true, force: true });
  git(box.primary, ['worktree', 'prune']);
  return dir;
}

function plainOrphan(root, name) {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
  write(path.join(dir, 'node_modules'), 'dep.txt', 'x'.repeat(2048));
  return dir;
}

describe('απογραφή (ξερή εκτέλεση)', () => {
  it('βρίσκει ορφανό στη ρίζα wt:* και ΔΕΝ αλλάζει τίποτα', () => {
    const dir = orphanFromWorkspace('gone-task');
    const result = findOrphans(options());
    expect(entryFor(result, dir)).toMatchObject({ skip: null });
    expect(entryFor(result, dir).bytes).toBeGreaterThan(0);
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('ενεργό worktree δεν εμφανίζεται καν', () => {
    const { dir } = openWorkspace(box, 'live-task');
    expect(entryFor(findOrphans(options()), dir)).toBeUndefined();
  });

  it('βρίσκει ορφανό στο .claude/worktrees του κύριου αντιγράφου', () => {
    const dir = plainOrphan(harnessRoot(), 'agent-abc');
    expect(entryFor(findOrphans(options()), dir)).toMatchObject({ skip: null });
  });

  it('καμία ρίζα ή κανένας ορφανός ⇒ άδεια λίστα', () => {
    expect(findOrphans(options()).orphans).toEqual([]);
  });
});

describe('φράχτες: παράλειψη με αιτία', () => {
  const reasonOf = (dir) => entryFor(pruneOrphans(options({ retry: noWait })), dir).skip.reason;

  it('ανεξάρτητο repo (φάκελος .git) μένει', () => {
    const dir = path.join(box.env.NESTOR_WORKTREE_ROOT, 'own-repo');
    fs.mkdirSync(dir, { recursive: true });
    git(dir, ['init', '-b', 'main']);
    expect(reasonOf(dir)).toBe('foreign-repo');
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('worktree ΑΛΛΟΥ repo στην ίδια ρίζα μένει', () => {
    const other = path.join(box.sandbox, 'other');
    fs.mkdirSync(other);
    git(other, ['init', '-b', 'main']);
    git(other, ['config', 'user.email', 'test@example.com']);
    git(other, ['config', 'user.name', 'test']);
    commitIn(other, 'a.txt', 'α\n');
    const dir = path.join(box.env.NESTOR_WORKTREE_ROOT, 'foreign-wt');
    git(other, ['worktree', 'add', '-b', 'side', dir]);
    expect(reasonOf(dir)).toBe('registered-elsewhere');
    expect(git(dir, ['status', '--porcelain'])).toBe('');
  });

  it('🔴 handoff που ΔΕΝ υπάρχει στο κύριο αντίγραφο ⇒ ο φάκελος μένει, το handoff ονομάζεται', () => {
    const dir = plainOrphan(harnessRoot(), 'agent-handoff');
    fs.mkdirSync(path.join(dir, 'HANDOFFS'));
    write(path.join(dir, 'HANDOFFS'), 'note.md', 'μοναδικό\n');
    const entry = entryFor(pruneOrphans(options({ retry: noWait })), dir);
    expect(entry.skip).toEqual({ reason: 'handoffs', detail: ['note.md'] });
    expect(fs.existsSync(path.join(dir, 'HANDOFFS', 'note.md'))).toBe(true);
  });

  it('handoff byte-ίδιο στο κύριο αντίγραφο ⇒ σβήνεται', () => {
    const dir = plainOrphan(harnessRoot(), 'agent-collected');
    fs.mkdirSync(path.join(dir, 'HANDOFFS'));
    fs.mkdirSync(path.join(box.primary, 'HANDOFFS'));
    write(path.join(dir, 'HANDOFFS'), 'note.md', 'ίδιο\n');
    write(path.join(box.primary, 'HANDOFFS'), 'note.md', 'ίδιο\n');
    pruneOrphans(options({ retry: noWait }));
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('junction μένει, και ο στόχος του μένει ακέραιος', () => {
    const target = path.join(box.sandbox, 'precious');
    fs.mkdirSync(target);
    write(target, 'keep.txt', 'κράτα\n');
    fs.mkdirSync(box.env.NESTOR_WORKTREE_ROOT, { recursive: true });
    const link = path.join(box.env.NESTOR_WORKTREE_ROOT, 'linked');
    fs.symlinkSync(target, link, 'junction');
    expect(reasonOf(link)).toBe('not-directory');
    expect(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8')).toBe('κράτα\n');
  });

  it('φάκελος όπου βρίσκεται το cwd μένει', () => {
    const dir = plainOrphan(harnessRoot(), 'agent-here');
    const entry = entryFor(pruneOrphans({ cwd: dir, env: box.env, retry: noWait }), dir);
    expect(entry.skip.reason).toBe('cwd');
  });
});

describe('σβήσιμο (--yes)', () => {
  it('σβήνει τους ορφανούς και των δύο ριζών, όχι το ενεργό worktree', () => {
    const { dir: live } = openWorkspace(box, 'live-task');
    const rootOrphan = orphanFromWorkspace('gone-task');
    const harnessOrphan = plainOrphan(harnessRoot(), 'agent-abc');
    const result = pruneOrphans(options({ retry: noWait }));
    expect(fs.existsSync(rootOrphan)).toBe(false);
    expect(fs.existsSync(harnessOrphan)).toBe(false);
    expect(fs.existsSync(path.join(live, 'node_modules', 'dep.txt'))).toBe(true);
    expect(result.orphans.every((item) => !item.residue)).toBe(true);
  });

  it('πρώτα git worktree prune: καταχώρηση χωρίς φάκελο φεύγει, το κλαδί μένει', () => {
    const { dir, branch } = openWorkspace(box, 'vanished');
    fs.rmSync(dir, { recursive: true, force: true });
    expect(findOrphans(options()).pruned.join('\n')).toContain('vanished');
    expect(registered()).toContain('vanished');
    pruneOrphans(options({ retry: noWait }));
    expect(registered()).not.toContain('vanished');
    expect(git(box.primary, ['branch', '--list', branch])).toContain(branch);
  });

  it('ιδεμπότητο: δεύτερη εκτέλεση δεν βρίσκει τίποτα', () => {
    orphanFromWorkspace('gone-task');
    pruneOrphans(options({ retry: noWait }));
    const again = pruneOrphans(options({ retry: noWait }));
    expect(again.orphans).toEqual([]);
    expect(again.pruned).toEqual([]);
  });

  const onWindows = process.platform === 'win32' ? it : it.skip;

  onWindows('🔴 κρατημένος φάκελος ⇒ υπόλειμμα με αιτία, οι υπόλοιποι σβήνονται', async () => {
    const held = plainOrphan(harnessRoot(), 'agent-held');
    const free = plainOrphan(harnessRoot(), 'agent-free');
    const script = "process.stdout.write('ok');setTimeout(()=>{},60000)";
    const child = spawn(process.execPath, ['-e', script], { cwd: held, stdio: ['ignore', 'pipe', 'ignore'] });
    await new Promise((resolve) => child.stdout.once('data', resolve));
    try {
      const result = pruneOrphans(options({ retry: noWait }));
      expect(entryFor(result, held).residue).toEqual(expect.any(String));
      expect(fs.existsSync(free)).toBe(false);
    } finally {
      await new Promise((resolve) => {
        child.once('exit', resolve);
        child.kill();
      });
    }
  });
});
