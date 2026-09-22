/**
 * @jest-environment node
 */
/**
 * 🗣️ Η ΔΙΑΛΕΚΤΟΣ ΤΟΥ RUNTIME — άγκυρα (ADR-867 changelog 2026-09-22 · CHECK 3.9 κανόνας 2).
 *
 * Τρία ερωτήματα, το καθένα ΕΚΤΕΛΕΙ κάτι πραγματικό (CHECK 3.54):
 *   Δ — τι λύνει η ΠΡΑΓΜΑΤΙΚΗ μηχανή (i18next + i18next-icu από node_modules): η προϋπόθεση του κανόνα.
 *   Ρ — το repo μιλά αυτή τη διάλεκτο: κανένα κλειδί με επίθημα, σε κανένα locale.
 *   Π — η ΠΥΛΗ (το ίδιο το `check-icu-interpolation.sh`) μπλοκάρει / αφήνει.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const i18next = require('i18next');
const ICUModule = require('i18next-icu');
const {
  CLDR_PLURAL_SUFFIXES,
  pluralSuffixOf,
  findPluralSuffixKeys,
} = require('../lib/i18n-runtime-dialect');

const REPO = path.join(__dirname, '..', '..');
const ICU = ICUModule.default ?? ICUModule;

function engine(resources) {
  const instance = i18next.createInstance();
  instance.use(new ICU()).init({
    lng: 'el',
    resources: { el: { ns: resources } },
    defaultNS: 'ns',
    ns: ['ns'],
    initImmediate: false,
  });
  return instance;
}

describe('Δ — τι ΛΥΝΕΙ η πραγματική μηχανή (η προϋπόθεση του κανόνα)', () => {
  const t = engine({
    both: '{count} αδιάβαστες', both_one: '{count} αδιάβαστη', both_other: '{count} αδιάβαστες',
    suffixOnly_one: '{count} ένα', suffixOnly_other: '{count} πολλά',
    icu: '{count, plural, one {# αδιάβαστη} other {# αδιάβαστες}}',
  }).t;

  it('Δ1 — βάση + επιθήματα ⇒ ΠΑΝΤΑ η βάση: «1 αδιάβαστες» (λάθος, και αόρατο)', () => {
    expect(t('both', { count: 1 })).toBe('1 αδιάβαστες');
  });

  it('Δ2 — μόνο επιθήματα ⇒ ΩΜΟ ΚΛΕΙΔΙ', () => {
    expect(t('suffixOnly', { count: 1 })).toBe('suffixOnly');
  });

  it('Δ4 — και το `_plural` του i18next v3 είναι νεκρό: βάση = ενικός ⇒ «πριν 5 λεπτό»', () => {
    const legacy = engine({ minutesAgo: 'πριν {n} λεπτό', minutesAgo_plural: 'πριν {n} λεπτά' }).t;
    expect(legacy('minutesAgo', { n: 5, count: 5 })).toBe('πριν 5 λεπτό');
  });

  it('Δ3 — ICU μέσα στο κλειδί ⇒ σωστός ενικός ΚΑΙ πληθυντικός', () => {
    expect(t('icu', { count: 1 })).toBe('1 αδιάβαστη');
    expect(t('icu', { count: 2 })).toBe('2 αδιάβαστες');
  });
});

describe('Ρ — το repo μιλά τη διάλεκτο του runtime', () => {
  it('Ρ1 — κανένα locale (el, en) δεν έχει κλειδί με επίθημα πληθυντικού', () => {
    const offenders = ['el', 'en'].flatMap((lang) => {
      const dir = path.join(REPO, 'src', 'i18n', 'locales', lang);
      return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((file) =>
        findPluralSuffixKeys(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))).map((k) => `${lang}/${file}:${k}`));
    });
    expect(offenders).toEqual([]);
  });

  it('Ρ2 — ο εντοπισμός: φύλλο με επίθημα ναι· βάση, ή όνομα που απλώς ΠΕΡΙΕΧΕΙ τη λέξη, όχι', () => {
    expect(findPluralSuffixKeys({ a: { b_one: 'x', b: 'y' }, c_other: 'z' })).toEqual(['a.b_one', 'c_other']);
    expect(findPluralSuffixKeys({ otherwise: 'x', _other: 'y', nested: { others: 'z' } })).toEqual([]);
    expect(pluralSuffixOf('count_many')).toBe('_many');
    // ⛔ MUTATION: βγάλε το `_plural` από τη λίστα ⇒ κόκκινο (3 οικογένειες v3 βρέθηκαν ζωντανές, 2026-09-22).
    expect(findPluralSuffixKeys({ relative: { minutesAgo: 'x', minutesAgo_plural: 'y' } })).toEqual(['relative.minutesAgo_plural']);
    expect(CLDR_PLURAL_SUFFIXES).toEqual(expect.arrayContaining(['_zero', '_one', '_two', '_few', '_many', '_other']));
  });
});

describe('Π — η ίδια η πύλη (CHECK 3.9) εκτελείται', () => {
  // ⛔ ΚΑΝΕΝΑ `it.skip` όταν λείπει το bash: σιωπηλό πράσινο = «δεν κοίταξα». Χωρίς bash η πύλη ΔΕΝ τρέχει ούτε στο hook.
  const run = it;
  let dir;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'icu-dialect-'));
    fs.mkdirSync(path.join(dir, 'src', 'i18n', 'locales', 'el'), { recursive: true });
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  function gate(content) {
    const file = path.join(dir, 'src', 'i18n', 'locales', 'el', `f${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(file, JSON.stringify(content));
    const posix = file.replace(/\\/g, '/');
    return spawnSync('bash', ['scripts/check-icu-interpolation.sh', posix], { cwd: REPO, encoding: 'utf8' });
  }

  run('Π1 — επίθημα πληθυντικού ⇒ ΜΠΛΟΚ (exit 1), με το όνομα του κλειδιού', () => {
    const result = gate({ unread: { threads: 'x', threads_one: 'y' } });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('unread.threads_one');
  });

  run('Π2 — ICU πληθυντικός ⇒ ΠΕΡΝΑ (exit 0)', () => {
    const result = gate({ unread: { threads: '{count, plural, one {# α} other {# β}}' } });
    expect(result.status).toBe(0);
  });
});
