'use client';

/**
 * @fileoverview **«Έλεγχος στο μητρώο»** για μία άδεια της επαφής (ADR-915 §40.7 Φ2).
 * @module components/contacts/useLicenceRegistryCheck
 *
 * Λεπτό περιτύλιγμα της ΜΙΑΣ αρχής `useRegistryCheckReport` (ADR-948 §8 Βήμα 7): εδώ ζει μόνο **ποια** διαδρομή
 * και **πότε** ξαναδιαβάζεται (όταν αλλάξει ο **αποθηκευμένος** αριθμός).
 */

import { API_ROUTES } from '@/config/domain-constants';
import type { ProfessionalLicence } from '@/config/professional-licences';
import { useRegistryCheckReport, type RegistryCheckReportState } from '@/hooks/useRegistryCheckReport';
import type { RegistryCheckReport } from '@/types/professional-registry-check';

export type LicenceRegistryCheckState = RegistryCheckReportState<RegistryCheckReport>;

export function useLicenceRegistryCheck(contactId: string, licence: ProfessionalLicence, storedNumber: string) {
  return useRegistryCheckReport<RegistryCheckReport>(API_ROUTES.CONTACTS.LICENCE_REGISTRY_CHECK(contactId, licence), storedNumber);
}
