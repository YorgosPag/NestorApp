/**
 * =============================================================================
 * ADR-841 §7 **Α18.12** — **Η ΟΘΟΝΗ ΤΗΣ ΜΙΑΣ ΕΝΤΟΛΗΣ, ΕΚΤΕΛΕΣΜΕΝΗ**
 * =============================================================================
 *
 * Το πρότυπο μέτρησης προορισμού είναι της **Α18.9.β**, και είναι **δύο** ερωτήσεις:
 *
 *   1. *«δείχνει το πράγμα;»*
 *   2. *«δείχνει **ΑΥΤΟ** που ανακοίνωσε η ειδοποίηση;»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΔΩ ΚΑΙ ΟΧΙ ΜΟΝΟ ΣΕ ΦΥΛΛΟΜΕΤΡΗΤΗ — ΔΗΛΩΜΕΝΟ, ΟΧΙ ΥΠΟΝΟΟΥΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το περπάτημα **έγινε** και απέδειξε τα μισά *(ADR-841 Α18.12.η)*: η ωμή διεύθυνση
 * ανακατευθύνθηκε σωστά, ο διακομιστής απάντησε `found` με τη σωστή γραμμή, και το SSR
 * HTML βγήκε **χωρίς ωμά κλειδιά**. Η **απόδοση στον πελάτη** έμεινε αμέτρητη: η
 * επέκταση Chrome απάντησε *«Cannot access contents of the page — Extension manifest
 * must request permission»* για το `localhost:3000`, μετά από δύο παγώματα του
 * renderer *(η μετρημένη παγίδα του §7.1)*.
 *
 * ⇒ Αυτή η σουίτα **δεν αντικαθιστά** το περπάτημα· κάνει το ερώτημα **εκτελέσιμο**,
 * ώστε να μην εξαρτάται από επέκταση φυλλομετρητή που μπορεί να μη λειτουργεί.
 *
 * ⚠️ **ΜΟΝΤΑΡΕΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ COMPONENT** — όχι αντίγραφο, όχι fixture της οθόνης. Ό,τι
 * μετριέται εδώ είναι ό,τι τρέχει.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';

import { MandateDetailContent } from '@/components/mandate/MandateDetailContent';
import {
  CATALOG_KEYS,
  DETAIL_ABSENCE_KEYS,
  DETAIL_KEYS,
  STANDING_LABEL_KEYS,
} from '@/components/mandate/catalog/mandate-catalog-labels';
import { CLIENT_NAME_IS_UNNAMED } from '@/lib/mandate/mandate-client-name';
import {
  MANDATE_FOUND,
  MANDATE_MISSING,
  MANDATE_NOT_A_MANDATE,
} from '@/lib/mandate/mandate-detail-outcome';
import { mandateDetailHref, MANDATE_CATALOG_ROUTE } from '@/lib/mandate/mandate-routes';
import { LIVE } from '@/lib/mandate/mandate-standing';
import type { DetailLoad } from '@/services/mandate/mandate-catalog.client';
import type { MandateCatalogRow } from '@/lib/mandate/mandate-catalog-row';

// 🔑 **Τα κλειδιά ΔΕΝ αποδίδονται**: το `t` επιστρέφει το κλειδί, άρα το test κρίνει
//    *«ποιο κλειδί ζήτησε η οθόνη»* — ό,τι επιβιώνει κάθε αλλαγής διατύπωσης και
//    κοκκινίζει σε κάθε αλλαγή **συμπεριφοράς**. Ίδιο ιδίωμα με το `catalog-cause-claims`.
// ⚠️ **Το `isNamespaceReady` μένει στο mock αν και η οθόνη ΔΕΝ το ρωτά πια** *(το
//    per-route slice το κατέστησε περιττό, 2026-09-06)*: το mock αντικαθιστά ΟΛΟΚΛΗΡΟ
//    το `useTranslation`, και ένα πεδίο παραπάνω είναι φθηνότερο από μια σιωπηλή
//    `undefined` την ημέρα που κάποιο άλλο συστατικό της οθόνης το ξαναζητήσει.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}));

const fetchMandateDetail = jest.fn<Promise<DetailLoad>, [string]>();
jest.mock('@/services/mandate/mandate-catalog.client', () => ({
  fetchMandateDetail: (id: string) => fetchMandateDetail(id),
  runMandateAction: jest.fn(),
}));

jest.mock('@/services/owner-property/owner-property.service', () => ({
  setOwnerListingLifecycle: jest.fn(),
}));

// 💬 ADR-867 Β7 — το πάνελ του νήματος έχει δικές του άγκυρες· εδώ κρίνεται ΜΟΝΟ ότι η οθόνη του δίνει
//    τα id **της διαδρομής**, ως γραφείο (Ο7). Στέλεχος που καταγράφει τα props.
const threadPanelProps = jest.fn();
jest.mock('@/components/network-messaging/NetworkThreadPanel', () => ({
  NetworkThreadPanel: (props: Record<string, unknown>) => {
    threadPanelProps(props);
    return null;
  },
}));

/** Τα id νήματος/ομάδας όπως τα στέλνει η διαδρομή της εντολής (ADR-867 Β7 · §8 #8). */
const NETWORK = { threadId: 'nthr_route-thread', teamId: 'nteam_route-team' } as const;

/**
 * 🔴 **Η ΑΚΡΙΒΗΣ ΓΡΑΜΜΗ ΠΟΥ ΕΠΕΣΤΡΕΨΕ Ο ΖΩΝΤΑΝΟΣ ΔΙΑΚΟΜΙΣΤΗΣ** (2026-09-05, `curl` στο
 * `/api/owner-properties/brokered/ownp_cef8a729-…`) — **αντιγραμμένη από τη μέτρηση**,
 * όχι επινοημένη.
 *
 * 🔑 Και είναι **ακριβώς** η εντολή που ανακοίνωσε η ειδοποίηση της Α18.11
 * *(`confirmation: 'confirmed'`, `decidedAt: 2026-09-05T10:31:22.321Z`)* — δηλαδή το
 * ερώτημα #2 του προτύπου δεν είναι υποθετικό.
 *
 * ⚠️ **`standing: 'live'` και `group: 'settled'`** — η **δέκατη και τελευταία** από τις
 * δέκα καταστάσεις. Είναι ο μετρημένος λόγος που ο κατάλογος **δεν** ήταν ο
 * προορισμός: εκεί αυτή η γραμμή κάθεται στο **κάτω μέρος** της οθόνης τριάζ.
 */
const ANNOUNCED: MandateCatalogRow = {
  ownerPropertyId: 'ownp_cef8a729-95ea-4665-9d0a-e68dc5489d8d',
  listingTitle: 'TEST-3 ADR-834 sygkatathesi',
  clientName: CLIENT_NAME_IS_UNNAMED,
  clientContactId: 'cont_da84f8c4-2344-4f0f-b161-d1f795d25d2f',
  standing: LIVE,
  group: 'settled',
  daysLeft: 238,
  expiresAt: '2027-04-30T23:59:59.999Z',
  notifiedAt: '2026-08-31T09:00:34.826Z',
  notifyOutcome: null,
  viewedAt: '2026-08-31T09:01:17.724Z',
  decidedAt: '2026-09-05T10:31:22.321Z',
  proofVia: 'owner-consent',
  onTheMarket: true,
};

beforeEach(() => {
  fetchMandateDetail.mockReset();
  threadPanelProps.mockReset();
});

describe('ADR-841 §7 Α18.12 — η οθόνη της μίας εντολής', () => {
  // ===========================================================================
  // Ο1 — ΔΕΙΧΝΕΙ ΤΟ ΠΡΑΓΜΑ, ΚΑΙ ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΑΝΑΚΟΙΝΩΘΗΚΕ
  // ===========================================================================

  it('Ο1 🔴 — δείχνει ΤΗΝ ΕΝΤΟΛΗ ΠΟΥ ΑΝΑΚΟΙΝΩΣΕ Η ΕΙΔΟΠΟΙΗΣΗ, με την κατάστασή της', async () => {
    fetchMandateDetail.mockResolvedValue({ kind: MANDATE_FOUND, row: ANNOUNCED, network: NETWORK });

    render(<MandateDetailContent ownerPropertyId={ANNOUNCED.ownerPropertyId} />);

    // Ερώτηση 1 — **δείχνει το πράγμα;**
    const article = await screen.findByRole('article');

    // Ερώτηση 2 — **δείχνει ΑΥΤΟ που ανακοινώθηκε;** Ο τίτλος της αγγελίας είναι
    // ταυτόχρονα η **ταυτότητα της σελίδας** (`titleAs="h1"`).
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ANNOUNCED.listingTitle,
    );

    // …και η **κατάσταση** — αυτό ακριβώς που το `/offers/<id>` δεν έδειχνε ποτέ.
    expect(article).toHaveTextContent(STANDING_LABEL_KEYS[LIVE]);

    // ΠΑΡΟΝΟΜΑΣΤΗΣ: η οθόνη ζήτησε **αυτό** το έγγραφο, μία φορά.
    expect(fetchMandateDetail).toHaveBeenCalledTimes(1);
    expect(fetchMandateDetail).toHaveBeenCalledWith(ANNOUNCED.ownerPropertyId);
  });

  // ===========================================================================
  // Ο2 — ΚΑΙ ΠΡΟΣΦΕΡΕΙ ΤΙΣ ΠΡΑΞΕΙΣ ΤΗΣ (ΕΚΕΙ ΞΕΠΕΡΝΑΜΕ ΤΟ DOCUSIGN)
  // ===========================================================================

  /**
   * 🏆 Το «Envelope Details» του DocuSign είναι **αρχείο κατάστασης**· οι ενέργειες
   * ζουν στη λίστα «Manage». Εδώ ο άνθρωπος **πράττει επιτόπου** — και ο κριτής των
   * κουμπιών είναι ο **ίδιος** (`allowedActionsFor`) με τον κατάλογο, όχι δεύτερος.
   */
  it('Ο2 🏆 — η κάρτα κουβαλά ΚΑΙ τις πράξεις, όχι μόνο την κατάσταση', async () => {
    fetchMandateDetail.mockResolvedValue({ kind: MANDATE_FOUND, row: ANNOUNCED, network: NETWORK });

    render(<MandateDetailContent ownerPropertyId={ANNOUNCED.ownerPropertyId} />);
    const article = await screen.findByRole('article');

    // 🔴 **`getAllByRole`, ΟΧΙ `querySelectorAll('button')`** — ο ρόλος διαβάζεται από το
    //    δέντρο προσβασιμότητας, δηλαδή ρωτά *«υπάρχει **πράξη**;»* και όχι *«υπάρχει
    //    **ετικέτα**;»*.
    //
    // ⚠️ **ΚΑΙ ΜΕΤΡΗΘΗΚΕ ΟΤΙ ΔΕΝ ΑΡΚΕΙ — ΕΥΡΗΜΑ ΓΙΑ ΟΛΟ ΤΟ ΔΕΝΤΡΟ** (2026-09-05):
    //    μετάλλαξη που πρόσθεσε `hidden` στο κουμπί **επέζησε και στις δύο γραφές**. Το
    //    `Button` **όντως** προωθεί το χαρακτηριστικό (`{...props}`, `button.tsx:77`) —
    //    το κενό είναι στο **περιβάλλον**: το jsdom δεν εφαρμόζει τον κανόνα του
    //    φυλλομετρητή `[hidden] { display: none }`, οπότε το `byRole` **δεν** θεωρεί το
    //    στοιχείο απρόσιτο.
    //
    // ⇒ **ΜΗΝ στηριχθείς σε άγκυρα που υποθέτει ότι το `byRole` κρύβει το `hidden`.** Ο
    //    θανατηφόρος έλεγχος εδώ είναι η **αφαίρεση** της πράξης, που εκτελέστηκε και
    //    **κοκκίνισε**. Η ορατότητα ανήκει σε πύλη οθόνης, όχι σε jsdom.
    const buttons = within(article).getAllByRole('button');
    // ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχει **τουλάχιστον** η πράξη παρουσίας (ADR-777 §8.39), που
    // είναι **πάντα** ορατή — «μια πύλη που εμποδίζει τον άνθρωπο να αποσύρει το
    // ακίνητό του τον κλειδώνει έξω από την έξοδο».
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================
  // Ο3 — Ο ΔΡΟΜΟΣ ΠΙΣΩ ΥΠΑΡΧΕΙ, ΚΑΙ ΟΔΗΓΕΙ ΚΑΠΟΥ
  // ===========================================================================

  /**
   * 🔴 Ο άνθρωπος φτάνει εδώ από **ειδοποίηση**, συχνά σε καρτέλα **χωρίς ιστορικό**.
   * Χωρίς αυτόν τον σύνδεσμο η οθόνη είναι **αδιέξοδο** — το μάθημα *«πόρτα χωρίς
   * διάδρομο»* του §8.33, που το δέντρο πλήρωσε ήδη **δύο φορές**.
   */
  it('Ο3 🔴 — υπάρχει δρόμος πίσω στον κατάλογο', async () => {
    fetchMandateDetail.mockResolvedValue({ kind: MANDATE_FOUND, row: ANNOUNCED, network: NETWORK });

    render(<MandateDetailContent ownerPropertyId={ANNOUNCED.ownerPropertyId} />);
    await screen.findByRole('article');

    const back = screen.getByText(DETAIL_KEYS.back);
    expect(back).toHaveAttribute('href', MANDATE_CATALOG_ROUTE);
  });

  // ===========================================================================
  // Ο4 — Η ΑΠΟΥΣΙΑ ΟΝΟΜΑΖΕΤΑΙ, ΚΑΙ ΚΑΘΕ ΜΙΑ ΜΕ ΤΟ ΔΙΚΟ ΤΗΣ ΚΕΙΜΕΝΟ
  // ===========================================================================

  /**
   * 🔴 Το DocuSign έχει **δημόσια καταγεγραμμένο** νήμα κοινότητας *(«Envelopes not
   * showing in Inbox or Action Required»)* ακριβώς επειδή εκεί η απουσία είναι **μία
   * και σιωπηλή**. Εδώ είναι **τρεις**, καθεμιά με **διαφορετική δουλειά** για τον
   * άνθρωπο.
   */
  it.each([
    [MANDATE_MISSING, { kind: MANDATE_MISSING } as DetailLoad],
    [MANDATE_NOT_A_MANDATE, { kind: MANDATE_NOT_A_MANDATE } as DetailLoad],
    ['failed', { kind: 'failed', message: 'boom' } as DetailLoad],
  ] as const)('Ο4 🔴 — «%s»: λέει ΤΙ έγινε ΚΑΙ τι να κάνει', async (kind, load) => {
    fetchMandateDetail.mockResolvedValue(load);

    const { container } = render(
      <MandateDetailContent ownerPropertyId="ownp_x" />,
    );

    const keys = DETAIL_ABSENCE_KEYS[kind as keyof typeof DETAIL_ABSENCE_KEYS];
    await waitFor(() => expect(container).toHaveTextContent(keys.title));

    // **Δύο** προτάσεις: τι συνέβη **και** τι να κάνει. Ένα σκέτο «δεν βρέθηκε» αφήνει
    // τον μεσίτη να μαντέψει αν φταίει ο σύνδεσμος, η εντολή, ή το δίκτυο.
    expect(container).toHaveTextContent(keys.hint);
    expect(keys.title).not.toBe(keys.hint); // ΠΑΡΟΝΟΜΑΣΤΗΣ: δύο ΔΙΑΦΟΡΕΤΙΚΑ κλειδιά

    // ⚠️ **Καμία κάρτα**: μια απουσία δεν επιτρέπεται να ζωγραφίσει άδεια εντολή.
    expect(screen.queryByRole('article')).toBeNull();
  });

  /**
   * ⚠️ **ΤΟ «ΔΟΚΙΜΑΣΤΕ ΞΑΝΑ» ΜΟΝΟ ΟΠΟΥ ΥΠΑΡΧΕΙ ΔΙΕΞΟΔΟΣ.** Μια εντολή που **δεν
   * υπάρχει** δεν θα εμφανιστεί επειδή ξαναρώτησες· ένα καθολικό κουμπί θα υποσχόταν
   * διέξοδο που δεν υπάρχει.
   */
  it('Ο5 🔴 — το «δοκιμάστε ξανά» δίνεται ΜΟΝΟ στην αποτυχία δικτύου', async () => {
    fetchMandateDetail.mockResolvedValue({ kind: 'failed', message: 'boom' });
    const failed = render(<MandateDetailContent ownerPropertyId="ownp_x" />);
    await waitFor(() =>
      expect(failed.container).toHaveTextContent(DETAIL_ABSENCE_KEYS.failed.title),
    );
    expect(failed.container).toHaveTextContent(CATALOG_KEYS.retry); // ΠΑΡΟΝΟΜΑΣΤΗΣ
    failed.unmount();

    fetchMandateDetail.mockResolvedValue({ kind: MANDATE_MISSING });
    const missing = render(<MandateDetailContent ownerPropertyId="ownp_y" />);
    await waitFor(() =>
      expect(missing.container).toHaveTextContent(DETAIL_ABSENCE_KEYS.missing.title),
    );
    expect(missing.container).not.toHaveTextContent(CATALOG_KEYS.retry);
  });

  // ===========================================================================
  // Ο6 — Η ΔΙΕΥΘΥΝΣΗ ΤΗΣ ΕΙΔΟΠΟΙΗΣΗΣ ΚΑΙ Η ΟΘΟΝΗ ΜΙΛΟΥΝ ΓΙΑ ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ
  // ===========================================================================

  /**
   * 🔑 Το κύκλωμα κλείνει **εκτελεσμένο**: ό,τι βάζει ο ειδοποιητής στο `actions[0].url`
   * είναι ό,τι ζητά αυτή η οθόνη από τον διακομιστή. Χωρίς αυτό, τα δύο μισά θα
   * μπορούσαν να αποκλίνουν και **και τα δύο** να είναι πράσινα.
   */
  it('Ο6 — ό,τι ζητά η οθόνη είναι ό,τι έβαλε η ειδοποίηση στη διεύθυνση', async () => {
    fetchMandateDetail.mockResolvedValue({ kind: MANDATE_FOUND, row: ANNOUNCED, network: NETWORK });

    render(<MandateDetailContent ownerPropertyId={ANNOUNCED.ownerPropertyId} />);
    await screen.findByRole('article');

    const asked = fetchMandateDetail.mock.calls[0]?.[0] ?? '';
    expect(asked).not.toBe(''); // ΠΑΡΟΝΟΜΑΣΤΗΣ
    expect(mandateDetailHref(asked)).toBe(
      `${MANDATE_CATALOG_ROUTE}/${ANNOUNCED.ownerPropertyId}`,
    );
  });

  // ===========================================================================
  // Ο7 — ADR-867 Β7: Η ΣΥΝΟΜΙΛΙΑ ΚΑΤΩ ΑΠΟ ΤΗΝ ΕΝΤΟΛΗ, ΜΕ ΤΑ ID ΤΗΣ ΔΙΑΔΡΟΜΗΣ
  // ===========================================================================
  it('Ο7 — το νήμα παίρνει τα id της ΔΙΑΔΡΟΜΗΣ, ως γραφείο (μετάλλαξη: id υπολογισμένα στον πελάτη / variant owner)', async () => {
    fetchMandateDetail.mockResolvedValue({ kind: MANDATE_FOUND, row: ANNOUNCED, network: NETWORK });

    render(<MandateDetailContent ownerPropertyId={ANNOUNCED.ownerPropertyId} />);
    await screen.findByRole('article');

    await waitFor(() => expect(threadPanelProps).toHaveBeenCalled());
    expect(threadPanelProps).toHaveBeenLastCalledWith({ threadId: NETWORK.threadId, teamId: NETWORK.teamId, variant: 'office' });
  });
});
