/**
 * 🔴 ΑΓΚΥΡΑ Ζ64 — **το record λέγεται στο ίδιο το αρχείο, με εξήγηση** (ADR-916 Φ-Δ.6 · Ο14).
 * @related components/shared/files/FileRecordBadge.tsx · lib/files/file-hold.ts (`isDeclaredRecord`)
 *
 * Μεταλλάξεις που πρέπει να ρίξουν αυτό το αρχείο: σήμα και στο αντίτυπο του αγοραστή · σήμα χωρίς εξήγηση · δεύτερος
 * κριτής στο component αντί για τον ΕΝΑ.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TooltipProvider } from '@/components/ui/tooltip';

import { FileRecordBadge } from '../FileRecordBadge';

const MARK = { protocolId: 'phpr_1', handoverId: 'phov_1', revision: 1 };
const renderBadge = (file: Parameters<typeof FileRecordBadge>[0]['file']) =>
  render(<TooltipProvider><FileRecordBadge file={file} /></TooltipProvider>);

describe('Ζ64 — σήμα record γραμμής αρχείου', () => {
  it('αντίτυπο εταιρείας (record) ⇒ «Αρχείο · δεν διαγράφεται», εστιάσιμο για την εξήγηση', () => {
    renderBadge({ companyId: 'comp_1', hold: 'record', handoverProtocolOf: MARK });
    const badge = screen.getByText('list.record');
    expect(badge.closest('[data-record="true"]')).toHaveAttribute('tabindex', '0');
  });

  it('🔴 αντίτυπο του ΑΓΟΡΑΣΤΗ (ίδιο σημάδι, προσωπικό) ⇒ κανένα σήμα: είναι δικό του', () => {
    const { container } = renderBadge({ userId: 'uid_anna', handoverProtocolOf: MARK });
    expect(container).toBeEmptyDOMElement();
  });

  it('νομική δέσμευση (σιωπηλή) ή απλό αρχείο ⇒ κανένα σήμα record', () => {
    expect(renderBadge({ companyId: 'c', hold: 'legal' }).container).toBeEmptyDOMElement();
  });
});
