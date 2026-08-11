'use client';

/**
 * =============================================================================
 * SEARCH BACKFILL — Τα πλακίδια στατιστικών, **μία φορά** (ADR-784 §10.4 · CHECK 3.28)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ:** το `SearchBackfillPageContent` έγραφε το **ίδιο** πλέγμα πλακιδίων
 * **τρεις** φορές (μετανάστευση θέσεων στάθμευσης · μετανάστευση επαφών · αποτελέσματα
 * ευρετηρίασης) — ίδιο σώμα, διαφορετικές τιμές. Το ονόμασε το **CHECK 3.28** (jscpd, ADR-584)
 * όταν το αρχείο ακουμπήθηκε για τη μετανάστευση του ADR-784 §10.
 *
 * ⚠️ **Το πλήθος των πλακιδίων το δηλώνει ο ΚΑΛΩΝ** και είναι **σταθερό ανά κλήση** (4 · 5 · 4).
 * Γι' αυτό το πλέγμα κρατά **σκάλα** και όχι εγγενή κατάλογο — δες τη ρήτρα `catalog-exempt`
 * παρακάτω, ίδια περίπτωση με το `ReportKPIGrid` (ADR-784 §10.3).
 *
 * @module components/admin/search-backfill/MigrationStatTiles
 */

import React from 'react';

import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface MigrationStatTile {
  id: string;
  value: number;
  /** **Μεταφρασμένη** από τον καλούντα (N.11: μηδέν κείμενο εδώ). */
  label: string;
  /** Το χρωματικό οικογενειακό όνομα του πλακιδίου (`blue` · `green` · `yellow` · …). */
  color: string;
}

export interface MigrationStatTilesProps {
  tiles: readonly MigrationStatTile[];
  /** Οι κλάσεις του πλέγματος — **σταθερής αρίτητας ανά κλήση**, γι' αυτό τις ορίζει ο καλών. */
  className: string;
}

export function MigrationStatTiles({ tiles, className }: MigrationStatTilesProps) {
  const colors = useSemanticColors();

  return (
    /* catalog-exempt: Η ΑΡΙΤΗΤΑ ΤΗΝ ΔΗΛΩΝΕΙ Ο ΚΑΛΩΝ — και οι τρεις κλήσεις περνούν σταθερό
       πίνακα κυριολεκτικών (4 · 5 · 4 πλακίδια). Το `.map()` είναι ο ΤΡΟΠΟΣ απόδοσης, όχι
       δήλωση ότι το πλήθος είναι άγνωστο· εγγενής κατάλογος εδώ θα ισοπέδωνε τη σκάλα που ο
       καλών επέλεξε ρητά ανά περίπτωση. Ίδια περίπτωση με το ReportKPIGrid (ADR-784 §10.3). */
    <div className={className}>
      {tiles.map(({ id, value, label, color }) => (
        <div key={id} className={`text-center p-3 rounded-lg bg-${color}-500/10`}>
          <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
          <div className={cn('text-sm', colors.text.muted)}>{label}</div>
        </div>
      ))}
    </div>
  );
}
