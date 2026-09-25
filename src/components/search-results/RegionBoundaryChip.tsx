'use client';

/**
 * # «ΑΦΑΙΡΕΣΗ ΟΡΙΟΥ» — Η ΠΕΡΙΟΧΗ ΠΟΥ ΖΗΤΗΘΗΚΕ, ΟΡΑΤΗ ΚΑΙ ΑΝΑΣΤΡΕΨΙΜΗ (ADR-883)
 *
 * Κάθεται στη θέση του διακόπτη *«Αναζήτηση καθώς μετακινώ τον χάρτη»* — και **τον
 * αντικαθιστά**, δεν στέκεται δίπλα του: όσο υπάρχει όριο, η κίνηση του χάρτη **δεν** αλλάζει
 * την περιοχή *(δες `useMapAreaSearch`)*, άρα ένας διακόπτης εκεί θα υποσχόταν κάτι που δεν
 * κάνει.
 *
 * 🏆 **Ένα βήμα πάνω από το Zillow — η γενεαλογία ως κουμπιά**: *«ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ - ΕΥΟΣΜΟΥ ›
 * Π.Ε. ΘΕΣΣΑΛΟΝΙΚΗΣ»*. Ο άνθρωπος που βρήκε λίγα αποτελέσματα **ανεβαίνει ένα επίπεδο με ένα
 * κλικ**, αντί να ξαναγράψει αναζήτηση. Το Zillow σε αφήνει μόνο να σβήσεις το όριο.
 *
 * 🔑 **Οικισμός (§5.10)**: *«Δορκάδα» · «Οικισμός · αποτελέσματα στο όριο: Τοπική Κοινότητα
 * Καρτερών»* — ο άνθρωπος ξέρει ότι το περίγραμμα είναι της κοινότητας, όχι επινοημένο χωριό.
 *
 * ⚠️ **Τρεις καταστάσεις, τρία κείμενα** — «φορτώνει» και «μη διαθέσιμο» δεν είναι το ίδιο,
 * και κανένα δεν παρουσιάζεται ως «δεν βρέθηκαν αγγελίες».
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TOUCH_TARGET_MIN } from '@/design-system/touch-target';
import { useAdminAreaIndex } from '@/hooks/geo/useAdminAreaIndex';
import { adminAreaLineage } from '@/lib/geo/admin-area-search';
import { SETTLEMENT_LEVEL, boundaryOwnerId } from '@/lib/geo/admin-area-index-file';
import type { AdminBoundaryState } from '@/hooks/geo/useAdminBoundary';
import { BoundaryChipFrame } from './BoundaryChipFrame';

interface RegionBoundaryChipProps {
  readonly region: Exclude<AdminBoundaryState, { status: 'none' }>;
  readonly onRemove: () => void;
  /** Ανέβασμα σε ευρύτερη περιοχή της γενεαλογίας. */
  readonly onWiden: (adminId: string) => void;
}

/** Πόσοι πρόγονοι φαίνονται — ο άμεσος γονέας και ένας ακόμη· η Περιφέρεια σπάνια χρειάζεται. */
const LINEAGE_SHOWN = 2;

export function RegionBoundaryChip({ region, onRemove, onWiden }: RegionBoundaryChipProps) {
  // ADR-744: δικό του namespace — το `search-results` έχει εξαντλήσει τον προϋπολογισμό του κελύφους.
  const { t, isNamespaceReady } = useTranslation(['search-region']);
  const index = useAdminAreaIndex();

  const area = index?.areas.get(region.adminId);
  const name = area?.name ?? null;
  // §5.10 — ΤΙΜΙΟ chip: ο οικισμός δεν έχει δικό του όριο· λέμε ποιανού το όριο βλέπει ο άνθρωπος.
  const shownBoundary =
    area?.level === SETTLEMENT_LEVEL ? (index?.areas.get(boundaryOwnerId(area))?.name ?? null) : null;
  const lineage = index === null ? [] : adminAreaLineage(index, region.adminId).slice(0, LINEAGE_SHOWN);

  // Πριν φορτώσει το namespace: τίποτα — ποτέ ωμά κλειδιά (CHECK 3.51), ούτε στο SSR.
  return isNamespaceReady ? (
    <BoundaryChipFrame label={t('search-region:boundary.label')} title={name ?? region.adminId} onRemove={onRemove}>
      {shownBoundary !== null && (
        <p className="text-xs text-muted-foreground">
          {t('search-region:boundary.settlementWithin', { name: shownBoundary })}
        </p>
      )}
      {region.status === 'loading' && (
        <p role="status" className="text-xs text-muted-foreground">{t('search-region:boundary.loading')}</p>
      )}
      {region.status === 'unavailable' && (
        <p role="alert" className="text-xs text-muted-foreground">{t('search-region:boundary.unavailable')}</p>
      )}

      {lineage.length > 0 && (
        <ol className="flex flex-wrap justify-center gap-x-2 text-xs text-muted-foreground">
          {lineage.map((area) => (
            <li key={area.id}>
              <button
                type="button"
                onClick={() => onWiden(area.id)}
                aria-label={t('search-region:boundary.widen', { name: area.name })}
                // WCAG 2.5.8: σε κινητό οι βαθμίδες στοιβάζονται — 16 px ύψος ήταν στόχοι που εφάπτονται.
                className={`${TOUCH_TARGET_MIN} underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline`}
              >
                <span aria-hidden="true">› </span>
                {area.name}
              </button>
            </li>
          ))}
        </ol>
      )}
    </BoundaryChipFrame>
  ) : null;
}
