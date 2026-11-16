/**
 * @fileoverview **Η όψη της απόστασης από μια ημερομηνία** — εικονίδιο + σήμα ανά βαθμίδα (Procore: Overdue κόκκινο ·
 *   σήμερα/σύντομα κίτρινο · εντός γκρι). Ποτέ μόνο χρώμα: η λέξη τη δίνει ο καταναλωτής (CHECK 3.41).
 * @related lib/document-validity/issuance-delivery-due.ts (`issuanceLatenessOf` — η μία αριθμητική ημερών) ·
 *   components/document-registry/RegistryIssuanceDeliveryCell.tsx (μητρώο) ·
 *   components/conveyance/my-cases/MyOpenItemsSection.tsx («Οι εκκρεμότητές μου», ADR-915 §45.19)
 * @module components/shared/due-countdown-look
 *
 * ⚠️ **Χωρίς κείμενα, επίτηδες** (CHECK 3.34): ζούσε μέσα στο `issuance-delivery-labels.ts`, που κουβαλά κυριολεκτικά
 *    κλειδιά `document-registry:` — όποια σελίδα το εισήγαγε για την όψη θα έσερνε όλο εκείνο το λεξιλόγιο στο slice της.
 * 🔑 `Record<Ρίζα, …>` (CHECK 3.73): νέα βαθμίδα δεν μεταγλωττίζεται χωρίς όψη.
 */

import { CalendarCheck2, CalendarClock, CalendarX2, CalendarOff, type LucideIcon } from 'lucide-react';

import type { BadgeVariantProps } from '@/components/ui/badge';
import type { IssuanceLatenessTier } from '@/lib/document-validity/issuance-delivery-due';

export const DUE_COUNTDOWN_LOOK: Readonly<Record<IssuanceLatenessTier, { readonly icon: LucideIcon; readonly badge: NonNullable<BadgeVariantProps['variant']> }>> = {
  overdue: { icon: CalendarX2, badge: 'error' },
  'due-today': { icon: CalendarClock, badge: 'warning' },
  'due-soon': { icon: CalendarClock, badge: 'warning' },
  'on-track': { icon: CalendarCheck2, badge: 'muted' },
  'no-due-date': { icon: CalendarOff, badge: 'outline' },
};
