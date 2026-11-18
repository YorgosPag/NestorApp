'use client';

/**
 * @fileoverview **Οι Μελέτες Ενεργειακής Απόδοσης ενός έργου** (ADR-777 §8.102) — οι επιλογές της παραπομπής στην
 * εκτίμηση ακινήτου υπό κατασκευή.
 * @related `config/upload-entry-points/energy-certificate-slot.ts` (`energyStudySlot` — ο τύπος, από τον κατάλογο) ·
 *   `server/energy-certificate/energy-certificate-file-scope.ts` (`companyMeaFileScope` — ο ΙΔΙΟΣ κριτής στον server) ·
 *   `components/shared/energy-certificate/EnergyProjectionFields.tsx`
 * @module hooks/energy-certificate/useProjectEnergyStudies
 *
 * 🔑 **Ίδιο δοχείο με τον server**: έργο · εταιρεία της συνεδρίας · `purpose` της γραμμής `study-energy-mea`. Ό,τι
 * προσφέρει η οθόνη το δέχεται και ο server — και ό,τι δεν δέχεται ο server δεν προσφέρεται.
 * 🔑 **Μόνο ανάγνωση**: η ΜΕΑ ανεβαίνει από τα «Έγγραφα» του έργου, όχι από εδώ.
 */

import { useMemo } from 'react';

import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { energyStudySlot } from '@/config/upload-entry-points/energy-certificate-slot';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useFileDisplayName } from '@/hooks/useFileDisplayName';
import type { EnergyCertificate } from '@/lib/energy-certificate/energy-certificate';
import {
  energyConstructionNoticeOf,
  type EnergyConstructionContext,
  type EnergyConstructionNotice,
  type EnergyStudyOption,
} from '@/lib/energy-certificate/energy-construction-notice';
import { companyReadCustodyOf } from '@/lib/files/file-custody';

/** Οι ΜΕΑ του έργου — `null` όταν η μονάδα δεν ανήκει σε έργο (ή ο κατάλογος έχασε τη γραμμή, που το φυλάει test). */
export function useProjectEnergyStudies(projectId: string | null, enabled: boolean): readonly EnergyStudyOption[] | null {
  const companyId = useCompanyId()?.companyId ?? null;
  const purpose = energyStudySlot()?.purpose ?? null;
  const active = enabled && projectId !== null && purpose !== null;
  const { files } = useEntityFiles({
    entityType: ENTITY_TYPES.PROJECT,
    entityId: projectId ?? '',
    custody: companyReadCustodyOf(companyId),
    purpose: purpose ?? undefined,
    autoFetch: active,
  });
  const translateDisplayName = useFileDisplayName();

  return useMemo(() => {
    if (projectId === null || purpose === null) return null;
    if (!active) return [];
    return files
      .filter((file) => file.purpose === purpose)
      .map((file) => ({ fileId: file.id, label: translateDisplayName(file) }));
  }, [active, files, projectId, purpose, translateDisplayName]);
}

/**
 * **Το πλαίσιο κατασκευής της φόρμας του γραφείου** — η υπενθύμιση του κύκλου ζωής και οι ΜΕΑ του έργου. Οι μελέτες
 * ζητούνται μόνο όταν η απάντηση είναι «υπό κατασκευή»: καμία ανάγνωση για τις μονάδες που δεν τις χρειάζονται.
 *
 * @param projectId η **ταυτότητα** του έργου της μονάδας (`Property.projectId` — η ίδια που διαβάζουν η λίστα,
 *   `usePropertyCardModel`, και ο server, `property-energy-patch`) — `''`/`null`/`undefined` = χωρίς έργο.
 *   ⛔ **Ποτέ** το `Property.project`: είναι καθρέφτης **ονόματος** που δεν υπάρχει στο έγγραφο (μετρημένο live
 *   2026-11-18: έφτασε `undefined` σε ακίνητο μέσα σε έργο ⇒ `.trim()` έριξε τη σελίδα, και η ΜΕΑ δεν θα προσφερόταν
 *   ποτέ). Το `projectId` είναι προαιρετικό στον τύπο — γι' αυτό ο έλεγχος είναι `typeof`.
 */
export function useEnergyConstructionContext(
  projectId: string | null | undefined,
  operationalStatus: unknown,
  certificate: Pick<EnergyCertificate, 'class' | 'absence'>,
): { readonly context: EnergyConstructionContext; readonly notice: EnergyConstructionNotice | null } {
  const project = typeof projectId === 'string' && projectId.trim() !== '' ? projectId : null;
  const studies = useProjectEnergyStudies(project, certificate.absence === 'under-construction');
  const notice = energyConstructionNoticeOf(operationalStatus, certificate);
  const context = useMemo(() => ({ studies }), [studies]);
  return { context, notice };
}
