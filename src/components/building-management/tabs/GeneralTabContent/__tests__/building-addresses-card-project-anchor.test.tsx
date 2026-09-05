/**
 * @fileoverview 🔴 **ΦΤΑΝΕΙ Η ΑΦΕΤΗΡΙΑ ΕΓΓΥΤΗΤΑΣ ΑΠΟ ΤΟ ΕΡΓΟ ΩΣ ΤΟΝ ΣΥΝΤΑΚΤΗ;**
 * @related ADR-332 **D23** *(η αφετηρία)* · **D24** *(αυτή η άγκυρα)*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — Η ΕΓΓΥΤΗΤΑ ΕΙΧΕ ΗΔΗ ΠΕΘΑΝΕΙ ΜΙΑ ΦΟΡΑ, ΣΙΩΠΗΛΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το **D23** διόρθωσε ότι *«η εγγύτητα των προτάσεων διεύθυνσης τρεφόταν από το
 * τίποτα»*: ο συντάκτης δεν ήξερε πού είναι το έργο, οπότε οι προτάσεις ταξινομούνταν
 * χωρίς αφετηρία. Η θεραπεία ήταν **μία prop** — `projectAddresses` — που ταξιδεύει
 * `useBuildingAddressesCardState` → `BuildingAddressesCard` → `BuildingAddressesEditor`.
 *
 * 🔴 **Και το ταξίδι έμεινε ΑΦΥΛΑΚΤΟ**: καμία σουίτα δεν ζωγράφιζε αυτά τα δύο μαζί.
 * Αν κάποιος σβήσει τη γραμμή `projectAddresses={projectAddresses}`, **όλα τα άλλα
 * tests μένουν πράσινα** και η εγγύτητα ξαναπεθαίνει — **ακριβώς** με τον τρόπο που
 * πέθανε την πρώτη φορά: όχι με σφάλμα, αλλά με μια σιωπηλή `undefined`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΕΙΝΑΙ ΑΛΗΘΙΝΟ ΕΔΩ ΚΑΙ ΤΙ ΟΧΙ — ΔΙΑΒΑΣΕ ΠΡΙΝ ΕΜΠΙΣΤΕΥΤΕΙΣ ΤΟ ΠΡΑΣΙΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Αληθινά** *(εκτελούνται)*: ο `BuildingAddressesCard`, ο **πραγματικός**
 * `useBuildingAddressesCardState` με τον `useEffect` που φορτώνει το έργο, και η
 * γραμμή που περνά την prop. Δηλαδή η **ολόκληρη αλυσίδα** από την πηγή ως τον
 * παραλήπτη.
 *
 * **Ψεύτικα** *(αντικαθίστανται)*: ο `BuildingAddressesEditor` — γίνεται **κατάσκοπος**
 * που καταγράφει τι έλαβε, γιατί ο αληθινός σέρνει `AddressFormSection` + ιεραρχία +
 * χάρτη, δηλαδή δουλειά με δικό της εύρος· και τα περιβάλλοντα UI *(i18n, θέμα,
 * ειδοποιήσεις, πλοήγηση)*, που **δεν έχουν γνώμη** για την ερώτηση.
 *
 * ⚠️ **Η πηγή `getProjectAddresses` είναι mock ΕΠΙΤΗΔΕΣ**: το ζητούμενο δεν είναι *«ο
 * διακομιστής απαντά;»* αλλά *«ό,τι απάντησε, φτάνει;»*. Ένα test που ρωτούσε και τα
 * δύο θα κοκκίνιζε για λάθος λόγο.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import type { ProjectAddress } from '@/types/project/addresses';

import { BuildingAddressesCard } from '../BuildingAddressesCard';

// ── Ο ΚΑΤΑΣΚΟΠΟΣ: ο συντάκτης καταγράφει ΤΙ ΕΛΑΒΕ ────────────────────────────
const editorProps: { current: Record<string, unknown> | null } = { current: null };

jest.mock('../building-addresses-card/BuildingAddressesEditor', () => ({
  BuildingAddressesEditor: (props: Record<string, unknown>) => {
    editorProps.current = props;
    return React.createElement('div', { 'data-testid': 'editor-spy' });
  },
}));

// ── Η ΠΗΓΗ: το έργο, με διεύθυνση ΠΟΥ ΕΧΕΙ ΣΥΝΤΕΤΑΓΜΕΝΕΣ ─────────────────────
const PROJECT_ADDRESS: ProjectAddress = {
  id: 'addr_ergou',
  street: 'Πανεπιστημίου',
  number: '10',
  city: 'Αθήνα',
  postalCode: '10671',
  coordinates: { lat: 37.9808, lng: 23.7333 },
} as unknown as ProjectAddress;

const getProjectAddresses = jest.fn();

jest.mock('../../../building-services', () => ({
  getProjectAddresses: (...args: unknown[]) => getProjectAddresses(...args),
}));

jest.mock('@/services/building/building-mutation-gateway', () => ({
  updateBuildingWithPolicy: jest.fn(),
}));

/**
 * ⚠️ **Ο χάρτης αντικαθίσταται γιατί ΔΕΝ ΤΡΕΧΕΙ, όχι για ταχύτητα**: το `maplibre-gl`
 * ζητά `URL.createObjectURL` στο **module scope** του, που το jsdom δεν έχει — δηλαδή
 * σκάει πριν καν αποδοθεί κάτι. Δεν έχει γνώμη για την ερώτηση αυτού του αρχείου.
 */
jest.mock('../building-addresses-card/BuildingAddressesMapPane', () => ({
  BuildingAddressesMapPane: () => React.createElement('div', { 'data-testid': 'map-pane' }),
}));

// ── ΤΑ ΠΕΡΙΒΑΛΛΟΝΤΑ: καμία γνώμη για την ερώτηση ─────────────────────────────
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ sm: '', md: '', lg: '' }),
}));
jest.mock('@/hooks/useTypography', () => ({
  useTypography: () => ({ heading: { lg: '' }, body: { sm: '' } }),
}));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: '' }, bg: {}, border: {} }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ showSuccess: jest.fn(), showError: jest.fn() }),
}));
jest.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: jest.fn(), dialogProps: { open: false } }),
}));

describe('ADR-332 D24 — η αφετηρία εγγύτητας από την κάρτα στον συντάκτη', () => {
  beforeEach(() => {
    editorProps.current = null;
    getProjectAddresses.mockReset();
    getProjectAddresses.mockResolvedValue({ addresses: [PROJECT_ADDRESS] });
  });

  /**
   * Ανοίγει τον συντάκτη με τον **μόνο** τρόπο που τον ανοίγει άνθρωπος.
   *
   * ⚠️ **`findAll`, όχι `find`**: χωρίς έργο η κάρτα δείχνει **δύο** κουμπιά προσθήκης
   * ταυτόχρονα *(αυτό της κεφαλίδας και αυτό της κενής κατάστασης)*. Και τα δύο καλούν
   * `openCreateEditor` — το πρώτο αρκεί.
   */
  async function openEditor(): Promise<void> {
    const [button] = await screen.findAllByRole('button', { name: /addAddress/i });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByTestId('editor-spy')).toBeInTheDocument());
  }

  // ===========================================================================
  describe('ΜΕΡΟΣ Α — ΤΟ ΠΕΡΑΣΜΑ: η prop υπάρχει και δεν είναι φάντασμα', () => {
    /**
     * 🔴 **Η ΚΕΝΤΡΙΚΗ ΑΓΚΥΡΑ ΤΟΥ RATCHET.** Σβήσε τη γραμμή
     * `projectAddresses={projectAddresses}` στην κάρτα και **αυτό** κοκκινίζει: ο
     * κατάσκοπος παίρνει `undefined` αντί για πίνακα.
     *
     * ⚠️ **`[]` ΚΑΙ `undefined` ΔΕΝ ΕΙΝΑΙ ΤΟ ΙΔΙΟ** — και εδώ είναι όλη η αξία του
     * ελέγχου: ο συντάκτης γράφει `addressListCenter(projectAddresses)`, που **δέχεται
     * και τα δύο** χωρίς να πει τίποτα. Δηλαδή η διαγραφή της prop θα ήταν αόρατη σε
     * κάθε άλλο test — ακριβώς ο τρόπος με τον οποίο η εγγύτητα πέθανε την πρώτη φορά.
     */
    it('🔴 ο συντάκτης λαμβάνει ΠΙΝΑΚΑ `projectAddresses`, ΠΟΤΕ `undefined`', async () => {
      render(<BuildingAddressesCard buildingId="bld_dokimi" addresses={[]} />);
      await openEditor();

      expect(editorProps.current).not.toBeNull();
      expect(Array.isArray(editorProps.current?.projectAddresses)).toBe(true);
    });
  });

  // ===========================================================================
  describe('ΜΕΡΟΣ Β — 🔴 ΤΟ ΔΗΛΩΜΕΝΟ ΚΕΝΟ: η αφετηρία είναι ΠΑΝΤΑ ΚΕΝΗ, δομικά', () => {
    /**
     * 🔴🔴 **ΜΕΤΡΗΜΕΝΟ 2026-09-05 — ΤΟ D23 ΔΕΝ ΕΦΤΑΣΕ ΠΟΤΕ ΣΤΗΝ ΟΘΟΝΗ.**
     *
     * Και τα **τρία** χειριστήρια που ανοίγουν τον συντάκτη ζουν πίσω από
     * **`!hasProject`** *(δύο κουμπιά «προσθήκη» + το `onEdit` της χειροκίνητης
     * λίστας)*, ενώ ο hook κάνει `if (!projectId) setProjectAddresses([])`. Οι δύο
     * συνθήκες είναι **αμοιβαία αποκλειόμενες**:
     *
     * | | ο συντάκτης ανοίγει; | `projectAddresses` |
     * |---|---|---|
     * | **με** έργο | ❌ **ποτέ** — κανένα χειριστήριο | γεμάτο, και **κανείς δεν το βλέπει** |
     * | **χωρίς** έργο | ✅ ναι | **πάντα `[]`** |
     *
     * ⇒ Η prop **δεν είναι απλώς αφύλακτη — είναι ΑΔΡΑΝΗΣ** (σχήμα ADR-749). Το
     * `addressListCenter(projectAddresses)` του συντάκτη επιστρέφει **πάντα** `null`
     * και πέφτει στο `initialValues`.
     *
     * ⛔ **ΔΕΝ «διορθώθηκε» εδώ, επίτηδες**: η θεραπεία είναι *«επιτρέπεται χειροκίνητη
     * διεύθυνση σε κτίριο που ανήκει σε έργο;»* — **απόφαση προϊόντος**, όχι πράκτορα.
     *
     * 🔑 **Και γι' αυτό αυτό το test είναι ΠΡΑΣΙΝΟ ΤΩΡΑ ΚΑΙ ΚΟΚΚΙΝΟ ΑΥΡΙΟ**: την ημέρα
     * που κάποιος κάνει τον συντάκτη προσβάσιμο με έργο, **σπάει** — και ζητά να
     * ξαναδιαβαστεί το D23 αντί να περάσει σιωπηλά.
     */
    it('🔴 με ΕΡΓΟ, ο συντάκτης ΔΕΝ ΑΝΟΙΓΕΙ ΠΟΤΕ — άρα η γεμάτη αφετηρία δεν φτάνει πουθενά', async () => {
      render(
        <BuildingAddressesCard buildingId="bld_dokimi" projectId="proj_dokimi" addresses={[]} />,
      );

      // Η πηγή ρωτιέται κανονικά — τα δεδομένα ΥΠΑΡΧΟΥΝ…
      await waitFor(() => expect(getProjectAddresses).toHaveBeenCalledWith('proj_dokimi'));

      // …αλλά κανένα χειριστήριο δεν ανοίγει τον συντάκτη σε αυτόν τον κλάδο.
      expect(screen.queryByRole('button', { name: /addAddress/i })).toBeNull();
      expect(screen.queryByTestId('editor-spy')).toBeNull();
    });

    it('🔴 ΧΩΡΙΣ έργο ο συντάκτης ανοίγει — αλλά η αφετηρία είναι ΚΕΝΗ, πάντα', async () => {
      render(<BuildingAddressesCard buildingId="bld_monaxiko" addresses={[]} />);
      await openEditor();

      expect(getProjectAddresses).not.toHaveBeenCalled();
      expect(editorProps.current?.projectAddresses).toEqual([]);
    });
  });
});
