'use client';

/**
 * @fileoverview **Η ΚΑΡΤΕΛΑ «ΠΕΡΙΗΓΗΣΗ 360°»** του ακινήτου γραφείου — δίπλα στα υπόλοιπα μέσα (φωτογραφίες · βίντεο).
 * @related ADR-884 §4.5 (Κ3α · Κ3β) · ADR-777 §8.30 · components/spatial-tour/SpatialTourPanel
 * @module components/properties/tabs/PropertyTourTab
 *
 * 📷 Ίδιο πάνελ με την πλευρά ιδιώτη· διαχειρίζεται όποιος έχει `listings:listings:publish` στον μισθωτή (το κρίνει
 * ο διακομιστής). Το `companyId` ανοίγει τους προσωπικούς συνδέσμους θέασης (ADR-315, εμβέλεια μισθωτή).
 */

import React from 'react';

import { SpatialTourPanel } from '@/components/spatial-tour/SpatialTourPanel';
import type { Property } from '@/types/property';

export function PropertyTourTab({ property }: { readonly property: Property }): React.ReactElement {
  return (
    <article className="p-2">
      <SpatialTourPanel subject={{ kind: 'company-property', id: property.id }} companyId={property.companyId ?? null} />
    </article>
  );
}
