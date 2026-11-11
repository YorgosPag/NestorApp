/**
 * Συλλογή των handoffs του worktree στο κύριο αντίγραφο (ADR-925 §9, 2026-11-11).
 *
 * ΠΡΑΓΜΑΤΙΚΟ git, με τον ΙΔΙΟ κανόνα αγνόησης που έχει το repo (`HANDOFFS/*.md` στο
 * `.git/info/exclude`): ο κίνδυνος ζει ακριβώς εκεί, γιατί το `git status` δεν βλέπει
 * αγνοημένα αρχεία και το `git worktree remove` τα σβήνει.
 */

const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomic } = require('../lib/fs/atomic-write');
const { git, isDirty } = require('../lib/agent-worktree/git');
const { harvestHandoffs, pendingHandoffs, unharvested } = require('../lib/agent-worktree/handoffs');
const { land } = require('../lib/agent-worktree/land');
const { removeWorkspace } = require('../lib/agent-worktree/lifecycle');
const { commitIn, createSandbox, openWorkspace, removeSandbox, write } = require('./agent-worktree-fixture');

jest.setTimeout(60000);

let ctx;

beforeEach(() => {
  ctx = createSandbox();
  fs.appendFileSync(path.join(ctx.primary, '.git', 'info', 'exclude'), '\nHANDOFFS/*.md\n');
});

afterEach(() => removeSandbox(ctx));

const options = () => ({ cwd: ctx.primary, env: ctx.env });
const handoffsOf = (dir) => path.join(dir, 'HANDOFFS');
const at = (dir, name) => path.join(handoffsOf(dir), name);
const read = (dir, name) => fs.readFileSync(at(dir, name), 'utf8');

function writeHandoff(dir, name, text, mtimeSeconds) {
  fs.mkdirSync(handoffsOf(dir), { recursive: true });
  write(handoffsOf(dir), name, text);
  if (mtimeSeconds) fs.utimesSync(at(dir, name), mtimeSeconds, mtimeSeconds);
}

/** Tracked παρά τον κανόνα αγνόησης, όπως τα 1.026 tracked handoffs του repo (`git add -f`). */
function trackHandoff(dir, name, text) {
  writeHandoff(dir, name, text);
  git(dir, ['add', '-f', `HANDOFFS/${name}`]);
  git(dir, ['commit', '-m', `docs(handoff): ${name}`]);
}

describe('συλλογή', () => {
  it('αντιγράφει το untracked handoff αυτούσιο, με τον χρόνο τροποποίησης της πηγής', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(dir, 'a.md', 'κατάσταση α\n', 1_700_000_000);
    expect(harvestHandoffs(dir, ctx.primary)).toEqual({ copied: ['a.md'], unchanged: [], conflicts: [] });
    expect(read(ctx.primary, 'a.md')).toBe('κατάσταση α\n');
    expect(fs.statSync(at(ctx.primary, 'a.md')).mtimeMs).toBe(1_700_000_000_000);
  });

  it('🔴 το handoff είναι αόρατο στο git status: γι\' αυτό χρειάζεται η συλλογή', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(dir, 'a.md', 'α\n');
    expect(isDirty(dir)).toBe(false);
    expect(pendingHandoffs(dir)).toEqual(['a.md']);
  });

  it('ιδεμποτικό: δεύτερη εκτέλεση δεν γράφει τίποτα', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(dir, 'a.md', 'α\n');
    harvestHandoffs(dir, ctx.primary);
    fs.utimesSync(at(ctx.primary, 'a.md'), 1_600_000_000, 1_600_000_000);
    expect(harvestHandoffs(dir, ctx.primary)).toEqual({ copied: [], unchanged: ['a.md'], conflicts: [] });
    expect(fs.statSync(at(ctx.primary, 'a.md')).mtimeMs).toBe(1_600_000_000_000);
  });

  it('νεότερη πηγή με άλλο περιεχόμενο αντικαθιστά τον προορισμό', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(ctx.primary, 'a.md', 'παλιό\n', 1_600_000_000);
    writeHandoff(dir, 'a.md', 'νέο\n', 1_700_000_000);
    expect(harvestHandoffs(dir, ctx.primary).copied).toEqual(['a.md']);
    expect(read(ctx.primary, 'a.md')).toBe('νέο\n');
  });

  it('🔴 παλαιότερη (ή ίσης ηλικίας) πηγή με άλλο περιεχόμενο: σύγκρουση, ο προορισμός μένει άθικτος', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(ctx.primary, 'a.md', 'νεότερο στο κύριο\n', 1_700_000_000);
    writeHandoff(dir, 'a.md', 'παλιό στο worktree\n', 1_600_000_000);
    writeHandoff(ctx.primary, 'b.md', 'ίσης ηλικίας Α\n', 1_650_000_000);
    writeHandoff(dir, 'b.md', 'ίσης ηλικίας Β\n', 1_650_000_000);
    const result = harvestHandoffs(dir, ctx.primary);
    expect(result.conflicts).toEqual([
      { name: 'a.md', reason: 'destination-newer' },
      { name: 'b.md', reason: 'destination-newer' },
    ]);
    expect(read(ctx.primary, 'a.md')).toBe('νεότερο στο κύριο\n');
    expect(read(ctx.primary, 'b.md')).toBe('ίσης ηλικίας Α\n');
  });

  it('🔴 tracked προορισμός στο κύριο αντίγραφο: δεν γράφεται, και το main μένει καθαρό', () => {
    trackHandoff(ctx.primary, 'a.md', 'από το git\n');
    const { dir } = openWorkspace(ctx, 'task-one');
    git(dir, ['rm', '--cached', '-q', 'HANDOFFS/a.md']);
    git(dir, ['commit', '-m', 'untrack']);
    writeHandoff(dir, 'a.md', 'άλλο\n', 2_000_000_000);
    expect(harvestHandoffs(dir, ctx.primary).conflicts).toEqual([{ name: 'a.md', reason: 'tracked' }]);
    expect(read(ctx.primary, 'a.md')).toBe('από το git\n');
    expect(git(ctx.primary, ['status', '--porcelain'])).toBe('');
  });

  it('🔴 συλλέγει ΜΟΝΟ untracked: τα tracked handoffs του worktree ταξιδεύουν με το git', () => {
    trackHandoff(ctx.primary, 'tracked.md', 'tracked\n');
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(dir, 'mine.md', 'δικό μου\n');
    expect(pendingHandoffs(dir)).toEqual(['mine.md']);
  });

  it('αγνοεί υποφακέλους και αρχεία που δεν είναι .md', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(dir, 'notes.txt', 'x\n');
    fs.mkdirSync(path.join(handoffsOf(dir), 'sub'));
    write(path.join(handoffsOf(dir), 'sub'), 'deep.md', 'x\n');
    expect(pendingHandoffs(dir)).toEqual([]);
  });

  it('worktree χωρίς φάκελο HANDOFFS: κενή συλλογή, κανένα σφάλμα', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    expect(harvestHandoffs(dir, ctx.primary)).toEqual({ copied: [], unchanged: [], conflicts: [] });
  });

  it('η ανεξάρτητη επαλήθευση βλέπει προορισμό που λείπει ή διαφέρει', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(dir, 'a.md', 'α\n');
    writeHandoff(dir, 'b.md', 'β\n');
    writeHandoff(ctx.primary, 'b.md', 'άλλο\n');
    expect(unharvested(dir, ctx.primary)).toEqual(['a.md', 'b.md']);
  });
});

describe('σβήσιμο', () => {
  it('🔴 συλλέγει ΠΡΙΝ σβήσει: το handoff επιζεί στο κύριο αντίγραφο', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    writeHandoff(dir, 'a.md', 'να μη χαθεί\n');
    const result = removeWorkspace('task-one', options());
    expect(fs.existsSync(dir)).toBe(false);
    expect(read(ctx.primary, 'a.md')).toBe('να μη χαθεί\n');
    expect(result.handoffs.copied).toEqual(['a.md']);
  });

  it('🔴 σύγκρουση: αρνείται, και δεν σβήνει ούτε φάκελο ούτε κλαδί ούτε handoff', () => {
    const { dir, branch } = openWorkspace(ctx, 'task-one');
    writeHandoff(ctx.primary, 'a.md', 'νεότερο\n', 1_700_000_000);
    writeHandoff(dir, 'a.md', 'παλιό\n', 1_600_000_000);
    expect(() => removeWorkspace('task-one', options())).toThrow('Δεν σβήνω τίποτα');
    expect(read(dir, 'a.md')).toBe('παλιό\n');
    expect(read(ctx.primary, 'a.md')).toBe('νεότερο\n');
    expect(git(ctx.primary, ['branch', '--list', branch])).toContain(branch);
  });

  it('worktree με σβησμένο φάκελο: ολοκληρώνει χωρίς συλλογή', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    fs.rmSync(dir, { recursive: true, force: true });
    expect(removeWorkspace('task-one', options())).toMatchObject({ nothingFound: false, handoffs: null });
  });
});

describe('ένταξη', () => {
  it('συλλέγει μετά το fast-forward', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    commitIn(dir, 'work.txt', 'x\n');
    writeHandoff(dir, 'a.md', 'επόμενο βήμα\n');
    expect(land('task-one', options()).handoffs.copied).toEqual(['a.md']);
    expect(read(ctx.primary, 'a.md')).toBe('επόμενο βήμα\n');
  });

  it('🔴 σύγκρουση handoff ΔΕΝ ακυρώνει την ένταξη που έγινε· αναφέρεται', () => {
    const { dir } = openWorkspace(ctx, 'task-one');
    commitIn(dir, 'work.txt', 'x\n');
    const tip = git(dir, ['rev-parse', 'HEAD']);
    writeHandoff(ctx.primary, 'a.md', 'νεότερο\n', 1_700_000_000);
    writeHandoff(dir, 'a.md', 'παλιό\n', 1_600_000_000);
    const result = land('task-one', options());
    expect(result.head).toBe(tip);
    expect(result.handoffs.conflicts).toEqual([{ name: 'a.md', reason: 'destination-newer' }]);
    expect(read(ctx.primary, 'a.md')).toBe('νεότερο\n');
  });
});

describe('ατομική εγγραφή', () => {
  it('γράφει bytes και mtime, χωρίς να αφήνει προσωρινό', () => {
    const file = path.join(ctx.sandbox, 'out', 'f.bin');
    writeFileAtomic(file, Buffer.from([0, 1, 2]), { mtime: new Date(1_700_000_000_000) });
    expect([...fs.readFileSync(file)]).toEqual([0, 1, 2]);
    expect(fs.statSync(file).mtimeMs).toBe(1_700_000_000_000);
    expect(fs.readdirSync(path.dirname(file))).toEqual(['f.bin']);
  });

  it('σε αποτυχία καθαρίζει το προσωρινό και ο προορισμός μένει ως είχε', () => {
    const dir = path.join(ctx.sandbox, 'out');
    fs.mkdirSync(dir);
    write(dir, 'f.txt', 'παλιό\n');
    const spy = jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error('κρατημένο'), { code: 'EBUSY' });
    });
    try {
      expect(() => writeFileAtomic(path.join(dir, 'f.txt'), 'νέο\n')).toThrow('κρατημένο');
    } finally {
      spy.mockRestore();
    }
    expect(fs.readdirSync(dir)).toEqual(['f.txt']);
    expect(fs.readFileSync(path.join(dir, 'f.txt'), 'utf8')).toBe('παλιό\n');
  });
});
