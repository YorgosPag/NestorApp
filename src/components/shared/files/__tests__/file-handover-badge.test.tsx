/**
 * 🔴 ΑΓΚΥΡΑ Γ39 — **ένα σήμα παράδοσης ανά γραμμή αρχείου, και το Πρωτόκολλο νικά** (ADR-916 Φ-Γ2 Σ5).
 * @related components/shared/files/FileHandoverBadge.tsx · lib/property-handover/file-handover-origin.ts
 *
 * Μεταλλάξεις που πρέπει να ρίξουν αυτό το αρχείο: η προέλευση ελέγχεται πριν το Πρωτόκολλο (το αντίτυπο του αγοραστή
 * θα έλεγε «από την κατασκευάστρια» αντί για «Πρωτόκολλο») · αλλοιωμένο σημάδι εμπιστεύεται χωρίς αναγνώστη.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}(${JSON.stringify(params)})` : key),
  }),
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import type { FileRecord } from '@/types/file-record';

import { FileHandoverBadge, fileHandoverBadgeOf } from '../FileHandoverBadge';

type Subject = Pick<FileRecord, 'handoverOrigin' | 'handoverProtocolOf'>;

const ORIGIN: NonNullable<FileRecord['handoverOrigin']> = {
  handoverId: 'phov_1', sourceFileId: 'file_company', issuerCompanyId: 'comp_1', crc32c: 'AAAAAA==', size: 10, revisionOfFileId: null,
};
const PROTOCOL: NonNullable<FileRecord['handoverProtocolOf']> = { protocolId: 'phpr_1', handoverId: 'phov_1', revision: 2 };

describe('Γ39 — σήμα παράδοσης γραμμής αρχείου', () => {
  it('αντίτυπο αγοραστή (προέλευση + Πρωτόκολλο) ⇒ ΕΝΑ σήμα: Πρωτόκολλο με την αναθεώρησή του', () => {
    const buyerCopy: Subject = { handoverOrigin: ORIGIN, handoverProtocolOf: PROTOCOL };
    expect(fileHandoverBadgeOf(buyerCopy)).toEqual({ kind: 'protocol', revision: 2 });
    render(<FileHandoverBadge file={buyerCopy} />);
    expect(screen.getByText('list.handoverProtocol({"revision":2})')).toBeInTheDocument();
    expect(screen.queryByText('list.handoverOrigin')).not.toBeInTheDocument();
  });

  it('αντίτυπο εταιρείας (μόνο Πρωτόκολλο) ⇒ σήμα Πρωτοκόλλου', () => {
    expect(fileHandoverBadgeOf({ handoverProtocolOf: PROTOCOL })).toEqual({ kind: 'protocol', revision: 2 });
  });

  it('παραδομένο αρχείο (μόνο προέλευση) ⇒ το σήμα «από την κατασκευάστρια», αμετάβλητο', () => {
    render(<FileHandoverBadge file={{ handoverOrigin: ORIGIN }} />);
    expect(screen.getByText('list.handoverOrigin')).toBeInTheDocument();
  });

  it('🔴 αλλοιωμένο σημάδι Πρωτοκόλλου (αναθ. 0) ⇒ δεν διαβάζεται ως Πρωτόκολλο', () => {
    const forged = { handoverProtocolOf: { ...PROTOCOL, revision: 0 } } as Subject;
    expect(fileHandoverBadgeOf(forged)).toEqual({ kind: 'none' });
    expect(fileHandoverBadgeOf({ ...forged, handoverOrigin: ORIGIN })).toEqual({ kind: 'origin' });
  });

  it('κανένα σημάδι ⇒ τίποτα στην οθόνη', () => {
    const { container } = render(<FileHandoverBadge file={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
