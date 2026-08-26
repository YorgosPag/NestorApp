/**
 * ΑΓΚΥΡΑ — ADR-812: ένα λεξιλόγιο, πολλοί μηχανισμοί λύσης, ΚΑΜΙΑ δεύτερη πηγή.
 *
 * ⚠️ ΤΡΕΧΕΙ ΠΑΝΩ ΣΤΑ ΠΡΑΓΜΑΤΙΚΑ locale JSON, όχι σε fixture. Ένα fixture θα
 * αποδείκνυε ότι η συνάρτηση διαβάζει σωστά ένα αντικείμενο· το ερώτημα είναι
 * αν διαβάζει σωστά **τα αρχεία που σερβίρονται**.
 */
import { projectStatusText, projectStatusTexts } from '../project-status-text';
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '../project-statuses';
import { STATUS_LABELS } from '@/services/ai-pipeline/modules/uc-011-admin-project-status/project-status-types';
import elProjects from '@/i18n/locales/el/projects.json';
import enProjects from '@/i18n/locales/en/projects.json';

describe('ADR-812 — κείμενο κατάστασης εκτός React', () => {
  it('Τ0 ΠΑΡΟΝΟΜΑΣΤΗΣ — τα locale όντως περιέχουν το μπλοκ καταστάσεων', () => {
    expect(Object.keys(elProjects.status).length).toBeGreaterThanOrEqual(PROJECT_STATUSES.length);
    expect(Object.keys(enProjects.status).length).toBeGreaterThanOrEqual(PROJECT_STATUSES.length);
  });

  it.each([...PROJECT_STATUSES])('«%s»: λύνεται σε ΠΡΑΓΜΑΤΙΚΟ κείμενο, και στις δύο γλώσσες', s => {
    for (const locale of ['el', 'en'] as const) {
      const text = projectStatusText(s, locale);
      expect(text).not.toBe(s);                       // δεν έπεσε στο fallback
      expect(text).not.toContain('.');                // δεν είναι ωμό κλειδί
      expect(text.length).toBeGreaterThan(1);
    }
  });

  it('τα ελληνικά ΔΙΑΦΕΡΟΥΝ από τα αγγλικά — δεν σερβίρεται μία γλώσσα ως δύο', () => {
    const el = projectStatusTexts('el');
    const en = projectStatusTexts('en');
    for (const s of PROJECT_STATUSES) expect(el[s]).not.toBe(en[s]);
    expect(el.deleted).toBe('Στον κάδο');
    expect(en.deleted).toBe('In Trash');
  });

  it('ο πίνακας καλύπτει ΑΚΡΙΒΩΣ το λεξιλόγιο', () => {
    expect(Object.keys(projectStatusTexts('el')).sort()).toEqual([...PROJECT_STATUSES].sort());
  });

  it('🔴 λύνει το ΙΔΙΟ κλειδί που δηλώνει το λεξιλόγιο — καμία δεύτερη διαδρομή', () => {
    // el/projects.json:status.onHold είναι η ΜΟΝΗ πηγή· αν κάποιος αλλάξει
    // το κλειδί στο SSoT, το κείμενο ΠΡΕΠΕΙ να ακολουθήσει ή να πέσει στο fallback.
    expect(PROJECT_STATUS_LABELS.on_hold).toBe('projects.status.onHold');
    expect(projectStatusText('on_hold', 'el')).toBe(elProjects.status.onHold);
    expect(projectStatusText('on_hold', 'en')).toBe(enProjects.status.onHold);
  });

  it('άγνωστο locale ⇒ ΑΝΑΓΝΩΡΙΣΤΙΚΟ, ποτέ σιωπηλά άλλη γλώσσα', () => {
    expect(projectStatusText('planning', 'de' as never)).toBe('planning');
  });

  it('το AI pipeline καταναλώνει την ΙΔΙΑ πηγή, με τον κάδο μέσα', () => {
    expect(STATUS_LABELS).toEqual(projectStatusTexts('el'));
    expect(STATUS_LABELS.deleted).toBe('Στον κάδο');   // έλειπε πριν
  });
});
