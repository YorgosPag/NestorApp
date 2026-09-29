'use client';

/**
 * **Ο διακόπτης του χάρτη τιμών** (ADR-890 §14) — και το πάνελ, όταν είναι ανοιχτός. Φορτώνεται δυναμικά
 * (`price-map-entry.tsx`), άρα τα κλειδιά του δεν μετρούν στο route slice της αναζήτησης (CHECK 3.34).
 *
 * 🔑 **Στην ίδια στήλη με «Αναζήτηση καθώς μετακινώ» / «Σχεδίαση»** (`MapAreaControl`): ένα σημείο για κάθε χειριστήριο
 * του χάρτη, σε κινητό και desktop — όχι δεύτερη γωνία που συγκρούεται με το φύλλο αποτελεσμάτων.
 * ⚠️ Το κουμπί εμφανίζεται **μόλις φορτώσει το namespace** — ποτέ ωμό κλειδί (CHECK 3.51)· δεν είναι πρώτο καρέ.
 */

import dynamic from 'next/dynamic';
import { Layers, X } from 'lucide-react';
import React from 'react';

import { usePriceMapModel } from '@/components/search-results/price-map/PriceMapProvider';
import { ToggleButton } from '@/components/ui/toggle-button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const LazyPriceMapPanel = dynamic(() => import('./PriceMapPanel'), { ssr: false });

export default function PriceMapControl() {
  const { t, isNamespaceReady } = useTranslation(['price-map']);
  const iconSizes = useIconSizes();
  const { visible, setVisible } = usePriceMapModel();
  if (!isNamespaceReady) return null;

  return (
    <>
      <ToggleButton
        type="button"
        size="sm"
        variant="secondary"
        pressed={visible}
        onClick={() => setVisible(!visible)}
        className="pointer-events-auto shadow-sm"
      >
        {visible ? <X className={iconSizes.sm} aria-hidden="true" /> : <Layers className={iconSizes.sm} aria-hidden="true" />}
        {visible ? t('price-map:toggle.close') : t('price-map:toggle.open')}
      </ToggleButton>
      {visible && <LazyPriceMapPanel />}
    </>
  );
}
