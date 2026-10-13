/**
 * ADR-777 §8.94 — **η ενότητα «Ενεργειακό πιστοποιητικό»** της οθόνης «Βελτίωσε την αγγελία σου», πάνω στις
 * πραγματικές μηχανές (αναγνώστης · διόρθωση · ουρά · κοινό κέλυφος): στέλεχος μόνο ο server.
 *
 * Τι αποδεικνύει: (1) κάθε απάντηση φεύγει ως **μερική** διόρθωση και φαίνεται αμέσως · (2) αποτυχία ⇒ επιστροφή στην
 * αλήθεια · (3) ο καταχωρητής κρεμά την ενότητα **μόνο** όπου η προβολή λέει ότι τίθεται η ερώτηση.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { placeKnowledgeFromOwnerProperty, projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { projectListingShape } from '@/services/listings/public-listing-projection';
import type { OwnerListingResult } from '@/services/owner-property/owner-property.service';
import type { OwnerProperty } from '@/types/owner-property';

import { EnergyCertificateImproveSection } from '../EnergyCertificateImproveSection';
import { applicableImproveSections, IMPROVE_SECTION_IDS } from '../improve-sections';
import { useOwnerImproveSubjects } from '../owner-improve-subject';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

/** Ο server απαντά όταν του πούμε. */
const pending: { patch: unknown; answer: (result: OwnerListingResult) => void }[] = [];
jest.mock('@/services/owner-property/owner-property.service', () => ({
  setOwnerListingObjectiveValue: jest.fn(),
  setOwnerListingCommonCharges: jest.fn(),
  setOwnerListingEnergyCertificate: (_id: string, patch: unknown) =>
    new Promise<OwnerListingResult>((resolve) => {
      pending.push({ patch, answer: resolve });
    }),
}));

const AT = '2026-10-13T09:00:00.000Z';
const F = 'properties-enums:energyCertificate.form';
const WITH_CLASS = { class: 'C' as const, primaryEnergy: null, co2Emissions: null, issuedOn: null, usefulArea: null, finalEnergy: null, absence: null };

beforeEach(() => {
  pending.length = 0;
});

/** Ο ιδιώτης ως κάτοχος — ο ίδιος προσαρμογέας με την οθόνη. */
function OwnerSection({ owner }: { readonly owner: OwnerProperty }) {
  return <EnergyCertificateImproveSection subject={useOwnerImproveSubjects(owner).energyCertificate} />;
}

const primary = () => screen.getByLabelText(`${F}.primaryEnergy`) as HTMLInputElement;

describe('Ε1 — κάθε απάντηση αποθηκεύεται αμέσως', () => {
  it('🔴 ο αριθμός φεύγει ως ΜΕΡΙΚΗ διόρθωση — δεν ξαναστέλνει την κλάση — και η οθόνη τον δείχνει πριν απαντήσει ο server', () => {
    render(<OwnerSection owner={validOwnerProperty({ energy: WITH_CLASS })} />);

    fireEvent.change(primary(), { target: { value: '180,5' } });
    fireEvent.blur(primary());

    expect(pending).toHaveLength(1);
    expect(pending[0].patch).toEqual({ primaryEnergy: 180.5 });
    expect(primary().value).toBe('180.5');
  });

  it('χωρίς κλάση, «υπό έκδοση» φεύγει ως απάντηση — και οι αριθμοί δεν ζητούνται', () => {
    render(<OwnerSection owner={validOwnerProperty()} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'properties-enums:energyCertificate.absence.pending' }));

    expect(pending[0].patch).toEqual({ absence: 'pending' });
    expect(screen.queryByLabelText(`${F}.primaryEnergy`)).not.toBeInTheDocument();
  });
});

describe('Ε2 — αποτυχία', () => {
  it('ο server δεν αποθήκευσε ⇒ η οθόνη γυρίζει στην αλήθεια και προσφέρει επανάληψη', async () => {
    render(<OwnerSection owner={validOwnerProperty({ energy: WITH_CLASS })} />);
    fireEvent.change(primary(), { target: { value: '180' } });
    fireEvent.blur(primary());

    await act(async () => {
      pending[0].answer({ kind: 'failed', message: 'network' });
    });

    expect(screen.getByRole('alert')).toHaveTextContent('objective-value:improve.failed');
    expect(primary().value).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'objective-value:improve.retry' }));
    expect(pending).toHaveLength(2);
    expect(pending[1].patch).toEqual({ primaryEnergy: 180 });
  });
});

describe('Ε3 — ο καταχωρητής κρεμά την ενότητα μόνο όπου τίθεται η ερώτηση', () => {
  const sectionsOf = (owner: OwnerProperty) =>
    applicableImproveSections(
      projectListingShape(projectableFromOwnerProperty(owner, AT), placeKnowledgeFromOwnerProperty(owner, AT), AT),
    );

  it('κτίριο προς διάθεση ⇒ η ενότητα υπάρχει, ανάμεσα στα κοινόχρηστα και την αντικειμενική', () => {
    expect(IMPROVE_SECTION_IDS).toEqual(['commonCharges', 'energyCertificate', 'objectiveValue']);
    expect(sectionsOf(validOwnerProperty())).toContain('energyCertificate');
  });

  it('🔴 γη ⇒ καμία ενότητα ΠΕΑ — ο ίδιος κριτής με τη δημόσια αγγελία', () => {
    expect(sectionsOf(validOwnerProperty({ type: 'land' }))).not.toContain('energyCertificate');
  });

  it('🔴 ό,τι δηλώνει ο ιδιώτης φτάνει στην προβολή: το literal του `projectableFromOwnerProperty` το κουβαλά', () => {
    const owner = validOwnerProperty({ energy: { ...WITH_CLASS, primaryEnergy: 180.5, co2Emissions: 52 } });
    const shape = projectListingShape(projectableFromOwnerProperty(owner, AT), placeKnowledgeFromOwnerProperty(owner, AT), AT);
    expect(shape.energyClass).toBe('C');
    expect(shape.energyCertificate).toEqual({ primaryEnergy: 180.5, co2Emissions: 52, usefulArea: null, finalEnergy: null, absence: null });
  });
});
