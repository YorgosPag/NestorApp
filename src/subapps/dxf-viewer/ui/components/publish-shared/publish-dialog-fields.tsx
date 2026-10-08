'use client';

/**
 * @fileoverview **ΤΑ ΚΟΙΝΑ ΠΕΔΙΑ ΤΩΝ ΔΙΑΛΟΓΩΝ ΔΗΜΟΣΙΕΥΣΗΣ** — «σε ποιο ακίνητο;», ίδιο για 3D και για κάτοψη.
 * @related ../publish-model/PublishModelDialog · ../publish-floorplan/PublishFloorplanDialog (ADR-845 · ADR-909 Β2.5)
 * @module subapps/dxf-viewer/ui/components/publish-shared/publish-dialog-fields
 *
 * Εξήχθησαν από τον διάλογο του 3D όταν απέκτησαν **δεύτερο** καλούντα: ο επιλογέας ακινήτου γραμμένος δύο
 * φορές είναι ο κλώνος που πιάνει το CHECK 3.28 — και, χειρότερα, δύο διάλογοι που θα μπορούσαν να
 * προσφέρουν **άλλα** ακίνητα για το ίδιο κτήριο.
 */

import * as React from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Property } from '@/types/property';

/**
 * Ο επιλογέας ακινήτου.
 *
 * ⛔ **ΚΑΝΕΝΑ `<SelectItem value="">`** *(CHECK 3.48)*: το Radix **δεσμεύει** το κενό string και
 * ένα τέτοιο στοιχείο ρίχνει **ολόκληρη** την επιφάνεια σε χρόνο εκτέλεσης. Το «τίποτα
 * επιλεγμένο» το λέει το `placeholder`, και το «τίποτα διαθέσιμο» ένα **μη επιλέξιμο** μήνυμα.
 */
export function PropertyPicker({ properties, value, onChange }: {
  readonly properties: readonly Property[];
  readonly value: string;
  readonly onChange: (id: string) => void;
}): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <Select value={value === '' ? undefined : value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={t('publishModel.propertyPlaceholder')} /></SelectTrigger>
      <SelectContent>
        {properties.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t('publishModel.noProperties')}</p>
        ) : (
          properties.map((property) => (
            <SelectItem key={property.id} value={property.id}>{propertyLabel(property)}</SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

/** «A-101 — Διαμέρισμα 2ου» ή σκέτο το όνομα: ο κωδικός είναι **προαιρετικός** στον τύπο. */
function propertyLabel(property: Property): string {
  return property.code ? `${property.code} — ${property.name}` : property.name;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
