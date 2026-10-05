/**
 * ΑΓΚΥΡΕΣ — **η υπο-ετικέτα και ο δράστης λύνονται ζωντανά, και θεραπεύουν ό,τι έχει ήδη γραφτεί**
 * (ADR-195 · ADR-332 D29).
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το ιστορικό έργων και κτιρίων έδειχνε «street», «number», «floor» αντί για
 * «Οδός», «Αριθμός», «Όροφος». Οι εγγραφές στη βάση κουβαλούν `label: 'street'` (το ίδιο το όνομα
 * ως ετικέτα του) και ο αναγνώστης το προτιμούσε από τη μετάφραση. Το ιστορικό είναι αμετάβλητο,
 * άρα η θεραπεία κρίνεται **εδώ**, πάνω στο σχήμα που υπάρχει ήδη αποθηκευμένο.
 *
 * ⚠️ Οι μεταφραστές διαβάζουν τα **πραγματικά** locale JSON — όχι χειρόγραφο πίνακα: η άγκυρα
 * πρέπει να κοκκινίσει όταν σβηστεί ένα κλειδί, όχι να συμφωνεί με τον εαυτό της.
 */

/* global describe, it, expect */

import { ADDRESS_COLLECTION_DEF } from '@/config/audit-tracked-fields';
import { SYSTEM_IDENTITY, isSystemActorId } from '@/config/domain-constants';
import elAudit from '@/i18n/locales/el/common-audit.json';
import enAudit from '@/i18n/locales/en/common-audit.json';
import elCommon from '@/i18n/locales/el/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import { lookupLocaleString } from '@/i18n/locale-key-lookup';
import { resolveActorName, resolveCauseText } from '../audit-actor';
import { resolveSubFieldLabel } from '../audit-field-descriptor';

/**
 * Το `t` του i18next σε μικρογραφία: το πρώτο namespace που έχει **κείμενο** στο κλειδί· αλλιώς το
 * ίδιο το κλειδί (και για κόμβο-αντικείμενο — ό,τι ακριβώς απορρίπτει ο αναγνώστης).
 */
function translatorOf(...bundles: unknown[]) {
  return (key: string): unknown =>
    bundles.map((bundle) => lookupLocaleString(bundle, key)).find((text) => text !== undefined) ?? key;
}

const LANGUAGES = [
  ['el', translatorOf(elCommon, elAudit)],
  ['en', translatorOf(enCommon, enAudit)],
] as const;

const el = LANGUAGES[0][1];

/** Όπως φτάνει μια υπο-αλλαγή διεύθυνσης από τη βάση σήμερα. */
const stored = (subField: string) => ({ subField, def: ADDRESS_COLLECTION_DEF, storedLabel: subField, translate: el });

describe('υπο-ετικέτα διεύθυνσης', () => {
  it('Υ1 — η αποθηκευμένη ψευδο-ετικέτα `street` ΔΕΝ νικά τη μετάφραση (παλιές εγγραφές)', () => {
    expect(resolveSubFieldLabel(stored('street'))).toEqual({ text: 'Οδός', isSnapshot: false });
    expect(resolveSubFieldLabel(stored('number'))).toEqual({ text: 'Αριθμός', isSnapshot: false });
  });

  it('Υ2 — το `floor` βρίσκει τη ΔΙΚΗ του ετικέτα, όχι τον κόμβο της οντότητας «όροφος»', () => {
    // Χωρίς εμβέλεια το `audit.fields.floor` είναι κόμβος, όχι κείμενο ⇒ έβγαινε ωμό «floor».
    expect(el('audit.fields.floor')).toBe('audit.fields.floor');
    expect(resolveSubFieldLabel(stored('floor'))).toEqual({ text: 'Όροφος', isSnapshot: false });
  });

  it('Υ3 — η θέση που γράφει η μηχανή ΧΩΡΙΣ ετικέτα λύνεται από τη γενική', () => {
    const label = resolveSubFieldLabel({ subField: 'coordinates', def: ADDRESS_COLLECTION_DEF, storedLabel: undefined, translate: el });

    expect(label).toEqual({ text: 'Συντεταγμένες', isSnapshot: false });
  });

  it.each(LANGUAGES)('Υ4 — [%s] ΚΑΘΕ παρακολουθούμενο υπο-πεδίο διεύθυνσης έχει ζωντανή ετικέτα', (_language, translate) => {
    const raw = (ADDRESS_COLLECTION_DEF.trackSubFields ?? []).filter((subField) => {
      const label = resolveSubFieldLabel({ subField, def: ADDRESS_COLLECTION_DEF, storedLabel: subField, translate });
      return label.text === subField || label.isSnapshot;
    });

    expect(raw).toEqual([]);
  });

  it('Υ5 — χωρίς περιγραφέα (άγνωστο πεδίο-γονέας) πέφτει στη γενική, όπως πριν', () => {
    const label = resolveSubFieldLabel({ subField: 'street', def: undefined, storedLabel: undefined, translate: el });

    expect(label).toEqual({ text: 'Οδός', isSnapshot: false });
  });

  it('Υ6 — πραγματικό στιγμιότυπο (όνομα που ΔΙΑΦΕΡΕΙ από το υπο-πεδίο) δηλώνεται ως τέτοιο', () => {
    const label = resolveSubFieldLabel({ subField: 'retiredThing', def: undefined, storedLabel: 'Παλιό όνομα', translate: el });

    expect(label).toEqual({ text: 'Παλιό όνομα', isSnapshot: true });
  });

  it('Υ7 — τίποτα γνωστό ⇒ το ωμό όνομα, ορατό', () => {
    const label = resolveSubFieldLabel({ subField: 'retiredThing', def: undefined, storedLabel: 'retiredThing', translate: el });

    expect(label).toEqual({ text: 'retiredThing', isSnapshot: false });
  });
});

describe('δράστης', () => {
  it.each([
    ['system', true],
    ['system:address-position', true],
    ['system:ingestion', true],
    ['systematic_user', false],
    ['WKBWEg3DSfcdSbLNJfzGEW3vkct1', false],
    [null, false],
    [undefined, false],
  ])('Δ1 — isSystemActorId(%s) = %s', (actorId, expected) => {
    expect(isSystemActorId(actorId)).toBe(expected);
  });

  it('Δ2 — η μηχανή λύνεται από την ΤΑΥΤΟΤΗΤΑ: το αποθηκευμένο «System» δεν φτάνει στην οθόνη', () => {
    const name = resolveActorName({
      performedBy: SYSTEM_IDENTITY.ADDRESS_POSITION_ID,
      performedByName: SYSTEM_IDENTITY.DISPLAY_NAME,
      translate: el,
    });

    expect(name).toBe('Σύστημα · εντοπισμός θέσης');
  });

  it('Δ3 — διεργασία χωρίς δικό της όνομα πέφτει στο γενικό «Σύστημα»', () => {
    expect(resolveActorName({ performedBy: 'system:unknown-job', performedByName: null, translate: el })).toBe('Σύστημα');
    expect(resolveActorName({ performedBy: SYSTEM_IDENTITY.ID, performedByName: 'System', translate: el })).toBe('Σύστημα');
  });

  it.each(LANGUAGES)('Δ4 — [%s] κάθε δηλωμένη ταυτότητα μηχανής έχει όνομα στη γλώσσα του θεατή', (_language, translate) => {
    // Από το ΙΔΙΟ το μητρώο ταυτοτήτων, όχι από χειρόγραφη λίστα: νέα διεργασία χωρίς όνομα κοκκινίζει εδώ.
    // (`Set`: το `TYPE` έχει την ίδια τιμή με το `ID`.)
    const declared = [...new Set(Object.values(SYSTEM_IDENTITY).filter(isSystemActorId))];
    expect(declared).toEqual(expect.arrayContaining([SYSTEM_IDENTITY.FLOOR_STACK_ID, SYSTEM_IDENTITY.FLOOR_REF_ID]));

    const names = declared.map((performedBy) => resolveActorName({ performedBy, performedByName: null, translate }));
    for (const name of names) {
      expect(name).toEqual(expect.any(String));
      expect(name).not.toMatch(/^audit\./);
    }
    // Κάθε διεργασία έχει ΔΙΚΟ της όνομα — αλλιώς ο άνθρωπος δεν ξέρει ποια μηχανή έγραψε.
    expect(new Set(names).size).toBe(declared.length);
  });

  it('Δ5 — ο άνθρωπος ΔΕΝ μεταφράζεται: το όνομά του, αυτούσιο· χωρίς όνομα ⇒ null', () => {
    const human = { performedBy: 'WKBWEg3DSfcdSbLNJfzGEW3vkct1', translate: el };

    expect(resolveActorName({ ...human, performedByName: 'Γεώργιος Παγώνης' })).toBe('Γεώργιος Παγώνης');
    expect(resolveActorName({ ...human, performedByName: null })).toBeNull();
  });

  it('Δ6 — αν λείψει η μετάφραση, πέφτει στο στιγμιότυπο αντί να δείξει ωμό κλειδί', () => {
    const name = resolveActorName({ performedBy: 'system', performedByName: 'System', translate: (key) => key });

    expect(name).toBe('System');
  });
});

describe('αιτία παράγωγης εγγραφής', () => {
  /** Το `t` με παρεμβολή `{παράμετρος}` — όπως το ICU του έργου. */
  const withParams = (translate: (key: string) => unknown) => (key: string, params: Record<string, string> = {}) => {
    const text = translate(key);
    return typeof text === 'string' ? text.replace(/\{(\w+)\}/g, (_match, name: string) => params[name] ?? '') : text;
  };
  const tEl = withParams(el);

  const cause = {
    auditId: 'eaud_1',
    initiatedBy: 'u_1',
    initiatedByName: 'Γιώργος',
    entityType: 'floor',
    entityId: 'flr_1',
    entityName: '1ος Όροφος',
  } as const;
  /** Γραμμή του 3ου ορόφου, που μετακινήθηκε επειδή άλλαξε ο 1ος. */
  const derived = { entityType: 'floor', entityId: 'flr_3', cause } as const;

  it('Ι1 — άμεση πράξη (χωρίς αιτία) ⇒ τίποτα να ειπωθεί', () => {
    expect(resolveCauseText({ entityType: 'floor', entityId: 'flr_3' }, tEl)).toBeNull();
  });

  it('Ι2 — παράγωγη σε ΑΛΛΗ οντότητα ⇒ ποιος ΚΑΙ πού', () => {
    expect(resolveCauseText(derived, tEl)).toBe('λόγω αλλαγής από Γιώργος στο «1ος Όροφος»');
  });

  it('Ι3 — παράγωγη στην ΙΔΙΑ οντότητα ⇒ μόνο ποιος (η οντότητα θα ήταν πλεονασμός)', () => {
    expect(resolveCauseText({ ...derived, entityId: 'flr_1' }, tEl)).toBe('λόγω αλλαγής από Γιώργος');
  });

  it('Ι4 — άγνωστο όνομα ⇒ λέγεται μόνο το πού, ποτέ κενή θέση ονόματος', () => {
    expect(resolveCauseText({ ...derived, cause: { ...cause, initiatedByName: null } }, tEl)).toBe('λόγω αλλαγής στο «1ος Όροφος»');
  });

  it.each(LANGUAGES)('Ι5 — [%s] οι τρεις φράσεις υπάρχουν στη γλώσσα του θεατή (ποτέ ωμό κλειδί)', (_language, translate) => {
    const t = withParams(translate);
    const texts = [
      resolveCauseText(derived, t),
      resolveCauseText({ ...derived, entityId: 'flr_1' }, t),
      resolveCauseText({ ...derived, cause: { ...cause, initiatedByName: null } }, t),
    ];

    for (const text of texts) expect(text).toEqual(expect.stringContaining(' '));
    expect(new Set(texts).size).toBe(3);
  });
});
