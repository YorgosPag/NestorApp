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
 * ⚠️ **Τρεις καταστάσεις, τρία κείμενα** — «φορτώνει» και «μη διαθέσιμο» δεν είναι το ίδιο,
 * και κανένα δεν παρουσιάζεται ως «δεν βρέθηκαν αγγελίες».
 */

import React from 'react';
import { X } from 'lucide-react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useAdminAreaIndex } from '@/hooks/geo/useAdminAreaIndex';
import { adminAreaLineage } from '@/lib/geo/admin-area-search';
import type { AdminBoundaryState } from '@/hooks/geo/useAdminBoundary';

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
  const iconSizes = useIconSizes();
  const index = useAdminAreaIndex();

  const name = index?.areas.get(region.adminId)?.name ?? null;
  const lineage = index === null ? [] : adminAreaLineage(index, region.adminId).slice(0, LINEAGE_SHOWN);

  // Πριν φορτώσει το namespace: τίποτα — ποτέ ωμά κλειδιά (CHECK 3.51), ούτε στο SSR.
  return isNamespaceReady ? (
    <section
      aria-label={t('search-region:boundary.label')}
      className="pointer-events-auto flex max-w-full flex-col items-center gap-1 rounded-2xl border border-border bg-card px-3 py-2 shadow-md"
    >
      <p className="flex max-w-full items-center gap-2 text-sm">
        <strong className="truncate font-semibold text-foreground">{name ?? region.adminId}</strong>
        <Button type="button" size="sm" variant="secondary" onClick={onRemove} className="shrink-0">
          <X className={iconSizes.sm} aria-hidden="true" />
          {t('search-region:boundary.remove')}
        </Button>
      </p>

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
                className="underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline"
              >
                <span aria-hidden="true">› </span>
                {area.name}
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  ) : null;
}
