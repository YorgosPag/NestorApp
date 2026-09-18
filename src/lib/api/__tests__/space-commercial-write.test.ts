/**
 * ⚓ ADR-777 §8.60.18 — η ΕΓΓΡΑΦΗ εμπορικών στοιχείων θέσης/αποθήκης.
 *
 * Το περιστατικό: θέση ή αποθήκη **δεν μπορούσε** να δηλωθεί προς ενοικίαση από την εφαρμογή.
 * Το PATCH άφηνε το `commercialStatus`/`commercial` να περάσει τον έλεγχο (`.passthrough()`) και
 * ο mapper **δεν το διάβαζε ποτέ**· το μόνο πεδίο που γραφόταν ήταν το @deprecated `price`, που
 * ο επιλυτής διαβάζει **πάντα** ως πώληση. Τα «ΔΟΚΙΜΗ Θ» (60 €/μήνα) γράφτηκαν με το χέρι στη
 * Firestore ακριβώς γι' αυτό.
 *
 * Ομάδες: Α — η γραφή · Β — ποιος κατέχει την κατάσταση · Γ — το λεξιλόγιο · Δ — το ιστορικό.
 */

import {
  COMMERCIAL_STATUSES,
  EDITOR_COMMERCIAL_STATUSES,
  isEditorCommercialStatus,
  isTransactionOwnedCommercialStatus,
} from '@/constants/commercial-statuses';
import { mapSpaceCommercialFields, SPACE_COMMERCIAL_UPDATE_FIELDS } from '../space-commercial-fields';
import { SPACE_COMMON_UPDATE_FIELDS } from '../space-entity-fields';
import { planSpaceWrite, spaceAuditEntry } from '../space-entity-write';
import { z } from 'zod';

/** Η «ΔΟΚΙΜΗ Θ» πριν δηλωθεί: θέση εκτός αγοράς, χωρίς τιμή. */
const unlistedSpot = { number: 'ΔΟΚΙΜΗ Θ', commercialStatus: 'unavailable', commercial: null };
const soldSpot = {
  number: 'P-7',
  commercialStatus: 'sold',
  commercial: { askingPrice: 12000, finalPrice: 11500, owners: [{ contactId: 'c1' }] },
};
const parkingCfg = { displayField: 'number' as const, mapExtraFields: () => ({}) };

// =============================================================================
// Α — Η ΓΡΑΦΗ
// =============================================================================

describe('Α. ΔΗΛΩΣΗ ΔΙΑΘΕΣΗΣ — Η ΓΡΑΦΗ ΓΙΝΕΤΑΙ, ΜΕ ΔΙΑΔΡΟΜΕΣ', () => {
  it('🔴 Α1 — το περιστατικό: «προς ενοικίαση, 60 €/μήνα» ΓΡΑΦΕΤΑΙ (ήταν: πεταγόταν σιωπηλά)', () => {
    const plan = planSpaceWrite(parkingCfg, { commercialStatus: 'for-rent', commercial: { rentPrice: 60 } }, unlistedSpot);
    expect(plan).toEqual({
      kind: 'write',
      updateData: { commercialStatus: 'for-rent', 'commercial.rentPrice': 60 },
    });
  });

  it('Α2 — ΔΙΑΔΡΟΜΕΣ, όχι αντικείμενο: ιδιοκτήτες/προκαταβολή/σύνδεση δεν μπορούν να σβηστούν', () => {
    const write = mapSpaceCommercialFields({ commercial: { askingPrice: 15000 } }, { commercialStatus: 'for-sale' });
    expect(write).toEqual({ kind: 'write', fields: { 'commercial.askingPrice': 15000 } });
    expect(Object.keys(write.kind === 'write' ? write.fields : {})).not.toContain('commercial');
  });

  it('Α3 — ρητό `null` σβήνει ένα ποσό· μη θετικό ή άγνωστο πεδίο αγνοείται', () => {
    const existing = { commercialStatus: 'for-rent', commercial: { rentPrice: 60 } };
    expect(mapSpaceCommercialFields({ commercial: { rentPrice: null } }, existing))
      .toEqual({ kind: 'write', fields: { 'commercial.rentPrice': null } });
    expect(mapSpaceCommercialFields({ commercial: { rentPrice: 0, finalPrice: 9 } }, existing))
      .toEqual({ kind: 'none' });
  });

  it('Α4 — ιδεμπότητα: ίδια κατάσταση και ίδια ποσά ⇒ ΚΑΜΙΑ γραφή', () => {
    const existing = { commercialStatus: 'for-rent', commercial: { rentPrice: 60 } };
    expect(mapSpaceCommercialFields({ commercialStatus: 'for-rent', commercial: { rentPrice: 60 } }, existing))
      .toEqual({ kind: 'none' });
  });

  it('Α5 — οι φυσικές αλλαγές περνούν μαζί με τα εμπορικά, σε ΕΝΑ σχέδιο γραφής', () => {
    const plan = planSpaceWrite(parkingCfg, { area: 13, commercialStatus: 'for-sale' }, unlistedSpot);
    expect(plan).toEqual({ kind: 'write', updateData: { area: 13, commercialStatus: 'for-sale' } });
  });

  it('Α6 — το σχήμα του PATCH δέχεται τα εμπορικά και ΑΡΝΕΙΤΑΙ ό,τι είναι της συναλλαγής', () => {
    const schema = z.object(SPACE_COMMON_UPDATE_FIELDS).strict();
    expect(schema.safeParse({ commercialStatus: 'for-rent', commercial: { rentPrice: 60 } }).success).toBe(true);
    expect(schema.safeParse({ commercial: { finalPrice: 11500 } }).success).toBe(false);
    expect(schema.safeParse({ commercial: { rentPrice: -5 } }).success).toBe(false);
    expect(Object.keys(SPACE_COMMERCIAL_UPDATE_FIELDS)).toEqual(['commercialStatus', 'commercial']);
  });
});

// =============================================================================
// Β — ΠΟΙΟΣ ΚΑΤΕΧΕΙ ΤΗΝ ΚΑΤΑΣΤΑΣΗ
// =============================================================================

describe('Β. Ο ΕΠΕΞΕΡΓΑΣΤΗΣ ΔΗΛΩΝΕΙ ΑΓΟΡΑ — Η ΣΥΝΑΛΛΑΓΗ ΚΑΤΕΧΕΙ ΤΑ ΥΠΟΛΟΙΠΑ', () => {
  it.each(['reserved', 'sold', 'rented'])('🔴 Β1 — «%s» από φόρμα ⇒ 400 (γίνεται μόνο από τους διαλόγους πωλήσεων)', (status) => {
    expect(mapSpaceCommercialFields({ commercialStatus: status }, unlistedSpot))
      .toEqual({ kind: 'rejected', status: 400, reason: 'not-editor-status' });
  });

  it('🔴 Β2 — πωλημένη θέση: «προς πώληση» από γρήγορη επεξεργασία ⇒ 409, ΚΑΜΙΑ γραφή', () => {
    const plan = planSpaceWrite(parkingCfg, { commercialStatus: 'for-sale', area: 12 }, soldSpot);
    expect(plan.kind).toBe('rejected');
    expect(plan.kind === 'rejected' && plan.status).toBe(409);
  });

  it('Β3 — πωλημένη θέση: ούτε ΤΙΜΗ αλλάζει από φόρμα', () => {
    expect(mapSpaceCommercialFields({ commercial: { askingPrice: 9000 } }, soldSpot))
      .toEqual({ kind: 'rejected', status: 409, reason: 'transaction-owned' });
  });

  it('Β4 — πωλημένη θέση + η ΙΔΙΑ κατάσταση ξανά ⇒ οι φυσικές αλλαγές ΠΕΡΝΟΥΝ (δεν αρνούμαστε ένα «τίποτα»)', () => {
    expect(planSpaceWrite(parkingCfg, { area: 14, commercialStatus: 'sold' }, soldSpot))
      .toEqual({ kind: 'write', updateData: { area: 14 } });
  });

  it('Β5 — άγνωστη κατάσταση ⇒ 400, ποτέ σιωπηλή «μετάφραση»', () => {
    expect(mapSpaceCommercialFields({ commercialStatus: 'for_rent_maybe' }, unlistedSpot))
      .toEqual({ kind: 'rejected', status: 400, reason: 'not-editor-status' });
  });
});

// =============================================================================
// Γ — ΤΟ ΛΕΞΙΛΟΓΙΟ
// =============================================================================

describe('Γ. ΕΝΑ ΛΕΞΙΛΟΓΙΟ — ΔΙΑΜΕΡΙΣΜΕΝΟ, ΟΧΙ ΔΕΥΤΕΡΗ ΛΙΣΤΑ', () => {
  it('Γ1 — επεξεργαστής ∪ συναλλαγή = ΟΛΟ το λεξιλόγιο, χωρίς επικάλυψη', () => {
    const editor = COMMERCIAL_STATUSES.filter(isEditorCommercialStatus);
    const owned = COMMERCIAL_STATUSES.filter(isTransactionOwnedCommercialStatus);
    expect([...editor, ...owned].sort()).toEqual([...COMMERCIAL_STATUSES].sort());
    expect(editor.filter((s) => owned.includes(s))).toEqual([]);
  });

  it('Γ2 — ο επεξεργαστής έχει ΤΗΝ ενοικίαση (το παλιό λεξιλόγιο χώρου δεν την είχε)', () => {
    expect(EDITOR_COMMERCIAL_STATUSES).toEqual(['unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent']);
  });
});

// =============================================================================
// Δ — ΤΟ ΙΣΤΟΡΙΚΟ
// =============================================================================

describe('Δ. ΙΣΤΟΡΙΚΟ — Η ΔΗΛΩΣΗ ΔΙΑΘΕΣΗΣ ΑΦΗΝΕΙ ΙΧΝΟΣ', () => {
  it('🔴 Δ1 — «προς ενοικίαση, 60» ⇒ δύο αλλαγές, ενέργεια «αλλαγή κατάστασης»', () => {
    const entry = spaceAuditEntry('parking', unlistedSpot, { commercialStatus: 'for-rent', 'commercial.rentPrice': 60 });
    expect(entry?.action).toBe('status_changed');
    expect(entry?.changes.map((c) => [c.field, c.oldValue, c.newValue])).toEqual([
      ['commercialStatus', 'unavailable', 'for-rent'],
      ['commercial.rentPrice', null, 60],
    ]);
  });

  it('Δ2 — αλλαγή μόνο ποσού ⇒ «ενημέρωση»· και για την αποθήκη το ίδιο μητρώο', () => {
    const entry = spaceAuditEntry('storage', { commercial: { askingPrice: 5000 } }, { 'commercial.askingPrice': 5500 });
    expect(entry?.action).toBe('updated');
    expect(entry?.changes).toHaveLength(1);
  });

  it('Δ3 — το `buildingId` ΔΕΝ μπαίνει (το γράφει το linkEntity) · τίποτα ⇒ καμία γραμμή', () => {
    expect(spaceAuditEntry('parking', { buildingId: 'a' }, { buildingId: 'b' })).toBeNull();
    expect(spaceAuditEntry('parking', { area: 12 }, { area: 12 })).toBeNull();
  });
});
