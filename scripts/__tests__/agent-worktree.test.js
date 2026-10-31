/**
 * Χώρος εργασίας πράκτορα (ADR-925). Τρέχει ΠΡΑΓΜΑΤΙΚΟ git σε προσωρινό repo: ο κίνδυνος
 * ζει ακριβώς εκεί, οπότε ένα mock δεν θα απέδειχνε τίποτα. Μόνο η εγκατάσταση εξαρτήσεων
 * αντικαθίσταται, γιατί κοστίζει λεπτά ανά test.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertDiskRoom, assertTask, locate } = require('../lib/agent-worktree/config');
const { git } = require('../lib/agent-worktree/git');
const { clearResidue, createWorkspace, listWorkspaces, removeWorkspace } = require('../lib/agent-worktree/lifecycle');
const { land } = require('../lib/agent-worktree/land');

jest.setTimeout(60000);

let sandbox;
let primary;
let env;

const write = (dir, name, text) => fs.writeFileSync(path.join(dir, name), text);

function commitIn(dir, name, text, message = `add ${name}`) {
  write(dir, name, text);
  git(dir, ['add', name]);
  git(dir, ['commit', '-m', message]);
}

function initRepo() {
  git(primary, ['init', '-b', 'main']);
  git(primary, ['config', 'user.email', 'test@example.com']);
  git(primary, ['config', 'user.name', 'test']);
  git(primary, ['config', 'core.hooksPath', '.no-hooks']);
  commitIn(primary, '.gitignore', 'node_modules/\n');
}

function fakeInstall(dir) {
  fs.mkdirSync(path.join(dir, 'node_modules'));
  write(path.join(dir, 'node_modules'), 'dep.txt', 'εξάρτηση\n');
}

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-wt-'));
  primary = path.join(sandbox, 'repo');
  fs.mkdirSync(primary);
  env = { NESTOR_WORKTREE_ROOT: path.join(sandbox, 'worktrees') };
  initRepo();
});

afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

const open = (task) => createWorkspace(task, { cwd: primary, env, minimumFree: 0, install: fakeInstall });
const options = () => ({ cwd: primary, env });

describe('κανόνες', () => {
  it.each(['ab', 'Κάτι', '../evil', 'a b c', '-abc', 'abc-', 'a/b/c'])('απορρίπτει όνομα %s', (name) => {
    expect(() => assertTask(name)).toThrow('Μη έγκυρο');
  });

  it('το κλαδί και ο φάκελος βγαίνουν από το ίδιο όνομα', () => {
    const target = locate('fix-login', env);
    expect(target.branch).toBe('agent/fix-login');
    expect(target.dir).toBe(path.join(env.NESTOR_WORKTREE_ROOT, 'fix-login'));
  });

  it('αρνείται δίσκο κάτω από το όριο, δέχεται ακριβώς στο όριο', () => {
    expect(() => assertDiskRoom(99, 100)).toThrow('ελεύθερα');
    expect(() => assertDiskRoom(100, 100)).not.toThrow();
  });
});

describe('δημιουργία', () => {
  it('δίνει ανεξάρτητο αντίγραφο στο δικό του κλαδί, με δικές του εξαρτήσεις', () => {
    const { dir, branch } = open('task-one');
    expect(git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe(branch);
    expect(fs.existsSync(path.join(dir, 'node_modules', 'dep.txt'))).toBe(true);
    expect(git(dir, ['status', '--porcelain'])).toBe('');
  });

  it('🔴 με core.autocrlf=true τα αρχεία βγαίνουν αυτούσια, ώστε τα αποτυπώματα να ταιριάζουν', () => {
    commitIn(primary, 'lines.txt', 'α\nβ\n');
    git(primary, ['config', 'core.autocrlf', 'true']);
    const { dir } = open('task-one');
    expect(fs.readFileSync(path.join(dir, 'lines.txt'), 'utf8')).toBe('α\nβ\n');
  });

  it('🔴 αποτυχία εγκατάστασης: δεν μένει μισό worktree ούτε κλαδί', () => {
    const install = () => {
      throw new Error('χωρίς store');
    };
    expect(() => createWorkspace('task-one', { cwd: primary, env, minimumFree: 0, install })).toThrow('απέτυχε');
    expect(fs.existsSync(locate('task-one', env).dir)).toBe(false);
    expect(git(primary, ['branch', '--list', 'agent/*'])).toBe('');
  });

  it('δεν βλέπει την αδέσμευτη δουλειά του κύριου αντιγράφου', () => {
    write(primary, 'wip.txt', 'ξένη δουλειά\n');
    expect(fs.existsSync(path.join(open('task-one').dir, 'wip.txt'))).toBe(false);
  });

  it('αρνείται δεύτερο ίδιο όνομα', () => {
    open('task-one');
    expect(() => open('task-one')).toThrow('Υπάρχει ήδη');
  });

  it('αρνείται όταν δεν φτάνει ο δίσκος και δεν αφήνει τίποτα πίσω', () => {
    const tooMuch = Number.MAX_SAFE_INTEGER;
    const install = fakeInstall;
    expect(() => createWorkspace('task-one', { cwd: primary, env, minimumFree: tooMuch, install })).toThrow('ελεύθερα');
    expect(git(primary, ['branch', '--list', 'agent/*'])).toBe('');
  });
});

describe('σβήσιμο', () => {
  it('σβήνει το αντίγραφο μαζί με τις εξαρτήσεις του', () => {
    open('task-one');
    removeWorkspace('task-one', options());
    expect(fs.existsSync(locate('task-one', env).dir)).toBe(false);
  });

  it('αρνείται όταν υπάρχει αδέσμευτη δουλειά, και δεν πειράζει τίποτα', () => {
    const { dir } = open('task-one');
    write(dir, 'wip.txt', 'x\n');
    expect(() => removeWorkspace('task-one', options())).toThrow('αδέσμευτη');
    expect(fs.existsSync(path.join(dir, 'wip.txt'))).toBe(true);
  });

  it('κρατά το κλαδί που δεν εντάχθηκε, μαζί με τα commits του', () => {
    const { dir, branch } = open('task-one');
    commitIn(dir, 'work.txt', 'x\n');
    expect(removeWorkspace('task-one', options()).branchRemoved).toBe(false);
    expect(git(primary, ['log', '--format=%s', branch, '-1'])).toBe('add work.txt');
  });

  it('σβήνει το κλαδί που εντάχθηκε', () => {
    const { dir } = open('task-one');
    commitIn(dir, 'work.txt', 'x\n');
    land('task-one', options());
    expect(removeWorkspace('task-one', options()).branchRemoved).toBe(true);
  });
});

describe('υπολείμματα', () => {
  it('🔴 σβήνει τον φάκελο χωρίς να ακολουθήσει junction προς τα έξω', () => {
    const outside = path.join(sandbox, 'outside');
    fs.mkdirSync(outside);
    write(outside, 'keep.txt', 'ξένο\n');
    const residue = path.join(sandbox, 'residue');
    fs.mkdirSync(residue);
    fs.symlinkSync(outside, path.join(residue, 'link'), 'junction');
    clearResidue(residue);
    expect(fs.existsSync(residue)).toBe(false);
    expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('ξένο\n');
  });
});

describe('ένταξη', () => {
  it('fast-forward όταν το main δεν κινήθηκε, χωρίς δεύτερο πέρασμα από τις πύλες', () => {
    const { dir } = open('task-one');
    commitIn(dir, 'work.txt', 'x\n');
    const tip = git(dir, ['rev-parse', 'HEAD']);
    const result = land('task-one', options());
    expect(result).toMatchObject({ reverified: false, head: tip });
    expect(fs.existsSync(path.join(primary, 'work.txt'))).toBe(true);
  });

  it('όταν το main κινήθηκε, γίνεται ΕΝΑ commit με όλα τα μηνύματα, και ξανακρίνεται', () => {
    const { dir } = open('task-one');
    commitIn(dir, 'a.txt', 'a\n', 'πρώτο');
    commitIn(dir, 'b.txt', 'b\n', 'δεύτερο');
    commitIn(primary, 'other.txt', 'o\n');
    expect(land('task-one', options()).reverified).toBe(true);
    expect(git(primary, ['log', '-1', '--format=%B'])).toMatch(/πρώτο[\s\S]*δεύτερο/);
    expect(git(primary, ['rev-list', '--count', 'HEAD'])).toBe('3');
    ['a.txt', 'b.txt', 'other.txt'].forEach((name) => expect(fs.existsSync(path.join(primary, name))).toBe(true));
  });

  it('🔴 οι πύλες κρίνουν ΟΛΗ την αλλαγή μετά το rebase, και η απόρριψη αφήνει το κλαδί ως είχε', () => {
    const { dir, branch } = open('task-one');
    commitIn(dir, 'a.txt', 'a\n');
    commitIn(primary, 'other.txt', 'o\n');
    const hooks = path.join(sandbox, 'hooks');
    fs.mkdirSync(hooks);
    const seen = path.join(sandbox, 'seen.txt').replace(/\\/g, '/');
    write(hooks, 'pre-commit', `#!/bin/sh\ngit diff --cached --name-only > "${seen}"\nexit 1\n`);
    git(primary, ['config', 'core.hooksPath', hooks.replace(/\\/g, '/')]);
    const before = git(primary, ['rev-parse', 'main']);
    expect(() => land('task-one', options())).toThrow('απέρριψαν');
    expect(fs.readFileSync(seen.replace(/\//g, path.sep), 'utf8')).toContain('a.txt');
    expect(git(primary, ['rev-parse', 'main'])).toBe(before);
    expect(git(primary, ['log', '-1', '--format=%s', branch])).toBe('add a.txt');
  });

  it('σύγκρουση: εγκαταλείπει το rebase και αφήνει τα πάντα ως είχαν', () => {
    const { dir } = open('task-one');
    commitIn(dir, 'same.txt', 'από το κλαδί\n');
    const tip = git(dir, ['rev-parse', 'HEAD']);
    commitIn(primary, 'same.txt', 'από το main\n');
    expect(() => land('task-one', options())).toThrow('Σύγκρουση');
    expect(git(dir, ['rev-parse', 'HEAD'])).toBe(tip);
    expect(git(dir, ['status', '--porcelain'])).toBe('');
  });

  it('🔴 δεν πατά αδέσμευτη δουλειά στο κύριο αντίγραφο', () => {
    const { dir } = open('task-one');
    commitIn(dir, 'shared.txt', 'από το κλαδί\n');
    write(primary, 'shared.txt', 'αδέσμευτη δουλειά\n');
    expect(() => land('task-one', options())).toThrow('αρνήθηκε');
    expect(fs.readFileSync(path.join(primary, 'shared.txt'), 'utf8')).toBe('αδέσμευτη δουλειά\n');
  });

  it('αρνείται δεύτερη ταυτόχρονη ένταξη και αφήνει το κλείδωμα του άλλου', () => {
    const { dir } = open('task-one');
    commitIn(dir, 'work.txt', 'x\n');
    const lock = path.join(primary, '.git', 'agent-worktree-land.lock');
    fs.mkdirSync(lock);
    expect(() => land('task-one', options())).toThrow('Τρέχει ήδη');
    expect(fs.existsSync(lock)).toBe(true);
  });

  it('απελευθερώνει το κλείδωμα ακόμη και όταν αποτύχει', () => {
    open('task-one');
    expect(() => land('task-one', options())).toThrow('τίποτα για ένταξη');
    expect(fs.existsSync(path.join(primary, '.git', 'agent-worktree-land.lock'))).toBe(false);
  });

  it('αρνείται αδέσμευτη δουλειά στο κλαδί', () => {
    const { dir } = open('task-one');
    commitIn(dir, 'work.txt', 'x\n');
    write(dir, 'wip.txt', 'x\n');
    expect(() => land('task-one', options())).toThrow('αδέσμευτη');
  });
});

describe('κλήσεις git μέσα σε hook', () => {
  it('🔴 δεν κληρονομεί το GIT_DIR του hook, και χτυπά το repo του cwd', () => {
    process.env.GIT_DIR = path.join(sandbox, 'does-not-exist');
    try {
      expect(git(primary, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('main');
    } finally {
      delete process.env.GIT_DIR;
    }
  });
});

describe('απογραφή', () => {
  it('δείχνει μόνο τους χώρους πρακτόρων, με την κατάστασή τους', () => {
    const { dir, branch } = open('task-one');
    commitIn(dir, 'work.txt', 'x\n');
    write(dir, 'wip.txt', 'x\n');
    const { workspaces, freeBytes } = listWorkspaces(options());
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0]).toMatchObject({ branch, ahead: 1, dirty: true });
    expect(freeBytes).toBeGreaterThan(0);
  });
});
