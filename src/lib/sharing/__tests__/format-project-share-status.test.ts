/**
 * ΑΓΚΥΡΑ — ADR-812: το κοινοποιημένο κείμενο δείχνει τη ΣΩΣΤΗ κατάσταση.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `format-project-share.ts` κρατούσε δικό του πίνακα
 * κλειδιών — όγδοο σώμα του ίδιου λεξιλογίου — και όσο του έλειπε η γραμμή για
 * τον κάδο, παρουσίαζε **διαγραμμένο** έργο ως «Ακυρωμένο». Το αρχείο είχε
 * **ΜΗΔΕΝ** άγκυρες: γι' αυτό ακριβώς το bug προσγειώθηκε και έζησε.
 *
 * ⚠️ Το `t` εδώ ΔΕΝ μεταφράζει — επιστρέφει `<ns>:<key>`, ώστε η άγκυρα να
 * κρίνει **ποιο κλειδί ζητήθηκε**, όχι πώς μεταφράστηκε. Μια άγκυρα που κρίνει
 * μεταφρασμένο κείμενο σπάει σε κάθε αλλαγή διατύπωσης και δεν λέει τίποτα για
 * την ταυτότητα του κλειδιού.
 */
import type { TFunction } from 'i18next';
import { formatProjectsForShare } from '../format-project-share';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '@/constants/project-statuses';
import type { Project, ProjectStatus } from '@/types/project';

const t = ((key: string, opts?: { ns?: string; count?: number }) =>
  opts?.ns ? `${opts.ns}:${key}` : key) as unknown as TFunction;

const project = (status: ProjectStatus): Project =>
  ({ id: 'proj_1', name: 'ΕΡΓΟ Α', status, companyId: 'comp_1' }) as unknown as Project;

describe('ADR-812 — κοινοποίηση έργου: μία πηγή ετικετών', () => {
  it('Π0 ΠΑΡΟΝΟΜΑΣΤΗΣ — το κείμενο περιέχει όντως γραμμή κατάστασης', () => {
    expect(formatProjectsForShare([project('in_progress')], t).text)
      .toContain('projects:share.status');
  });

  it.each([...PROJECT_STATUSES])('ζητά το κλειδί του ΛΕΞΙΛΟΓΙΟΥ για «%s»', status => {
    const expected = PROJECT_STATUS_LABELS[status].replace('.', ':'); // projects.status.x → projects:status.x
    expect(formatProjectsForShare([project(status)], t).text).toContain(expected);
  });

  it('🔴 ΤΟ ΙΣΤΟΡΙΚΟ BUG: «deleted» ΔΕΝ παρουσιάζεται ως «cancelled»', () => {
    const text = formatProjectsForShare([project('deleted')], t).text;
    expect(text).toContain('projects:status.deleted');
    expect(text).not.toContain('projects:status.cancelled');
  });

  it('κάθε κατάσταση δίνει ΔΙΑΦΟΡΕΤΙΚΟ κλειδί — καμία δεν καταπίνει άλλη', () => {
    const keys = PROJECT_STATUSES.map(s => {
      const text = formatProjectsForShare([project(s)], t).text;
      return text.match(/projects:status\.\w+/)?.[0];
    });
    expect(new Set(keys).size).toBe(PROJECT_STATUSES.length);
    expect(keys.every(Boolean)).toBe(true);
  });

  it('η σύνοψη πολλαπλών έργων χρησιμοποιεί την ΙΔΙΑ πηγή', () => {
    const text = formatProjectsForShare([project('on_hold'), project('deleted')], t).text;
    expect(text).toContain('projects:status.onHold');
    expect(text).toContain('projects:status.deleted');
  });
});
