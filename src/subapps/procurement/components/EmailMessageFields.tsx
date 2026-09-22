'use client';

/**
 * @fileoverview **SSoT: «Θέμα + Κείμενο» ενός email προς προμηθευτή.**
 * @module subapps/procurement/components/EmailMessageFields
 * @related ADR-598 §3 procurement · ADR-584 (CHECK 3.28) · `ui/form/FormComponents#FormField`
 *
 * Ήταν γραμμένο **τρεις** φορές — πρόσκληση (`VendorInviteDialog`), αίτημα ανανέωσης
 * (`QuoteRenewalRequestDialog`), ειδοποίηση αποτελέσματος (`VendorNotificationDialog`) —
 * και στις τρεις με `<Label>` **χωρίς** σύνδεση με το πεδίο. Το CHECK 3.28 έπιασε δύο ως
 * δίδυμα. Εδώ η σύνδεση γίνεται από το `FormField` (id μέσω `useId`) — δεν ξεχνιέται.
 *
 * Δέχεται **κείμενο, όχι κλειδιά** (δόγμα `hinted-field`): κάθε `t()` μένει στον γονέα.
 */

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form/FormComponents';

export interface EmailMessageFieldsProps {
  readonly subjectLabel: string;
  readonly bodyLabel: string;
  readonly subject: string;
  readonly body: string;
  readonly onSubjectChange: (value: string) => void;
  readonly onBodyChange: (value: string) => void;
  readonly bodyRows?: number;
  readonly disabled?: boolean;
}

export function EmailMessageFields({
  subjectLabel,
  bodyLabel,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  bodyRows = 6,
  disabled = false,
}: EmailMessageFieldsProps) {
  return (
    <div className="space-y-2">
      <FormField label={subjectLabel}>
        {(id) => (
          <Input id={id} value={subject} onChange={(e) => onSubjectChange(e.target.value)} disabled={disabled} className="text-sm" />
        )}
      </FormField>
      <FormField label={bodyLabel}>
        {(id) => (
          <Textarea
            id={id}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            rows={bodyRows}
            disabled={disabled}
            className="resize-none font-mono text-sm"
          />
        )}
      </FormField>
    </div>
  );
}
