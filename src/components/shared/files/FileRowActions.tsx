'use client';
/**
 * @fileoverview **Οι ενέργειες μιας γραμμής αρχείου** — γρήγορα κουμπιά όπου υπάρχει δείκτης, «⋮» παντού.
 * @related ADR-912 §12.14 · `core/entity-headers/entity-action-presets.ts` (`presentEntityActions`, ο ΕΝΑΣ κανόνας) ·
 *   `core/entity-headers/EntityHeaderActions.tsx` (`ActionOverflowMenu`) · `FilesList.tsx` (ο καταναλωτής)
 * @module components/shared/files/FileRowActions
 *
 * 🔴 **Η αφορμή, στιγμιότυπο Giorgio 2026-10-17 (390px)**: ✏️ + κόκκινος 🗑️ σε **κάθε** γραμμή της λίστας. Ο κάδος
 *   βρισκόταν στη ζώνη του αντίχειρα, ένα πάτημα δίπλα στη μετονομασία, και στένευε το όνομα του αρχείου.
 * 🔑 **Drive / Dropbox**: «⋮» σε κάθε γραμμή. Στο web τα γρήγορα κουμπιά εμφανίζονται στο hover, «αν το επιτρέπει η
 *   οθόνη». **Εδώ τα ορίζει η ΔΥΝΑΤΟΤΗΤΑ ΤΗΣ ΣΥΣΚΕΥΗΣ (`hover:hover`), όχι το πλάτος**: ένα tablet αφής δεν έχει hover,
 *   άρα θα είχε κουμπιά που δεν εμφανίζονται ποτέ. Εμφανίζονται επίσης με το πληκτρολόγιο (`focus-within`).
 * 🔑 **Ο κανόνας έμφασης είναι ο ΙΔΙΟΣ με την κεφαλίδα** (`presentEntityActions`): η καταστροφική ζει **μόνο** στο
 *   μενού, τελευταία, κάτω από διαχωριστικό, με χρώμα κινδύνου. Κανένας δεύτερος κανόνας.
 * ⚠️ **Τα γεγονότα του portal ανεβαίνουν στο δέντρο της React**: κλικ σε στοιχείο του μενού θα έφτανε στο `article`
 *   της γραμμής και θα άνοιγε την προεπισκόπηση. Το περιτύλιγμα τα σταματά — click **και** keydown (Enter/Space).
 */
import React from 'react';
import { Link2, Pencil, Unlink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ActionOverflowMenu } from '@/core/entity-headers/EntityHeaderActions';
import { createEntityAction, presentEntityActions } from '@/core/entity-headers/entity-action-presets';
import type { EntityHeaderAction } from '@/core/entity-headers/UnifiedEntityHeaderSystem';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export interface FileRowActionsProps {
  /** Το όνομα του αρχείου — για να λέει το «⋮» **ποιανού** είναι (WCAG 2.4.6). */
  readonly fileName: string;
  readonly onRename?: () => void;
  readonly onLink?: () => void;
  readonly linkLabel: string;
  readonly onUnlink?: () => void;
  readonly unlinkLabel: string;
  readonly onDelete?: () => void;
}

/** Η σειρά δήλωσης είναι η σειρά του μενού· ό,τι δεν προσφέρεται απλώς λείπει. */
function useFileRowActions({ onRename, onLink, linkLabel, onUnlink, unlinkLabel, onDelete }: FileRowActionsProps) {
  const { t } = useTranslation('files');
  return React.useMemo(() => {
    const declared: EntityHeaderAction[] = [];
    if (onRename) declared.push({ label: t('list.renameFile'), icon: Pencil, onClick: onRename, claimsFocus: true });
    if (onLink) declared.push({ label: linkLabel, icon: Link2, onClick: onLink });
    if (onUnlink) declared.push({ label: unlinkLabel, icon: Unlink, onClick: onUnlink });
    if (onDelete) declared.push(createEntityAction('trash', t('list.deleteFile'), onDelete));
    return presentEntityActions(declared);
  }, [onRename, onLink, linkLabel, onUnlink, unlinkLabel, onDelete, t]);
}

/** Εικονίδιο-κουμπί της γραμμής, με ετικέτα για τον αναγνώστη οθόνης και tooltip για τον δείκτη. */
function QuickAction({ action }: { readonly action: EntityHeaderAction }) {
  const iconSizes = useIconSizes();
  const Icon = action.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={action.onClick} aria-label={action.label}>
          {Icon && <Icon className={iconSizes.sm} aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action.label}</TooltipContent>
    </Tooltip>
  );
}

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Η γραμμή που την περιέχει δηλώνει `group` — από αυτήν ανάβουν τα γρήγορα κουμπιά (hover ή εστίαση μέσα της).
 */
export function FileRowActions(props: FileRowActionsProps) {
  const { t } = useTranslation('files');
  const { inline, menuOnly } = useFileRowActions(props);
  if (inline.length === 0 && menuOnly.length === 0) return null;
  return (
    <nav
      className="flex shrink-0 items-center gap-1"
      aria-label={t('list.fileActions')}
      onClick={stop}
      onKeyDown={stop}
    >
      {inline.length > 0 && (
        <span className="hidden items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:hover)]:flex">
          {inline.map((action) => (
            <QuickAction key={action.label} action={action} />
          ))}
        </span>
      )}
      <ActionOverflowMenu
        appearance="row"
        label={`${t('list.fileActions')}: ${props.fileName}`}
        actions={inline}
        destructive={menuOnly}
      />
    </nav>
  );
}
