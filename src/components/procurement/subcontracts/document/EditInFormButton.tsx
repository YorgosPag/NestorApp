'use client';

/**
 * **Από το έγγραφο στη φόρμα** (ADR-928 §5.23) — μολύβι δίπλα σε κάθε ενότητα και ρήτρα της ζωντανής προεπισκόπησης:
 * ανοίγει την καρτέλα της ενότητας (και τη ρήτρα), όπως το κλικ στον καμβά του Figma επιλέγει στρώση στο πάνελ.
 *
 * 🔑 Κουμπί, όχι κλικ σε όλο το κείμενο: στο έγγραφο ο άνθρωπος **επιλέγει κείμενο** για αντιγραφή — ένα κλικ που σε
 *    πετά αλλού θα το έκανε αδύνατο. Φαίνεται στο hover/εστίαση της ενότητας και είναι πάντα προσβάσιμο με Tab.
 * 🔑 Δεν τυπώνεται: υπάρχει μόνο όταν ο καταναλωτής δώσει `onEdit` (επεξεργαστής), ποτέ στην ανάγνωση ή στο PDF.
 */

import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { EditorSection } from '../editor/editor-sections';

export interface DocumentEditTarget {
  readonly section: EditorSection;
  /** Μόνο για ρήτρα: ποια κάρτα ρήτρας να φανεί. */
  readonly clauseKey?: string;
}

export type DocumentEditHandler = (target: DocumentEditTarget) => void;

interface EditInFormButtonProps {
  readonly target: DocumentEditTarget;
  /** Το όνομα της ενότητας/ρήτρας όπως γράφεται στο έγγραφο — για την ετικέτα προσβασιμότητας. */
  readonly label: string;
  readonly onEdit: DocumentEditHandler;
}

export function EditInFormButton({ target, label, onEdit }: EditInFormButtonProps) {
  const { t } = useTranslation('procurement');
  const text = t('subcontracts.editor.preview.editInForm', { section: label });
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={text}
      className="h-6 w-6 shrink-0 normal-case opacity-0 focus-visible:opacity-100 group-hover/doc-section:opacity-100 group-focus-within/doc-section:opacity-100"
      onClick={() => onEdit(target)}
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );
}
