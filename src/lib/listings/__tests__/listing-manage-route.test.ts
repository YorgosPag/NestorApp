/**
 * 🔴 **Η ΠΟΡΤΑ ΔΙΑΧΕΙΡΙΣΗΣ ΜΙΑΣ ΑΓΓΕΛΙΑΣ — ΚΑΙ Η ΕΤΑΙΡΙΚΗ ΤΗΝ ΠΑΡΑΛΑΜΒΑΝΕΙ ΤΟ ΔΙΧΤΥ.**
 * @related ADR-843 §10.18 Ζ.1 · lib/listings/listing-manage-route.ts
 *
 * Το αρχείο φυλά **δύο** πράγματα, και το δεύτερο είναι ο λόγος που υπάρχει:
 *
 * 1. κάθε ζεύγος (οικογένεια, χώρος) πάει στη **δική του** πόρτα·
 * 2. οι δύο **εταιρικές** πόρτες είναι διευθύνσεις που το δίχτυ `(app)/[...unprefixed]` **δέχεται**
 *    (`isInsideWorkspace`). Ως τις 2026-10-08 ο σύνδεσμος έλειπε με τον γραμμένο φόβο *«θα έβγαζε 404»*·
 *    αν μια πόρτα μετακομίσει εκτός χώρου, ο φόβος γίνεται **αληθινός** και αυτό εδώ κοκκινίζει.
 */

import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { mandateDetailHref } from '@/lib/mandate/mandate-routes';
import type { ListingCustody } from '@/lib/owner-property/listing-custody';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';
import { isInsideWorkspace } from '@/lib/workspace/workspace-scope';

import { listingManageHref } from '../listing-manage-route';

const PERSONAL: ListingCustody = { kind: 'personal', userId: 'user-nikos' };
const COMPANY: ListingCustody = { kind: 'company', companyId: 'comp_0001' };

describe('listingManageHref — η πόρτα ανά (οικογένεια, χώρος)', () => {
  it('ιδιώτης σε προσωπικό χώρο ⇒ η καρτέλα «η αγγελία μου»', () => {
    expect(listingManageHref('ownp_0001', PERSONAL)).toBe(offerDetailHref('ownp_0001'));
  });

  it('ιδιώτης σε χώρο γραφείου ⇒ η ΕΝΤΟΛΗ, όχι η καρτέλα του ιδιώτη', () => {
    const href = listingManageHref('ownp_0001', COMPANY);

    expect(href).toBe(mandateDetailHref('ownp_0001'));
    expect(href).not.toBe(offerDetailHref('ownp_0001'));
  });

  it('αγγελία γραφείου ⇒ η καρτέλα του ακινήτου', () => {
    expect(listingManageHref('prop_0001', COMPANY)).toBe(ENTITY_ROUTES.properties.withId('prop_0001'));
  });

  it('αγγελία γραφείου με προσωπικό χώρο ⇒ null (ο επιλυτής δεν το γεννά — καμία μαντεμένη πόρτα)', () => {
    expect(listingManageHref('prop_0001', PERSONAL)).toBeNull();
  });

  it('ταυτότητα εκτός οικογενειών ⇒ null', () => {
    expect(listingManageHref('cont_0001', COMPANY)).toBeNull();
    expect(listingManageHref('propx_0001', COMPANY)).toBeNull();
  });
});

describe('οι εταιρικές πόρτες φτάνουν — το δίχτυ τις δέχεται', () => {
  it.each([
    ['εντολή', listingManageHref('ownp_0001', COMPANY)],
    ['ακίνητο γραφείου', listingManageHref('prop_0001', COMPANY)],
  ])('%s: ωμή διεύθυνση ΜΕΣΑ σε χώρο, χωρίς πρόθεμα', (_name, href) => {
    expect(href).not.toBeNull();
    expect(isInsideWorkspace(href as string)).toBe(true);
    expect(href as string).not.toMatch(/^\/o\//);
  });
});
