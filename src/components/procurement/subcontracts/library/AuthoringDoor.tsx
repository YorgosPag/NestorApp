'use client';

/**
 * **Πόρτα προς τη συγγραφή** — «Νέα ρήτρα» · «Πρότεινε αλλαγή» (ADR-928 §5.22).
 *
 * 🔑 Ο φύλακας είναι ο **ίδιος** με τον γραφέα (`authoringActionBlock`): χωρίς δικαίωμα ⇒ ανενεργό με ορατή αιτία·
 *    ανοιχτή πρόταση ⇒ «αποφάσισε πρώτα για εκείνη»· κρίση σε αναμονή ⇒ ανενεργό **χωρίς** ψευδή αιτία· δεν αφορά ⇒ τίποτα.
 * 🔑 Ενεργή πόρτα = σύνδεσμος (μεσαίο κλικ, «άνοιγμα σε νέα καρτέλα»), όχι κουμπί που πλοηγεί.
 */

import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Link, type WorkspaceHref } from '@/lib/workspace/navigation';
import type { LibraryActionBlock } from '@/subapps/procurement/subcontracts/library/library-action-blocks';

interface AuthoringDoorProps<T extends string> {
  readonly href: WorkspaceHref<T>;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly block: LibraryActionBlock | null;
}

export function AuthoringDoor<T extends string>({ href, label, icon: Icon, block }: AuthoringDoorProps<T>) {
  const { t } = useTranslation('procurement');
  if (block?.kind === 'hidden') return null;
  const content = <><Icon className="mr-1 h-4 w-4" aria-hidden />{label}</>;
  if (block === null) {
    return <Button asChild size="sm" variant="outline"><Link href={href}>{content}</Link></Button>;
  }
  return (
    <span className="flex flex-col gap-0.5">
      <Button type="button" size="sm" variant="outline" disabled>{content}</Button>
      {block.kind === 'explained' && <span className="text-xs text-muted-foreground">{t(`subcontracts.library.reasons.${block.reason}`)}</span>}
    </span>
  );
}
