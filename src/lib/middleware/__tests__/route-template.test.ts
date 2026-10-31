/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΠΡΟΤΥΠΟΥ ΔΙΑΔΡΟΜΗΣ** — ADR-855 (κλειδί ορίου ρυθμού).
 * @related lib/middleware/route-template.ts · __tests__/rate-limit-declared-category.test.ts (Τ — ο wrapper)
 *
 * 🔑 Το ερώτημα κάθε άγκυρας: *«δύο διαφορετικές τιμές στο ίδιο δυναμικό τμήμα δίνουν το ΙΔΙΟ κλειδί;»* —
 * και ο παρονομαστής: *«η στατική διαδρομή μένει αυτούσια;»* (αλλιώς ένα «όλα γίνονται `/api`» θα περνούσε).
 */

import { routeParamsOf, routeTemplateOf } from '../route-template';

describe('routeTemplateOf — το κλειδί είναι το πρότυπο', () => {
  /**
   * 🔴 Η ΑΓΚΥΡΑ ΤΟΥ ΕΥΡΗΜΑΤΟΣ: πριν, το `/api/contacts/A` και το `/api/contacts/B` ήταν δύο κουβάδες.
   * ΜΕΤΑΛΛΑΞΗ: `return { template: pathname, resolved: true }` ⇒ κόκκινο.
   */
  it('🔴 Τ1 — δύο ids ⇒ ΕΝΑ πρότυπο', () => {
    const a = routeTemplateOf('/api/contacts/A', { id: 'A' }).template;
    const b = routeTemplateOf('/api/contacts/B', { id: 'B' }).template;

    expect({ a, b }).toEqual({ a: '/api/contacts/[id]', b: '/api/contacts/[id]' });
  });

  it('Τ2 — ο παρονομαστής: στατική διαδρομή μένει αυτούσια (χωρίς τελική κάθετο και query)', () => {
    expect(routeTemplateOf('/api/projects/list/', {})).toEqual({ template: '/api/projects/list', resolved: true });
    expect(routeTemplateOf('/api/search?q=x', {}).template).toBe('/api/search');
  });

  it('Τ3 — catch-all: ΟΛΑ τα πλακίδια μιας περιήγησης ⇒ ΕΝΑ πρότυπο (η υπόσχεση του ASSET)', () => {
    const tile = (path: string[]) =>
      routeTemplateOf(`/api/spatial-tours/listing/L1/media/${path.join('/')}`, {
        kind: 'listing',
        subjectId: 'L1',
        path,
      }).template;

    expect(tile(['h1', 'z2', 'f_0_0.jpg'])).toBe('/api/spatial-tours/[kind]/[subjectId]/media/[...path]');
    expect(tile(['h9', 'z4', 'b_3_7.jpg'])).toBe(tile(['h1', 'z2', 'f_0_0.jpg']));
  });

  it('Τ4 — ίδια τιμή σε δύο τμήματα: ο δρομέας τα αποδίδει με τη σειρά, όχι δύο φορές στο πρώτο', () => {
    expect(routeTemplateOf('/api/projects/X/buildings/X', { projectId: 'X', buildingId: 'X' }).template)
      .toBe('/api/projects/[projectId]/buildings/[buildingId]');
  });

  it('Τ5 — κωδικοποιημένο τμήμα ⇔ αποκωδικοποιημένη τιμή (και ελληνικά)', () => {
    const encoded = `/api/files/${encodeURIComponent('Σχέδιο α.pdf')}`;

    expect(routeTemplateOf(encoded, { name: 'Σχέδιο α.pdf' }).template).toBe('/api/files/[name]');
    // …και όταν η διαδρομή έδωσε την τιμή ακόμη κωδικοποιημένη.
    expect(routeTemplateOf(encoded, { name: encodeURIComponent('Σχέδιο α.pdf') }).template).toBe('/api/files/[name]');
  });

  it('Τ6 — `[[...opt]]` χωρίς τιμή δεν είναι αποτυχία', () => {
    expect(routeTemplateOf('/api/docs', { slug: undefined })).toEqual({ template: '/api/docs', resolved: true });
    expect(routeTemplateOf('/api/docs', { slug: [] })).toEqual({ template: '/api/docs', resolved: true });
  });

  /**
   * ⛔ Αποτυχία = ΧΟΝΤΡΟΤΕΡΟΣ κουβάς. Αν έμενε η ωμή διαδρομή, «άλλαξε την κωδικοποίηση» θα ξανάδινε
   * νέο όριο ανά τιμή. ΜΕΤΑΛΛΑΞΗ: επιστροφή `pathname` στο `at < 0` ⇒ κόκκινο.
   */
  it('🔴 Τ7 — τιμή που δεν βρίσκεται στη διαδρομή ⇒ κουβάς της ΠΕΡΙΟΧΗΣ, ίδιος για κάθε τιμή', () => {
    const one = routeTemplateOf('/api/contacts/A/notes', { id: 'Z' });
    const two = routeTemplateOf('/api/contacts/B/notes', { id: 'Q' });

    expect(one).toEqual({ template: '/api/contacts/[unresolved]', resolved: false });
    expect(two.template).toBe(one.template);
  });
});

describe('routeParamsOf — το πλαίσιο του handler, όποια μορφή κι αν έχει', () => {
  it('Π1 — Promise (Next 15+) · αντικείμενο · τίποτα', async () => {
    expect(await routeParamsOf({ params: Promise.resolve({ id: 'A' }) })).toEqual({ id: 'A' });
    expect(await routeParamsOf({ params: { id: 'A' } })).toEqual({ id: 'A' });
    expect(await routeParamsOf(undefined)).toEqual({});
  });

  it('Π2 — ΠΟΤΕ δεν πετά: απορριφθέν Promise ⇒ στατική διαδρομή, όχι πεσμένο αίτημα', async () => {
    expect(await routeParamsOf({ params: Promise.reject(new Error('x')) })).toEqual({});
  });
});
