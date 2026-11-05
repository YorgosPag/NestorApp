'use client';

/**
 * **Νέα παράμετρος** — από το μενού «Παράμετρος», ή από επιλεγμένο κείμενο («Κάνε το παράμετρο», ADR-928 §5.22).
 *
 * 🔑 Ζητά **μόνο** ό,τι πρέπει να αποφασίσει ο άνθρωπος: ετικέτα + είδος. Το είδος και η τιμή προτείνονται από το
 *    κείμενο (`parameterFromText`: «5%» ⇒ ποσοστό 5%)· ζώνες, δέσιμο, επιλογές ορίζονται μετά στην κάρτα της.
 * 🔑 Το κλειδί γεννιέται από την ετικέτα (`newParameterDefinition`), ποτέ σύγκρουση με όσα υπάρχουν.
 */

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EnumSelect } from '@/components/ui/enum-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { newParameterDefinition } from '@/subapps/procurement/subcontracts/clauses/parameter-definition-edits';
import { parameterFromText } from '@/subapps/procurement/subcontracts/clauses/parameter-from-text';
import { CLAUSE_PARAMETER_KINDS, type ClauseParameterDefinition, type ClauseParameterKind } from '@/subapps/procurement/subcontracts/types/clause-parameter';

export interface NewParameterRequest {
  /** Το επιλεγμένο κείμενο που γίνεται παράμετρος· `null` = νέα παράμετρος στη θέση του δρομέα. */
  readonly selection: string | null;
}

interface NewParameterDialogProps {
  readonly request: NewParameterRequest;
  readonly takenKeys: ReadonlySet<string>;
  readonly onCreate: (definition: ClauseParameterDefinition) => void;
  readonly onClose: () => void;
}

export function NewParameterDialog({ request, takenKeys, onCreate, onClose }: NewParameterDialogProps) {
  const { t } = useTranslation('procurement');
  const labelId = useId();
  const kindId = useId();
  const guess = request.selection === null ? null : parameterFromText(request.selection);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<ClauseParameterKind>(guess?.kind ?? 'percent');
  const missingLabel = label.trim().length === 0;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (missingLabel) return;
    onCreate(newParameterDefinition({ label: label.trim(), kind, preferred: guess?.preferred }, takenKeys));
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t(request.selection === null ? 'subcontracts.library.authoring.newParameter.title' : 'subcontracts.library.authoring.newParameter.fromTextTitle')}</DialogTitle>
            <DialogDescription>
              {request.selection === null
                ? t('subcontracts.library.authoring.newParameter.description')
                : t('subcontracts.library.authoring.newParameter.fromTextDescription', { text: request.selection })}
            </DialogDescription>
          </DialogHeader>
          <span className="flex flex-col gap-1.5">
            <Label htmlFor={labelId}>{t('subcontracts.library.authoring.parameter.label')}</Label>
            <Input id={labelId} value={label} autoFocus onChange={(event) => setLabel(event.target.value)} />
          </span>
          <span className="flex flex-col gap-1.5">
            <Label htmlFor={kindId}>{t('subcontracts.library.authoring.parameter.kind')}</Label>
            <EnumSelect id={kindId} value={kind} values={CLAUSE_PARAMETER_KINDS} onValueChange={setKind} getLabel={(value) => t(`subcontracts.library.authoring.kinds.${value}`)} />
          </span>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('subcontracts.editor.deviations.dialog.cancel')}</Button>
            <Button type="submit" disabled={missingLabel}>{t('subcontracts.library.authoring.newParameter.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
