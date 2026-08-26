/**
 * ΑΓΚΥΡΑ — «η κατάσταση έργου φτάνει στην οθόνη ΜΕΤΑΦΡΑΣΜΕΝΗ» (ADR-806 §7 #2, N.11).
 *
 * 🔴 ΤΙ ΦΥΛΑΕΙ. Μέχρι τις 2026-08-25 ο `PROJECT_STATUS_LABELS` κρατούσε **ωμό ελληνικό
 * κείμενο** (`'Σχεδιασμός'`…) και η κάρτα έργου το έβαφε **αμετάφραστο** — δηλαδή
 * αγγλόφωνος χρήστης έβλεπε ελληνικά, σε hook που καλεί `t(…)` σε κάθε άλλο του πεδίο.
 * Καμία πύλη δεν το έβλεπε: το CHECK 3.8 ρωτά «λείπει το κλειδί;» και **δεν υπήρχε
 * κλήση `t()`** για να λείψει κλειδί· το 3.51 κοιτά **ωμά κλειδιά** στο SSR HTML και
 * εδώ βαφόταν ωμό **κείμενο**, που είναι αόρατο σε κάθε σαρωτή κλειδιών.
 *
 * ⚠️ Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ ΤΟ SSoT ΚΑΙ ΤΑ ΠΡΑΓΜΑΤΙΚΑ LOCALE — ποτέ fixture. Ένα test που
 * έφτιαχνε δικό του χάρτη καταστάσεων θα έμενε πράσινο ενώ η εφαρμογή χαλούσε (το
 * σφάλμα του ADR-790 §9.1: ο παρονομαστής μετακινείται μαζί με τη μετάλλαξη).
 */

import fs from 'node:fs';
import path from 'node:path';

import { PROJECT_STATUSES, type ProjectStatus } from '@/constants/project-statuses';
import { PROJECT_STATUS_LABELS } from '@/types/project';
import { splitNamespacedLabelKey } from '@/core/badges/badge-label-key';

const LOCALES = ['el', 'en'] as const;
const localeDir = (lang: string) => path.join(process.cwd(), 'src', 'i18n', 'locales', lang);

function lookup(lang: string, ns: string, key: string): unknown {
  const file = path.join(localeDir(lang), `${ns}.json`);
  if (!fs.existsSync(file)) return undefined;
  const bundle: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    bundle,
  );
}

describe('ADR-806 §7 #2 — κλειδιά κατάστασης έργου', () => {
  it('Π0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχουν καταστάσεις προς έλεγχο', () => {
    expect(PROJECT_STATUSES.length).toBeGreaterThanOrEqual(6);
  });

  it('Κ1 — ο πίνακας καλύπτει ΑΚΡΙΒΩΣ τις κανονικές καταστάσεις (καμία λιγότερη, καμία παραπάνω)', () => {
    expect(Object.keys(PROJECT_STATUS_LABELS).sort()).toEqual([...PROJECT_STATUSES].sort());
  });

  it('🔴 Κ2 — ΚΑΜΙΑ τιμή δεν είναι έτοιμο κείμενο: κάθε μία σπάει σε namespace + κλειδί', () => {
    // Το μήνυμα αποτυχίας ΟΝΟΜΑΖΕΙ τον ένοχο: «planning -> Σχεδιασμός -> ΩΜΟ ΚΕΙΜΕΝΟ».
    const notKeys = PROJECT_STATUSES
      .map((status) => ({ status, raw: PROJECT_STATUS_LABELS[status as ProjectStatus] }))
      .filter(({ raw }) => splitNamespacedLabelKey(raw) === null)
      .map(({ status, raw }) => `${status} -> ${raw} -> ΩΜΟ ΚΕΙΜΕΝΟ`);
    expect(notKeys).toEqual([]);
  });

  it('🔴 Κ3 — κανένα ελληνικό γράμμα μέσα στις τιμές (ο έλεγχος που θα είχε πιάσει το «Σχεδιασμός»)', () => {
    const greek = Object.entries(PROJECT_STATUS_LABELS).filter(([, v]) => /[Ͱ-Ͽἀ-῿]/.test(v));
    expect(greek).toEqual([]);
  });

  it.each(LOCALES)('🔴 Κ4 — κάθε κλειδί ΥΠΑΡΧΕΙ στο πραγματικό locale «%s»', (lang) => {
    const missing: string[] = [];
    for (const status of PROJECT_STATUSES) {
      const ref = splitNamespacedLabelKey(PROJECT_STATUS_LABELS[status as ProjectStatus]);
      if (!ref) { missing.push(`${status} (δεν είναι κλειδί)`); continue; }
      const value = lookup(lang, ref.ns, ref.key);
      if (typeof value !== 'string' || value.length === 0) missing.push(`${ref.ns}:${ref.key}`);
    }
    expect(missing).toEqual([]);
  });

  it('🔴 Κ5 — τα ΑΓΓΛΙΚΑ δεν είναι αντίγραφο των ελληνικών (η βλάβη που διορθώθηκε)', () => {
    const identical: string[] = [];
    for (const status of PROJECT_STATUSES) {
      const ref = splitNamespacedLabelKey(PROJECT_STATUS_LABELS[status as ProjectStatus]);
      if (!ref) continue;
      const el = lookup('el', ref.ns, ref.key);
      const en = lookup('en', ref.ns, ref.key);
      if (typeof el === 'string' && el === en) identical.push(`${ref.ns}:${ref.key} = "${el}"`);
    }
    expect(identical).toEqual([]);
  });
});

describe('splitNamespacedLabelKey — ο κοινός resolver', () => {
  it('Σ1 — κόβει ΜΟΝΟ το πρώτο τμήμα, το υπόλοιπο μένει ακέραιο', () => {
    expect(splitNamespacedLabelKey('projects.status.planning')).toEqual({ ns: 'projects', key: 'status.planning' });
  });

  it('🔴 Σ2 — έτοιμο κείμενο ΔΕΝ γίνεται κλειδί (καμία μαντεψιά namespace)', () => {
    expect(splitNamespacedLabelKey('Σχεδιασμός')).toBeNull();
    expect(splitNamespacedLabelKey('In Trash')).toBeNull();
  });

  it('🔴 Σ3 — εκφυλισμένες μορφές δεν γεννούν κενό namespace ή κενό κλειδί', () => {
    expect(splitNamespacedLabelKey('.leading')).toBeNull();
    expect(splitNamespacedLabelKey('trailing.')).toBeNull();
    expect(splitNamespacedLabelKey('')).toBeNull();
    expect(splitNamespacedLabelKey(undefined)).toBeNull();
  });
});
