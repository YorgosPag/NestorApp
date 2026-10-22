'use client';

/**
 * @fileoverview **Η ΚΑΡΤΕΛΑ «ΠΑΡΑΔΟΣΗ»** του ακινήτου γραφείου — η παράδοση του φακέλου σε κάθε αγοραστή.
 * @related ADR-916 §5.15 (Φ-Δ) · components/property-handover-office/PropertyHandoverPanel
 * @module components/properties/tabs/PropertyHandoverTab
 *
 * 🔑 Τεμπέλικη (`React.lazy`, `propertiesMappings`): το περιεχόμενό της ζει πίσω από καρτέλα, άρα δεν φορτώνει πριν το
 *    πρώτο καρέ της σελίδας. Ποιος βλέπει τι το κρίνει ο διακομιστής (`properties:properties:view`, ίδιος μισθωτής).
 */

import React from 'react';

import { PropertyHandoverPanel } from '@/components/property-handover-office/PropertyHandoverPanel';
import type { Property } from '@/types/property';

export function PropertyHandoverTab({ property }: { readonly property: Property }): React.ReactElement {
  return (
    <article className="p-2">
      <PropertyHandoverPanel propertyId={property.id} />
    </article>
  );
}
