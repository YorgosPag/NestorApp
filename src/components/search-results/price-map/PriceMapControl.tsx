'use client';

/**
 * **Ο διακόπτης του χάρτη τιμών** (ADR-890 §14) — και το πάνελ, όταν είναι ανοιχτός. Φορτώνεται δυναμικά
 * (`price-map-entry.tsx`), άρα τα κλειδιά του δεν μετρούν στο route slice της αναζήτησης (CHECK 3.34).
 *
 * 🔑 **Εργαλείο της μπάρας του χάρτη** (`MapToolbarButton`, θέση `tools` — ADR-777 §8.85): εικονίδιο «Στρώσεις»
 * με κατάσταση (`aria-pressed`), όπως ο επιλογέας στρώσεων του Google Maps. Το πάνελ ανοίγει **κάτω από την
 * μπάρα, δεξιά στοιχισμένο** (`MAP_TOOLBAR_PANEL`) — προς τα αριστερά δεν χωρά στα 390px. Ένα σημείο σε κινητό
 * και desktop, ποτέ δεύτερη γωνία που συγκρούεται με το φύλλο αποτελεσμάτων.
 * ⚠️ Το κουμπί εμφανίζεται **μόλις φορτώσει το namespace** — ποτέ ωμό κλειδί (CHECK 3.51)· δεν είναι πρώτο καρέ.
 */

import dynamic from 'next/dynamic';
import { Layers } from 'lucide-react';
import React from 'react';

import { usePriceMapModel } from '@/components/search-results/price-map/PriceMapProvider';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { MAP_TOOLBAR_PANEL, MapToolbarButton } from '@/subapps/geo-canvas/components/map-overlays/MapToolbar';

const LazyPriceMapPanel = dynamic(() => import('./PriceMapPanel'), { ssr: false });

export default function PriceMapControl() {
  const { t, isNamespaceReady } = useTranslation(['price-map']);
  const iconSizes = useIconSizes();
  const { visible, setVisible } = usePriceMapModel();
  if (!isNamespaceReady) return null;

  return (
    <MapToolbarButton
      // ⚠️ ΣΤΑΘΕΡΟ όνομα: την κατάσταση τη λέει το `aria-pressed` (WAI-ARIA APG «Button» — όνομα που αλλάζει
      // ΜΑΖΙ με το pressed ανακοινώνει την κατάσταση δύο φορές, και αντίθετα).
      label={t('price-map:toggle.open')}
      icon={<Layers className={iconSizes.md} aria-hidden="true" />}
      pressed={visible}
      onClick={() => setVisible(!visible)}
    >
      {visible && (
        <aside className={MAP_TOOLBAR_PANEL}>
          <LazyPriceMapPanel />
        </aside>
      )}
    </MapToolbarButton>
  );
}
