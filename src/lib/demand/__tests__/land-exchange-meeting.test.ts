/**
 * Άγκυρες — **Η ΣΥΝΑΝΤΗΣΗ ΤΗΣ ΓΗΣ** (ADR-777 §8.32).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΤΟ ΑΠΟΔΕΙΚΝΥΕΙ ΚΑΝΕΝΑ ΑΛΛΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κανόνας του τομέα έχει **δύο** πλευρές, και μέχρι τις 2026-08-20 **καμία** δεν
 * μπορούσε να εκφραστεί: *ο ιδιοκτήτης **δίνει** οικόπεδο με αντιπαροχή· ο
 * εργολάβος το **ψάχνει**.* Η λίστα των ειδών ακινήτου δεν είχε γη — δώδεκα
 * χτισμένες μονάδες — ενώ η αντιπαροχή προσφερόταν ως είδος διάθεσης **και στις
 * δύο** οθόνες.
 *
 * Οι άγκυρες των μερών (invariants · κατηγορία · μετάφραση φόρμας) κρατούν το
 * καθένα χωριστά. **Καμία δεν ρωτά αν τα δύο άκρα συναντιούνται** — και αυτό είναι
 * η μόνη ερώτηση που έχει σημασία για τον άνθρωπο: *«έβαλα το οικόπεδό μου· θα το
 * βρει ο εργολάβος;»*. Ένα σπασμένο κρίκο στη μέση (φίλτρα · σειριοποίηση ·
 * ταίριασμα) θα άφηνε **και τις δώδεκα** άλλες άγκυρες πράσινες.
 *
 * ⚠️ **Καμία νέα μηχανή δεν δοκιμάζεται εδώ.** Και οι τρεις κρίκοι υπήρχαν
 * (`listingFiltersFromDemand` → `serializeListingFilters` → `matchesListingFilters`)·
 * αυτό που άλλαξε είναι ότι το λεξιλόγιο που τους τροφοδοτεί **απέκτησε γη**.
 */

import { listingFiltersFromDemand } from '../demand-listing-filters';
import {
  EMPTY_LISTING_FILTERS,
  matchesListingFilters,
  parseListingFilters,
  serializeListingFilters,
} from '@/lib/listings/listing-filters';
import { NO_DEMAND_FEATURES } from '@/types/property-demand';
import { demand, listing } from './demand-fixtures';
import { isLandPropertyType, LAND_PROPERTY_TYPES } from '@/constants/property-types';

/** Ο εργολάβος: «ζητώ **οικόπεδο** με **αντιπαροχή**». */
const CONTRACTOR = demand({
  seeks: ['exchange'],
  features: { ...NO_DEMAND_FEATURES, types: ['plot'] },
});

/** Ο ιδιοκτήτης: «**δίνω** αυτό το οικόπεδο με αντιπαροχή». */
const OWNER_PLOT = listing({
  type: 'plot',
  offerKinds: ['exchange'],
  commercialStatus: 'unavailable',
  commercial: { askingPrice: null, finalPrice: null, rentPrice: null },
  areaSqm: 480,
  floor: null,
  bedrooms: null,
});

describe('ADR-777 §8.32 — ο εργολάβος ψάχνει, ο ιδιοκτήτης δίνει, τα δύο συναντιούνται', () => {
  it('🔴 Κ1 — ζήτηση «οικόπεδο + αντιπαροχή» ΒΡΙΣΚΕΙ την προσφορά οικοπέδου', () => {
    const filters = listingFiltersFromDemand(CONTRACTOR);
    expect(matchesListingFilters(OWNER_PLOT, filters)).toBe(true);
  });

  it('Κ2 — ο παρονομαστής: το ΙΔΙΟ φίλτρο ΔΕΝ πιάνει διαμέρισμα προς πώληση', () => {
    // Χωρίς αυτό, ένα φίλτρο που δέχεται τα πάντα θα ήταν εξίσου πράσινο στο Κ1.
    const filters = listingFiltersFromDemand(CONTRACTOR);
    expect(matchesListingFilters(listing(), filters)).toBe(false);
  });

  it('Κ3 — ούτε αγροτεμάχιο: «οικόπεδο» ΔΕΝ σημαίνει «οποιαδήποτε γη»', () => {
    // Η γη έχει **κατηγορία** κοινή και **είδη** διαφορετικά. Ένας εργολάβος που
    // ζητά δομήσιμο οικόπεδο δεν θέλει να σταλεί σε χωράφι.
    const filters = listingFiltersFromDemand(CONTRACTOR);
    const parcel = { ...OWNER_PLOT, id: 'prop_2', type: 'parcel' as const };
    expect(matchesListingFilters(parcel, filters)).toBe(false);
    // …και όμως **και τα δύο** είναι γη — ο άλλος άξονας απαντά «ναι».
    expect(isLandPropertyType(parcel.type)).toBe(true);
  });

  it('Κ4 — η γη επιβιώνει της ΔΙΕΥΘΥΝΣΗΣ (round-trip σειριοποίησης)', () => {
    // Ο σύνδεσμος «δες τι υπάρχει» είναι το πραγματικό μονοπάτι του χρήστη: αν το
    // είδος χανόταν στο URL, ο εργολάβος θα έβλεπε **όλες** τις αγγελίες και θα το
    // διάβαζε ως «δεν υπάρχουν οικόπεδα».
    const projected = listingFiltersFromDemand(CONTRACTOR);
    const roundTripped = parseListingFilters(serializeListingFilters(projected));
    expect(roundTripped.types).toEqual(['plot']);
    expect(roundTripped.offerKinds).toEqual(['exchange']);
    expect(matchesListingFilters(OWNER_PLOT, roundTripped)).toBe(true);
  });

  it('🔴 Κ4β — «ΥΠΝΟΔΩΜΑΤΙΑ ΤΟΥΛΑΧΙΣΤΟΝ 0» ΔΕΝ εξαφανίζει τα οικόπεδα', () => {
    // 🔴 **Το βρήκε ΣΤΙΓΜΙΟΤΥΠΟ, όχι πύλη** (2026-08-20): στη φόρμα ζήτησης το πεδίο
    // «Υπνοδωμάτια, τουλάχιστον» κάθεται **δίπλα** στο «Οικόπεδο», και το βοηθητικό
    // του κείμενο λέει *«το 0 σημαίνει “δέξου και γκαρσονιέρα”»* — δηλαδή ο άνθρωπος
    // που γράφει 0 νομίζει ότι **χαλαρώνει**. Ένα οικόπεδο όμως έχει `bedrooms: null`
    // εκ κατασκευής, και ο έλεγχος «null ⇒ έξω» έδινε **μηδέν αποτελέσματα**
    // (μετρημένο `false` πριν τη διόρθωση).
    const filters = { ...listingFiltersFromDemand(CONTRACTOR), bedroomsMin: 0 };
    expect(matchesListingFilters(OWNER_PLOT, filters)).toBe(true);
    // …ούτε με ρητή απαίτηση: η ερώτηση **δεν ισχύει** για γη, δεν «αποτυγχάνει».
    expect(matchesListingFilters(OWNER_PLOT, { ...filters, bedroomsMin: 2 })).toBe(true);
  });

  it('Κ4γ — ο παρονομαστής: σε ΔΙΑΜΕΡΙΣΜΑ το ίδιο φίλτρο εξακολουθεί να κρίνει', () => {
    // Χωρίς αυτό, μια «διόρθωση» που απλώς σβήνει τον έλεγχο του `null` θα ήταν
    // εξίσου πράσινη στο Κ4β — και θα είχε χαλαρώσει το φίλτρο για **όλα** τα
    // ακίνητα, δηλαδή θα έστελνε γκαρσονιέρες σε όποιον ζητά τρία υπνοδωμάτια.
    const flat = listing({ bedrooms: null });
    const wantsTwo = { ...EMPTY_LISTING_FILTERS, bedroomsMin: 2 };
    expect(matchesListingFilters(flat, wantsTwo)).toBe(false);
    expect(matchesListingFilters(listing({ bedrooms: 3 }), wantsTwo)).toBe(true);
    expect(matchesListingFilters(listing({ bedrooms: 1 }), wantsTwo)).toBe(false);
  });

  it('Κ5 — ΚΑΘΕ είδος γης μπορεί να ζητηθεί και να βρεθεί (κανένα ξεχασμένο)', () => {
    // Παράγεται από το SSoT: μια τρίτη τιμή γης αύριο μπαίνει **αυτόματα** στον
    // έλεγχο, αντί να προστεθεί σε χειρόγραφη λίστα που κανείς δεν θυμάται.
    for (const land of LAND_PROPERTY_TYPES) {
      const seeker = demand({
        seeks: ['exchange'],
        features: { ...NO_DEMAND_FEATURES, types: [land] },
      });
      const offered = { ...OWNER_PLOT, type: land };
      expect(matchesListingFilters(offered, listingFiltersFromDemand(seeker))).toBe(true);
    }
  });
});
