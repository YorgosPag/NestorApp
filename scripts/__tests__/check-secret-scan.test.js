/**
 * CHECK 10 — Secret scan: άγκυρες του κριτηρίου «η ΤΙΜΗ κρίνει, όχι μόνο το όνομα».
 *
 * 🔴 Πληρώθηκε 2026-09-11: το `resetPassword: 'action.titles.resetPassword'` (κλειδί i18n,
 * ADR-850) μπλόκαρε ως «hardcoded secret», επειδή το κριτήριο κοίταζε μόνο το όνομα.
 * Οι άγκυρες φυλάνε ΚΑΙ τις δύο πλευρές: το κλειδί περνά, ο κωδικός ΔΕΝ περνά.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scanFile } = require('../check-secret-scan');

let dir;
beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-')); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

function scan(line) {
  const file = path.join(dir, `f${Math.random().toString(36).slice(2)}.ts`);
  fs.writeFileSync(file, `${line}\n`);
  return scanFile(file);
}

describe('CHECK 10 — secret scan', () => {
  test('Σ1 — κλειδί i18n ως τιμή ΔΕΝ είναι μυστικό (το περιστατικό του ADR-850)', () => {
    expect(scan("  resetPassword: 'action.titles.resetPassword',")).toEqual([]);
    expect(scan("  resetPassword: 'action.messages.passwordChanged',")).toEqual([]);
  });

  test('Σ2 — πραγματικός κωδικός ΠΙΑΝΕΤΑΙ, και σε σύνθετο όνομα', () => {
    expect(scan("const password = 'hunter22xyz';")).toHaveLength(1);
    expect(scan("  adminPassword: 'Sup3rS3cret!',")).toHaveLength(1);
  });

  test('Σ3 — τιμή με τελεία που ΔΕΝ είναι διαδρομή αναγνωριστικών ΠΙΑΝΕΤΑΙ', () => {
    expect(scan("  password: 'summer.2024',")).toHaveLength(1);
    expect(scan("  password: 'my secret.pass',")).toHaveLength(1);
  });

  test('Σ4 — τα μοτίβα κλειδιών API δεν επηρεάζονται', () => {
    expect(scan(`const k = "ghp_${'a'.repeat(36)}";`)).toHaveLength(1);
  });
});
