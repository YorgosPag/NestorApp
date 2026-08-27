/**
 * @fileoverview **Κ6 — Η ΑΝΑΚΛΗΣΗ ΑΔΕΙΑΣ ΑΠΟΣΥΡΕΙ ΚΑΙ ΤΙΣ ΗΔΗ ΔΗΜΟΣΙΕΥΜΕΝΕΣ.**
 * @related ADR-824 §8 Κ6 · types/owner-property-mandate.ts
 *
 * 🔴 **Ο φρουρός τύπου φυλάει ΜΟΝΟ ΤΟ ΜΕΛΛΟΝ.** Ο {@link BrokerageAuthority} κάνει
 * αδύνατη τη γέννηση **νέας** brokered αγγελίας χωρίς άδεια — και από μόνος του θα
 * άφηνε ένα γραφείο που έχασε την άδειά του να κρατά στον δημόσιο χάρτη **όσες
 * πρόλαβε**.
 *
 * 🔑 **Δοκιμάζεται στον ΕΝΑ κριτή, όχι στη σάρωση.** Η σάρωση απλώς **γράφει το
 * γεγονός**· το *«φαίνεται;»* το απαντά η καθαρή διαδρομή
 * `projectableFromOwnerProperty → isPubliclyListed`, η **ίδια** που τρέχει ο
 * διακομιστής **και** η κάρτα του κατόχου. Μια δοκιμή στη σάρωση θα επιβεβαίωνε ότι
 * γράφτηκε ένα πεδίο — όχι ότι **έφυγε από τον χάρτη**.
 */

import { projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import {
  brokeredOwnerProperty,
  validOwnerProperty,
} from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { isPubliclyListed } from '@/services/listings/public-listing-projection';
import {
  isAgencyRevoked,
  mandateAllowsPublication,
} from '@/types/owner-property-mandate';
import type { OwnerProperty } from '@/types/owner-property';

const AT = '2026-08-27T12:00:00.000Z';
const REVOKED_AT = '2026-08-27T18:00:00.000Z';

/** Η **ίδια** διαδρομή που εκτελεί ο γραφέας — και η κάρτα. */
function onPublicMap(property: OwnerProperty): boolean {
  return isPubliclyListed(projectableFromOwnerProperty(property, AT));
}

/** Εγκεκριμένη εντολή — **δημοσιεύσιμη**, ώστε να υπάρχει τι να αποσυρθεί. */
function live(agencyRevokedAt: string | null) {
  return brokeredOwnerProperty({ confirmation: 'confirmed', decidedAt: AT, agencyRevokedAt });
}

/**
 * Ένα **μπαγιάτικο** έγγραφο: η εντολή **δεν έχει καν το κλειδί**.
 *
 * ⚠️ Το στιγμιότυπο κατασκευάζεται με **αφαίρεση**, όχι με `undefined`: το ερώτημα
 * είναι *«τι κάνει ο κριτής όταν το πεδίο **ΛΕΙΠΕΙ** από το JSON του Firestore;»*, και
 * ένα `undefined` γραμμένο ρητά είναι **άλλο** πράγμα από πεδίο που δεν γράφτηκε ποτέ.
 */
function legacyMandate(): OwnerProperty {
  const property = live(null);
  const { agencyRevokedAt: _absent, ...mandate } = property.mandate as Record<string, unknown>;
  return { ...property, mandate } as OwnerProperty;
}

describe('Κ6 — η ανάκληση της άδειας αποσύρει τις υπάρχουσες αγγελίες', () => {
  /**
   * ✅ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ, ΠΡΩΤΟΣ.** Χωρίς αυτόν, το «αποσύρεται» θα ήταν πράσινο και
   * αν η αγγελία **δεν έφτανε ποτέ** στον χάρτη για άλλον λόγο.
   */
  it('εγκεκριμένη εντολή ΧΩΡΙΣ ανάκληση ΕΙΝΑΙ στον χάρτη', () => {
    expect(onPublicMap(live(null))).toBe(true);
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ.**
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε το `!isAgencyRevoked(mandate)` από την
   * {@link mandateAllowsPublication} ⇒ **κόκκινο**: η ανάκληση αφήνει την προβολή
   * ζωντανή — ακριβώς η μετάλλαξη που ονομάζει το ADR-824 §8 Κ6.
   */
  it('με ανακληθείσα άδεια ΦΕΥΓΕΙ από τον χάρτη', () => {
    expect(onPublicMap(live(REVOKED_AT))).toBe(false);
    expect(mandateAllowsPublication(live(REVOKED_AT).mandate, AT)).toBe(false);
  });

  /**
   * 🔴 **ΤΟ ΠΕΔΙΟ ΠΟΥ ΛΕΙΠΕΙ ΔΕΝ ΕΙΝΑΙ ΑΝΑΚΛΗΣΗ** — και είναι η επικίνδυνη κατεύθυνση.
   *
   * **Καμία** εντολή που υπάρχει σήμερα στη βάση δεν έχει το πεδίο. Με σκέτο
   * `!== null`, το `undefined` θα διαβαζόταν ως ανάκληση και **όλες** οι brokered
   * αγγελίες θα εξαφανίζονταν σιωπηλά.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `(agencyRevokedAt ?? null) !== null` σε `!== null` ⇒
   * **κόκκινο**.
   */
  it('εντολή ΧΩΡΙΣ το πεδίο (μπαγιάτικο έγγραφο) μένει στον χάρτη', () => {
    const legacy = legacyMandate();

    expect('agencyRevokedAt' in legacy.mandate).toBe(false);
    expect(isAgencyRevoked(legacy.mandate)).toBe(false);
    expect(onPublicMap(legacy)).toBe(true);
  });

  /**
   * ⚠️ **Η ΑΝΑΚΛΗΣΗ ΕΙΝΑΙ ΑΝΤΙΣΤΡΕΨΙΜΗ**, γι' αυτό είναι **στιγμή** και όχι σβήσιμο:
   * η επανέγκριση περνά `null` και η αγγελία επανέρχεται **χωρίς** ο ιδιοκτήτης να
   * κάνει τίποτα.
   */
  it('η επανέγκριση την επαναφέρει', () => {
    expect(onPublicMap(live(REVOKED_AT))).toBe(false);
    expect(onPublicMap(live(null))).toBe(true);
  });

  /**
   * ⛔ **Ο ΙΔΙΩΤΗΣ ΔΕΝ ΑΓΓΙΖΕΤΑΙ — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ Κ4** (ADR-824 §7).
   *
   * Η ρυθμιζόμενη πράξη είναι **αποκλειστικά** το `brokered` σκέλος. Ο τύπος το κάνει
   * ήδη αδύνατο (`self` δεν έχει το πεδίο)· η δοκιμή το κάνει **παρατηρήσιμο**.
   */
  it('η αγγελία του ιδιώτη μένει ανέπαφη', () => {
    const owner = validOwnerProperty();

    expect(owner.mandate.kind).toBe('self');
    expect(isAgencyRevoked(owner.mandate)).toBe(false);
    expect(onPublicMap(owner)).toBe(true);
  });
});
