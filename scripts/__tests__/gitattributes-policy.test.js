/** Ο κανόνας αλλαγών γραμμής ζει στο repo και ισχύει για κάθε αρχείο (ADR-925 §11). */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
}

function attributes(file) {
  const lines = git(['check-attr', 'text', 'eol', '--', file]).trim().split(/\r?\n/);
  const value = (name) => lines.find((line) => line.startsWith(`${file}: ${name}: `)).split(': ').pop();
  return { text: value('text'), eol: value('eol') };
}

describe('.gitattributes', () => {
  it.each([
    ['src/app/page.tsx', 'auto', 'lf'],
    ['scripts/git-hooks/pre-commit', 'auto', 'lf'],
    ['recovery/lost-found/x.bin', 'auto', 'lf'],
    ['enterprise-backup.ps1', 'set', 'crlf'],
    ['tool.cmd', 'set', 'crlf'],
    ['tool.bat', 'set', 'crlf'],
  ])('%s: text=%s, eol=%s', (file, text, eol) => {
    expect(attributes(file)).toEqual({ text, eol });
  });

  it.each(['public/test.dxf', 'test-symbols-tekton.tek', 'a.png', 'a.glb', 'test-greek.pdf', 'model.bin'])(
    '%s: καμία μετατροπή',
    (file) => {
      expect(attributes(file).text).toBe('unset');
    },
  );

  it('κανένα αρχείο στο ευρετήριο δεν έχει CRLF', () => {
    const offenders = git(['ls-files', '--eol'])
      .split('\n')
      .filter((line) => /^i\/(crlf|mixed)\s/.test(line));
    expect(offenders).toEqual([]);
  });
});
