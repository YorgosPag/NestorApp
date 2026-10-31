/**
 * Χώρος εργασίας πράκτορα (ADR-925). Τρέχει ΠΡΑΓΜΑΤΙΚΟ git σε προσωρινό repo: ο κίνδυνος
 * ζει ακριβώς εκεί, οπότε ένα mock δεν θα απέδειχνε τίποτα. Μόνο η εγκατάσταση εξαρτήσεων
 * αντικαθίσταται, γιατί κοστίζει λεπτά ανά test.
 */

const { spawn } = require('node:child_process');
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

  it('🔴 αποτυχία εγκατάστασης: ούτε τα junctions που πρόλαβε να φτιάξει μένουν πίσω', () => {
    const outside = path.join(sandbox, 'store');
    fs.mkdirSync(outside);
    write(outside, 'keep.txt', 'κοινό\n');
    const install = (dir) => {
      fs.mkdirSync(path.join(dir, 'node_modules'));
      fs.symlinkSync(outside, path.join(dir, 'node_modules', 'link'), 'junction');
      throw new Error('χωρίς store');
    };
    expect(() => createWorkspace('task-one', { cwd: primary, env, minimumFree: 0, install })).toThrow('απέτυχε');
    expect(fs.existsSync(locate('task-one', env).dir)).toBe(false);
    expect(fs.existsSync(path.join(outside, 'keep.txt'))).toBe(true);
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
    expect(removeWorkspace('task-one', options()).branchKept).toContain('not fully merged');
    expect(git(primary, ['log', '--format=%s', branch, '-1'])).toBe('add work.txt');
  });

  it('σβήνει το κλαδί που εντάχθηκε', () => {
    const { dir } = open('task-one');
    commitIn(dir, 'work.txt', 'x\n');
    land('task-one', options());
    expect(removeWorkspace('task-one', options()).branchKept).toBeNull();
    expect(git(primary, ['branch', '--list', 'agent/*'])).toBe('');
  });

  it('🔴 αρνείται από μέσα από το ίδιο το worktree, και δεν πειράζει τίποτα', () => {
    const { dir, branch } = open('task-one');
    const nested = path.join(dir, 'node_modules');
    [dir, nested].forEach((cwd) => {
      expect(() => removeWorkspace('task-one', { cwd, env })).toThrow('Τρέχεις μέσα');
    });
    expect(fs.existsSync(dir)).toBe(true);
    expect(git(primary, ['branch', '--list', branch])).toContain(branch);
  });

  it('🔴 worktree σε μέση rebase (χωρίς κλαδί) δεν κρίνεται υπόλειμμα', () => {
    const { dir } = open('task-one');
    git(dir, ['checkout', '--detach']);
    write(dir, 'wip.txt', 'x\n');
    expect(() => removeWorkspace('task-one', options())).toThrow('αδέσμευτη');
    expect(fs.readFileSync(path.join(dir, 'wip.txt'), 'utf8')).toBe('x\n');
  });

  it('🔴 όταν το git αρνηθεί (κλειδωμένο worktree) δεν πειράζει ούτε φάκελο ούτε κλαδί', () => {
    const { dir, branch } = open('task-one');
    git(primary, ['worktree', 'lock', dir]);
    expect(() => removeWorkspace('task-one', options())).toThrow('αρνήθηκε');
    expect(fs.existsSync(path.join(dir, 'node_modules', 'dep.txt'))).toBe(true);
    expect(git(primary, ['branch', '--list', branch])).toContain(branch);
    git(primary, ['worktree', 'unlock', dir]);
  });

  it('🔴 αρνείται ανεξάρτητο repo στη θέση του υπολείμματος', () => {
    const { dir } = locate('task-one', env);
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    write(dir, 'precious.txt', 'x\n');
    expect(() => removeWorkspace('task-one', options())).toThrow('ανεξάρτητο repo');
    expect(fs.existsSync(path.join(dir, 'precious.txt'))).toBe(true);
  });
});

describe('σύγκλιση σβησίματος', () => {
  /** Πραγματικό κράτημα: στα Windows το cwd άλλης διεργασίας μπλοκάρει σβήσιμο και μετονομασία. */
  function holdCwd(dir, ms = 60000) {
    const script = `process.stdout.write('ok');setTimeout(()=>{},${ms})`;
    const child = spawn(process.execPath, ['-e', script], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] });
    return new Promise((resolve) => child.stdout.once('data', () => resolve(child)));
  }

  const release = (child) =>
    new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill();
    });

  const noWait = { attempts: 1, delayMs: 0 };
  const onWindows = process.platform === 'win32' ? it : it.skip;

  onWindows('🔴 περιμένει διεργασία που κλείνει, ακόμη και σε EBUSY πάνω στο cwd', async () => {
    const held = path.join(sandbox, 'closing');
    fs.mkdirSync(held);
    await holdCwd(held, 400);
    expect(clearResidue(held, { attempts: 11, delayMs: 100 })).toBeNull();
    expect(fs.existsSync(held)).toBe(false);
  });

  it('σταματά στο όριο προσπαθειών και κρατά την αιτία', () => {
    const held = path.join(sandbox, 'held');
    fs.mkdirSync(held);
    const spy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {
      throw Object.assign(new Error('κρατημένο'), { code: 'EBUSY' });
    });
    try {
      expect(clearResidue(held, { attempts: 3, delayMs: 1 })).toBe('EBUSY');
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      spy.mockRestore();
    }
  });

  onWindows('🔴 κρατημένος φάκελος: σβήνει το κλαδί, αναφέρει το υπόλειμμα, και το ξανατρέξιμο τελειώνει', async () => {
    const { dir } = open('task-one');
    const holder = await holdCwd(dir);
    const first = removeWorkspace('task-one', { ...options(), retry: noWait });
    expect(first.residue).toEqual(expect.stringMatching(/^E[A-Z]+$/));
    expect(first.branchKept).toBeNull();
    expect(git(primary, ['branch', '--list', 'agent/*'])).toBe('');
    expect(fs.existsSync(dir)).toBe(true);

    await release(holder);
    const second = removeWorkspace('task-one', { ...options(), retry: noWait });
    expect(second).toMatchObject({ nothingFound: false, residue: null, branchKept: null });
    expect(fs.existsSync(dir)).toBe(false);
  });

  onWindows('🔴 κρατημένος φάκελος με commits χωρίς ένταξη: το κλαδί μένει, και το ξανατρέξιμο δεν το πειράζει', async () => {
    const { dir, branch } = open('task-one');
    commitIn(dir, 'work.txt', 'x\n');
    const holder = await holdCwd(dir);
    removeWorkspace('task-one', { ...options(), retry: noWait });
    await release(holder);
    expect(removeWorkspace('task-one', { ...options(), retry: noWait }).branchKept).toContain('not fully merged');
    expect(fs.existsSync(dir)).toBe(false);
    expect(git(primary, ['log', '--format=%s', branch, '-1'])).toBe('add work.txt');
  });

  it('ολοκληρώνει το κλαδί όταν μόνο αυτό έμεινε', () => {
    const { dir } = open('task-one');
    git(primary, ['worktree', 'remove', dir]);
    fs.rmSync(dir, { recursive: true, force: true });
    expect(removeWorkspace('task-one', options())).toMatchObject({ nothingFound: false, branchKept: null });
    expect(git(primary, ['branch', '--list', 'agent/*'])).toBe('');
  });

  it('ολοκληρώνει όταν ο φάκελος σβήστηκε με το χέρι και η καταχώρηση έμεινε', () => {
    const { dir } = open('task-one');
    fs.rmSync(dir, { recursive: true, force: true });
    expect(removeWorkspace('task-one', options()).nothingFound).toBe(false);
    expect(git(primary, ['worktree', 'list', '--porcelain'])).not.toContain('task-one');
    expect(git(primary, ['branch', '--list', 'agent/*'])).toBe('');
  });

  it('ολοκληρώνει τον φάκελο όταν μόνο αυτός έμεινε', () => {
    const { dir } = locate('task-one', env);
    fs.mkdirSync(path.join(dir, 'node_modules'), { recursive: true });
    expect(removeWorkspace('task-one', options())).toMatchObject({ nothingFound: false, residue: null });
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('δεύτερη εκτέλεση μετά από επιτυχία: καμία εξαίρεση, λέει ότι δεν βρήκε τίποτα', () => {
    open('task-one');
    removeWorkspace('task-one', options());
    expect(removeWorkspace('task-one', options())).toMatchObject({ nothingFound: true, residue: null, branchKept: null });
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
