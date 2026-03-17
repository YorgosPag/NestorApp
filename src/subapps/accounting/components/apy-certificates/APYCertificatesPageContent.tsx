'use client';

/**
 * @fileoverview APY Certificates Page Content — Περιεχόμενο Σελίδας Βεβαιώσεων
 * @description Toggle μεταξύ λίστας βεβαιώσεων και detail view.
 *   Ίδιο navigation pattern με InvoicesPageContent.
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useState } from 'react';
import { APYCertificatesList } from './APYCertificatesList';
import { APYCertificateDetails } from './APYCertificateDetails';

// ============================================================================
// COMPONENT
// ============================================================================

export function APYCertificatesPageContent() {
  const [selectedCertificateId, setSelectedCertificateId] = useState<string | null>(null);

  if (selectedCertificateId) {
    return (
      <APYCertificateDetails
        certificateId={selectedCertificateId}
        onBack={() => setSelectedCertificateId(null)}
      />
    );
  }

  return (
    <APYCertificatesList onSelectCertificate={(id) => setSelectedCertificateId(id)} />
  );
}
