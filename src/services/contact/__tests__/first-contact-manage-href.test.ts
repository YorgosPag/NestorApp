/**
 * 🔴 **Ο ΚΑΤΟΧΟΣ ΠΑΙΡΝΕΙ ΔΡΟΜΟ ΠΡΟΣ ΤΑ ΔΙΚΑ ΤΟΥ — ΚΑΙ ΟΤΑΝ Η ΑΓΓΕΛΙΑ ΕΙΝΑΙ ΤΟΥ ΓΡΑΦΕΙΟΥ.**
 * @related ADR-843 §10.18 Ζ.1 · services/contact/first-contact-admission.ts (`manageHrefOfOwnTarget`)
 *
 * Ως τις 2026-10-08 η εταιρική θεματοφυλακή απαντούσε `null`: ο μεσίτης έβλεπε *«Αυτή είναι η αγγελία σας»*
 * **χωρίς** «Επεξεργασία». Εδώ φυλάσσεται η **σύνδεση**: ο χώρος έρχεται από τον **εντοπιστή** (ποτέ από τον
 * θεατή) και η πόρτα από τον **ένα** πίνακα (`listing-manage-route.ts`, που έχει τη δική του άγκυρα).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { mandateDetailHref } from '@/lib/mandate/mandate-routes';
import { offerDetailHref } from '@/lib/owner-property/owner-property-routes';

import { manageHrefOfOwnTarget } from '../first-contact-admission';

// Οι συνεργάτες του κριτή είναι ψευδείς: εδώ κρίνεται μόνο «τι κάνουμε με ό,τι βρήκε ο εντοπιστής».
jest.mock('@/services/contact/first-contact-projection', () => ({ loadSeekerContacts: jest.fn() }));
jest.mock('@/services/contact/first-contact-guards', () => ({ resolveTarget: jest.fn() }));
jest.mock('@/services/contact/first-contact-target-locator', () => ({ locateTarget: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-var-requires -- το mock πρέπει να διαβαστεί ΜΕΤΑ το jest.mock
const locator = require('@/services/contact/first-contact-target-locator');
const locateTarget = locator.locateTarget as jest.Mock;

const NOW = '2026-10-08T10:00:00.000Z';
const DB = {} as AdminFirestore;

beforeEach(() => locateTarget.mockReset());

describe('manageHrefOfOwnTarget', () => {
  it('προσωπική αγγελία ⇒ η καρτέλα του ιδιώτη (αμετάβλητο)', async () => {
    locateTarget.mockResolvedValue({ custody: { kind: 'personal', userId: 'user-nikos' }, facts: null });

    await expect(manageHrefOfOwnTarget(DB, { kind: 'listing', listingId: 'ownp_0001' }, NOW))
      .resolves.toBe(offerDetailHref('ownp_0001'));
  });

  it('αγγελία γραφείου (prop_*) ⇒ η καρτέλα του ακινήτου — ΟΧΙ πια null', async () => {
    locateTarget.mockResolvedValue({ custody: { kind: 'company', companyId: 'comp_0001' }, facts: null });

    await expect(manageHrefOfOwnTarget(DB, { kind: 'listing', listingId: 'prop_0001' }, NOW))
      .resolves.toBe(ENTITY_ROUTES.properties.withId('prop_0001'));
  });

  it('αγγελία πελάτη σε χώρο γραφείου (ownp_*) ⇒ η εντολή', async () => {
    locateTarget.mockResolvedValue({ custody: { kind: 'company', companyId: 'comp_0001' }, facts: null });

    await expect(manageHrefOfOwnTarget(DB, { kind: 'listing', listingId: 'ownp_0001' }, NOW))
      .resolves.toBe(mandateDetailHref('ownp_0001'));
  });

  it.each([[null], ['absent']])('ο εντοπιστής απάντησε %p ⇒ null, καμία μαντεψιά', async (answer) => {
    locateTarget.mockResolvedValue(answer);

    await expect(manageHrefOfOwnTarget(DB, { kind: 'listing', listingId: 'prop_0001' }, NOW))
      .resolves.toBeNull();
  });

  it('η βιτρίνα δεν είναι αγγελία ⇒ null, και ο εντοπιστής ΔΕΝ ρωτιέται', async () => {
    await expect(manageHrefOfOwnTarget(DB, { kind: 'professional', agencyCompanyId: 'comp_0001' }, NOW))
      .resolves.toBeNull();
    expect(locateTarget).not.toHaveBeenCalled();
  });
});
