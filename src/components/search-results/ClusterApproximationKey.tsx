'use client';

/**
 * **Η ΛΕΖΑΝΤΑ ΤΟΥ `≈`** — τι σημαίνει το `+5≈` πάνω σε ομάδα αγγελιών (ADR-777 §8.66.11).
 *
 * Η ετικέτα της ομάδας (`12 · +5≈`) είναι **δεδομένα σε στυλ MapLibre**: δεν περνά από `t()`, δεν τη διαβάζει
 * αναγνώστης οθόνης (§8.66.5). Το *τι σημαίνει* το `≈` το λέει αυτή η λεζάντα, με κανονικό i18n και κείμενο.
 *
 * 🔑 **Εμφανίζεται ΜΟΝΟ όταν ο χάρτης ζωγράφισε ομάδα με `≈`** — ίδιο ιδίωμα με την υποσημείωση του
 * `AreaLedgerBar`: μια μόνιμη εξήγηση για σύμβολο που δεν υπάρχει στην οθόνη εκπαιδεύει τον αναγνώστη να την
 * προσπερνά. Το «ζωγράφισε» είναι η **ίδια** ανάγνωση `idle` με τις πινακίδες (`readApproximateClusters`).
 *
 * ⚠️ **Namespace `search-focus` (lazy), όχι `search-results`**: το δεύτερο ταξιδεύει ΟΛΟΚΛΗΡΟ στο κέλυφος κάθε σελίδας
 * με σφραγισμένο ταβάνι (CHECK 3.34), και η λεζάντα **δεν** χρειάζεται πρώτο καρέ — φαίνεται μόνο μετά το `idle` του
 * χάρτη. Μέχρι να φορτώσει το namespace δεν αποδίδεται τίποτα (ποτέ ωμό κλειδί, CHECK 3.51).
 *
 * 🏆 Οι μεγάλοι (Zillow, Redfin, Idealista) δείχνουν σκέτο πλήθος — δεν έχουν σύμβολο να εξηγήσουν, γιατί δεν
 * κρατούν την αβεβαιότητα θέσης ως δεδομένο.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { MAP_OVERLAY_SURFACE } from '@/subapps/geo-canvas/components/map-overlays/overlay-surface';

interface ClusterApproximationKeyProps {
  /** Ζωγραφίστηκε ομάδα με `≈`; — από το `DrawnListingSnapshot.approximateClusters`. */
  readonly visible: boolean;
}

export function ClusterApproximationKey({ visible }: ClusterApproximationKeyProps) {
  const { t, isNamespaceReady } = useTranslation(['search-focus']);
  if (!visible || !isNamespaceReady) return null;

  return (
    <aside
      aria-label={t('search-focus:clusterKey.label')}
      className={cn(MAP_OVERLAY_SURFACE, 'pointer-events-none absolute bottom-2 left-2 z-10 max-w-64 px-2 py-1 text-xs')}
    >
      <p>{t('search-focus:clusterKey.approximate')}</p>
    </aside>
  );
}
