/**
 * @jest-environment node
 *
 * @fileoverview **ΟΛΟΚΛΗΡΗ Η ΑΛΥΣΙΔΑ της εισαγωγής ΠΕΑ στο γραφείο** — από το κείμενο του PDF μέχρι ό,τι γράφει ο
 * server και ό,τι ξαναδιαβάζει η φόρμα (ADR-777 §8.96.5, Ε2 της Φάσης 3).
 * @related lib/energy-certificate/{pea-text,pea-proposal,energy-certificate-form} ·
 *   features/property-details/components/property-fields-form-mapper · services/property/property-form-sync ·
 *   api/properties/[id]/{property-patch-helpers,property-energy-patch}
 *
 * 🔴 **Γιατί υπάρχει**: η πρώτη ζωντανή αποθήκευση έγραψε `scope: null` ενώ ο διάλογος είχε δώσει εμβέλεια. Το
 * ιστορικό οντότητας (`entity_audit_trail`) απέδειξε ότι η εισαγωγή **είχε εφαρμοστεί** (γράφτηκαν `sourceFileId`,
 * `issuedOn`, `usefulArea`, `finalEnergy`, κλάση με το χέρι) — χάθηκε **μόνο** η εμβέλεια. Κάθε κρίκος είχε δικό του
 * test· κανένα δεν περνούσε τη διόρθωση από **όλους** μαζί, με τη μορφή εκείνης της στιγμής: κλάση μη αναγνώσιμη,
 * EP/CO₂ κενά, προϋπάρχον μπλοκ του παλιού σχήματος `{ class }` χωρίς `scope`. Αυτό κάνει εδώ.
 *
 * Τιμές **συνθετικές** — καμία από αρχείο πελάτη.
 */

import { energyOfForm, patchedEnergyFormSlice } from '@/lib/energy-certificate/energy-certificate-form';
import { peaPatchOf, peaProposalOf } from '@/lib/energy-certificate/pea-proposal';
import { readPeaText } from '@/lib/energy-certificate/pea-text';
import { SYNTHETIC_PEA, peaPagesPdfjs } from '@/lib/energy-certificate/__tests__/pea-text.fixture';
import { propertyDisplayArea } from '@/lib/properties/property-display-area';
import { buildPropertyUpdatesFromForm } from '@/features/property-details/components/property-fields-form-mapper';
import { buildFormDataFromProperty, diffServerSnapshot } from '@/services/property/property-form-sync';
import type { Property } from '@/types/property-viewer';

import { energyDeclarationPatch } from '../property-energy-patch';
import { PropertyPatchSchema } from '../property-patch-helpers';

const AT = '2026-10-14T09:18:54.000Z';
const FILE_ID = 'file_pea_chain';

/** Στούντιο 35 m², με την κλάση του παλιού σχήματος — ακριβώς όπως ήταν πριν από την εισαγωγή. */
const STUDIO = {
  id: 'prop_chain',
  name: 'Δοκιμαστικό στούντιο',
  type: 'studio',
  area: 35,
  areas: { gross: 35, net: 30 },
  energy: { class: 'A' },
} as unknown as Property;

/** Η μορφή της πρώτης δοκιμής: RR/EP/CO₂ δεν διαβάστηκαν, το ΠΕΑ πιστοποιεί όλο το κτήριο (ωφέλιμη ≫ εμβαδό). */
const UNREADABLE_CLASS_PEA = { ...SYNTHETIC_PEA, reference: '', primary: '', co2: '', useful: '131.5' };

function importedForm(chosenScope: 'building' | 'unit') {
  const form = buildFormDataFromProperty(STUDIO);
  const read = readPeaText(peaPagesPdfjs(UNREADABLE_CLASS_PEA));
  if (read.kind !== 'read') throw new Error('αναμενόταν ανάγνωση');
  const proposal = peaProposalOf(read.reading, {
    fileId: FILE_ID,
    current: energyOfForm(form),
    propertyArea: propertyDisplayArea(STUDIO),
    today: '2026-10-14',
  });
  const patch = peaPatchOf(proposal, { class: 'A+', scope: chosenScope });
  if (patch === null) throw new Error('αναμενόταν έγκυρη διόρθωση');
  return { proposal, form: { ...form, ...patchedEnergyFormSlice(form, patch) } };
}

/** Φόρμα → σώμα (μέσα από JSON, όπως στο δίκτυο) → πόρτα → ό,τι γράφει ο server. */
function savedEnergyOf(form: ReturnType<typeof importedForm>['form']): Record<string, unknown> {
  const updates = buildPropertyUpdatesFromForm({ formData: form, property: STUDIO, isMultiLevel: false });
  const body = PropertyPatchSchema.parse(JSON.parse(JSON.stringify({ energy: updates.energy })));
  const written = energyDeclarationPatch(STUDIO.id, body.energy, STUDIO as unknown as Record<string, unknown>, AT);
  return written.energy as Record<string, unknown>;
}

describe('Α — η μορφή της πρώτης αποθήκευσης: κλάση μη αναγνώσιμη, EP/CO₂ κενά, παλιό `{ class }`', () => {
  it('η πρόταση: κλάση «δεν προκύπτει», εμβέλεια «κτήριο» προτεινόμενη', () => {
    const { proposal } = importedForm('building');
    expect(proposal.classResult).toEqual({ kind: 'invalid' });
    expect(proposal.suggestedScope).toBe('building');
  });

  it.each(['building', 'unit'] as const)('🔴 εμβέλεια «%s» στον διάλογο ⇒ η ΙΔΙΑ γράφεται στο έγγραφο', (scope) => {
    expect(savedEnergyOf(importedForm(scope).form)).toMatchObject({
      class: 'A+',
      primaryEnergy: null,
      co2Emissions: null,
      usefulArea: 131.5,
      scope,
      sourceFileId: FILE_ID,
    });
  });

  it('🔴 η ηχώ του server (νέο στιγμιότυπο) ξαναδίνει στη φόρμα την εμβέλεια, όχι `null`', () => {
    const saved = savedEnergyOf(importedForm('building').form);
    const echo = diffServerSnapshot(
      buildFormDataFromProperty(STUDIO),
      buildFormDataFromProperty({ ...STUDIO, energy: saved } as unknown as Property),
    );
    expect(echo.energyDetails?.scope).toBe('building');
  });
});
