'use client';

/**
 * @fileoverview **Η κάρτα της σύνθεσης της εταιρείας** — ο σκελετός για ΟΕ, ΕΠΕ και ΑΕ.
 * @module subapps/accounting/components/setup/CompanyRosterCard
 *
 * 🔴 **ΕΞΑΓΩΓΗ (N.0.2 · CHECK 3.28)**: οι τρεις ενότητες (εταίροι · μέλη · μέτοχοι) ήταν
 * **δίδυμα** — ίδια σειρά «ειδοποίηση → ΓΕΜΗ → κεφάλαιο → λίστα → σύνολο 100% → προσθήκη». Όταν η
 * Α23 (ADR-841 §7) τις άγγιξε για το πεδίο ΓΕΜΗ, η πύλη κλώνων μέτρησε τον σκελετό ως αντίγραφο.
 *
 * 🔑 **Ο σκελετός ζει εδώ· ό,τι διαφέρει έρχεται ως περιεχόμενο**: η γραμμή κάθε προσώπου
 * (`rows`), το πεδίο κεφαλαίου (`capital` — με άλλο ελάχιστο στην ΑΕ), τα κείμενα. Όλα **έτοιμο
 * κείμενο** από τον γονέα, ώστε κάθε `t()` να μένει κυριολεκτικό (CHECK 3.8).
 */

import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { DoubleEntryNotice } from './DoubleEntryNotice';
import { GemiNumberField, type GemiNumberFieldProps } from './GemiNumberField';
import { ShareSumStatus } from './ShareSumStatus';

interface ShareSumTexts {
  readonly sumLabel: string;
  readonly validLabel: string;
  readonly invalidLabel: string;
}

interface CompanyRosterCardProps {
  readonly title: string;
  /** Ειδοποίηση διπλογραφικών — μόνο όπου ισχύει (ΕΠΕ · ΑΕ). */
  readonly notice?: string;
  readonly gemi: GemiNumberFieldProps;
  /** Το πεδίο κεφαλαίου — μόνο όπου υπάρχει (ΕΠΕ · ΑΕ). */
  readonly capital?: ReactNode;
  readonly rows: ReactNode;
  readonly rowCount: number;
  readonly activeShareSum: number;
  readonly shareSumTexts: ShareSumTexts;
  readonly addLabel: string;
  readonly onAdd: () => void;
}

export function CompanyRosterCard({
  title,
  notice,
  gemi,
  capital,
  rows,
  rowCount,
  activeShareSum,
  shareSumTexts,
  addLabel,
  onAdd,
}: CompanyRosterCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice && <DoubleEntryNotice text={notice} />}
        <GemiNumberField {...gemi} />
        {capital}
        <section className="space-y-3">{rows}</section>
        {rowCount > 0 && <ShareSumStatus sum={activeShareSum} {...shareSumTexts} />}
        <Button variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
