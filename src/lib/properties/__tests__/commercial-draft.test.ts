/**
 * ⚓ ADR-777 §8.60.18 — το ΠΡΟΧΕΙΡΟ των εμπορικών στοιχείων (φόρμα → PATCH).
 *
 * Ένας κριτής για τρεις επεξεργαστές: η φόρμα ακινήτου, η κάρτα «Διάθεση & τιμή» των χώρων και
 * η γρήγορη επεξεργασία της καρτέλας κτιρίου. Αν αποκλίνουν, ο ίδιος άνθρωπος βλέπει άλλη
 * συμπεριφορά σε άλλη οθόνη για την ίδια πράξη.
 */

import { COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import {
  changedCommercialAmounts,
  commercialDraftOf,
  commercialPatchOf,
  COMMERCIAL_PRICE_FIELD_ROLE,
  parsePriceDraft,
  priceFieldsForStatus,
} from '../commercial-draft';

/** Η «ΔΟΚΙΜΗ Θ» όπως είναι σήμερα στη ζωντανή Firestore (μετρημένο 2026-09-18). */
const dokimiTheta = { commercialStatus: 'for-rent', commercial: { rentPrice: 60, askingPrice: null, finalPrice: null } };

describe('Α. Η ΚΑΤΑΣΤΑΣΗ ΟΔΗΓΕΙ ΤΑ ΠΕΔΙΑ (Revit «driven parameter»)', () => {
  it('🔴 Α1 — «προς ενοικίαση» ζητά ΜΟΝΟ ενοίκιο — όχι τιμή πώλησης', () => {
    expect(priceFieldsForStatus('for-rent')).toEqual(['rentPrice']);
  });

  it('Α2 — «πώληση και ενοικίαση» ζητά και τα δύο, πώληση πρώτα', () => {
    expect(priceFieldsForStatus('for-sale-and-rent')).toEqual(['askingPrice', 'rentPrice']);
  });

  it('Α3 — κάθε άλλη κατάσταση ζητά τιμή πώλησης (όπως η φόρμα ακινήτου πάντα)', () => {
    const others = COMMERCIAL_STATUSES.filter((s) => s !== 'for-rent' && s !== 'for-sale-and-rent');
    for (const status of others) expect(priceFieldsForStatus(status)).toEqual(['askingPrice']);
  });

  it('Α4 — κάθε πεδίο έχει ρόλο ⇒ μονάδα: «€» για πώληση, «€/μήνα» για ενοίκιο', () => {
    expect(COMMERCIAL_PRICE_FIELD_ROLE).toEqual({ askingPrice: 'sale', rentPrice: 'rent' });
  });
});

describe('Β. ΚΕΙΜΕΝΟ → ΠΟΣΟ', () => {
  it.each([
    ['', null], ['  ', null], ['0', null], ['-5', null], ['abc', null],
    ['60', 60], ['12.5', 12.5], [' 12000 ', 12000],
  ])('Β1 — «%s» ⇒ %p (το μηδέν είναι κενή φόρμα, όχι δωρεάν θέση)', (raw, expected) => {
    expect(parsePriceDraft(raw)).toBe(expected);
  });
});

describe('Γ. ΠΡΟΧΕΙΡΟ ↔ ΑΠΟΘΗΚΕΥΜΕΝΟ', () => {
  it('Γ1 — η ΔΟΚΙΜΗ Θ γεμίζει το πρόχειρο με «60» στο ενοίκιο, κενό στην πώληση', () => {
    expect(commercialDraftOf(dokimiTheta)).toEqual({ commercialStatus: 'for-rent', askingPrice: '', rentPrice: '60' });
  });

  it('Γ2 — άγνωστη ή απούσα κατάσταση ⇒ «εκτός αγοράς», ποτέ μαντεψιά', () => {
    expect(commercialDraftOf({}).commercialStatus).toBe('unavailable');
    expect(commercialDraftOf({ commercialStatus: 'for_rent_maybe' }).commercialStatus).toBe('unavailable');
  });

  it('🔴 Γ3 — το περιστατικό: θέση εκτός αγοράς → «προς ενοικίαση, 60» ⇒ το σώμα του PATCH', () => {
    const draft = { commercialStatus: 'for-rent' as const, askingPrice: '', rentPrice: '60' };
    expect(commercialPatchOf(draft, { commercialStatus: 'unavailable' }))
      .toEqual({ commercialStatus: 'for-rent', commercial: { rentPrice: 60 } });
  });

  it('Γ4 — ιδεμπότητα: ίδιο πρόχειρο πάνω στο ίδιο έγγραφο ⇒ ΚΕΝΟ σώμα', () => {
    expect(commercialPatchOf(commercialDraftOf(dokimiTheta), dokimiTheta)).toEqual({});
  });

  it('Γ5 — αλλαγή ΜΟΝΟ κατάστασης: το κρυμμένο ποσό ΔΕΝ σβήνεται (Figma — η κρυμμένη τιμή μένει)', () => {
    const draft = { ...commercialDraftOf(dokimiTheta), commercialStatus: 'unavailable' as const };
    expect(commercialPatchOf(draft, dokimiTheta)).toEqual({ commercialStatus: 'unavailable' });
  });

  it('Γ6 — άδειασμα πεδίου ⇒ ρητό `null`· `undefined` αποθηκευμένο ≡ `null`', () => {
    expect(changedCommercialAmounts({ askingPrice: '', rentPrice: '' }, dokimiTheta.commercial))
      .toEqual({ rentPrice: null });
    expect(changedCommercialAmounts({ askingPrice: '', rentPrice: '' }, undefined)).toEqual({});
  });
});
