/**
 * ⚓ ADR-777 §8.60.20 — η ΓΡΑΦΗ της κατάστασης χώρου στον server (PATCH · CREATE · ιστορικό).
 *
 * Ως τις 2026-09-18 το PATCH δεχόταν **οποιοδήποτε** `status` (`z.string()`): η γρήγορη
 * επεξεργασία έγραφε «Πωλημένη» παρακάμπτοντας τη συναλλαγή, και ένα `status: 'deleted'` έστελνε
 * χώρο στον κάδο χωρίς τον κάδο. Τώρα το `status` είναι κύκλος ζωής και ΔΕΝ γράφεται από σώμα.
 *
 * Ομάδες: Α — το σχήμα αρνείται το `status` · Β — η λειτουργική γράφεται · Γ — η γέννηση · Δ — ιστορικό.
 */

import { z } from 'zod';
import { OPERATIONAL_STATUSES } from '@/constants/operational-statuses';
import {
  SPACE_COMMON_CREATE_FIELDS,
  SPACE_COMMON_UPDATE_FIELDS,
  mapCommonSpaceCreateFields,
  mapCommonSpaceFields,
} from '../space-entity-fields';
import { planSpaceWrite, spaceAuditEntry } from '../space-entity-write';

/** Όπως τα δηλώνουν οι διαδρομές: κοινά πεδία + `.passthrough()`. */
const UpdateSchema = z.object({ number: z.string().optional(), ...SPACE_COMMON_UPDATE_FIELDS }).passthrough();
const CreateSchema = z.object({ number: z.string(), ...SPACE_COMMON_CREATE_FIELDS });
const parkingCfg = { displayField: 'number' as const, mapExtraFields: () => ({}) };

describe('Α. ΤΟ `status` ΕΙΝΑΙ ΚΥΚΛΟΣ ΖΩΗΣ — ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΠΟ ΣΩΜΑ', () => {
  it.each(['sold', 'available', 'deleted', 'active'])('🔴 Α1 — PATCH με `status: %s` ⇒ 400 (όχι σιωπηλή απόρριψη)', (status) => {
    expect(UpdateSchema.safeParse({ status }).success).toBe(false);
  });

  it('Α2 — και στη ΓΕΝΝΗΣΗ: κανείς δεν διαλέγει κύκλο ζωής', () => {
    expect(CreateSchema.safeParse({ number: 'P-1', status: 'sold' }).success).toBe(false);
  });

  it('Α3 — ακόμη κι αν έφτανε στον mapper, δεν γράφεται', () => {
    expect(mapCommonSpaceFields({ status: 'sold' }, 'number')).not.toHaveProperty('status');
  });
});

describe('Β. Η ΛΕΙΤΟΥΡΓΙΚΗ ΚΑΤΑΣΤΑΣΗ ΓΡΑΦΕΤΑΙ — ΜΕ ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΑΚΙΝΗΤΩΝ', () => {
  it.each([...OPERATIONAL_STATUSES])('Β1 — «%s» περνά το σχήμα και γράφεται', (status) => {
    expect(UpdateSchema.safeParse({ operationalStatus: status }).success).toBe(true);
    expect(planSpaceWrite(parkingCfg, { operationalStatus: status }, {}))
      .toEqual({ kind: 'write', updateData: { operationalStatus: status } });
  });

  it('Β2 — εκτός λεξιλογίου (π.χ. «occupied») ⇒ 400', () => {
    expect(UpdateSchema.safeParse({ operationalStatus: 'occupied' }).success).toBe(false);
  });

  it('Β3 — ρητό `null` ⇒ «δεν δηλώνεται»· απόν ⇒ δεν αγγίζεται', () => {
    expect(mapCommonSpaceFields({ operationalStatus: null }, 'number')).toEqual({ operationalStatus: null });
    expect(mapCommonSpaceFields({}, 'number')).not.toHaveProperty('operationalStatus');
  });
});

describe('Γ. Η ΓΕΝΝΗΣΗ', () => {
  it('Γ1 — ζωντανή εγγραφή, λειτουργικά «πρόχειρο» (ίδιο με την γέννηση ακινήτου), χωρίς διάθεση', () => {
    const fields = mapCommonSpaceCreateFields({});
    expect(fields).toMatchObject({ status: 'active', operationalStatus: 'draft' });
    expect(fields).not.toHaveProperty('commercialStatus');
  });

  it('Γ2 — δηλωμένη λειτουργική στη γέννηση γράφεται όπως δόθηκε', () => {
    expect(mapCommonSpaceCreateFields({ operationalStatus: 'ready' })).toMatchObject({ operationalStatus: 'ready' });
  });
});

describe('Δ. ΤΟ ΙΣΤΟΡΙΚΟ', () => {
  it('Δ1 — αλλαγή λειτουργικής ⇒ γραμμή `status_changed`', () => {
    const entry = spaceAuditEntry('parking', { operationalStatus: 'ready' }, { operationalStatus: 'maintenance' });
    expect(entry?.action).toBe('status_changed');
    expect(entry?.changes.map((change) => change.field)).toEqual(['operationalStatus']);
  });

  it('Δ2 — ίδια τιμή ⇒ καμία γραμμή', () => {
    expect(spaceAuditEntry('storage', { operationalStatus: 'ready' }, { operationalStatus: 'ready' })).toBeNull();
  });
});
