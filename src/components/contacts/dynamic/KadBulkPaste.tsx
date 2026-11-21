'use client';

/**
 * @fileoverview **«Επικόλληση λίστας ΓΕΜΗ»** — μαζική προσθήκη δευτερευόντων ΚΑΔ από κείμενο.
 * @related lib/kad/kad-list-paste.ts (ο κανόνας) · components/contacts/dynamic/ContactKadSection.tsx
 *
 * Επικόλληση → επίλυση όλων → προεπισκόπηση (✓ με περιγραφή · ✗ άγνωστος · διπλός / κύριος παραλείπεται)
 * → μόνο η ρητή επιβεβαίωση προσθέτει. Τίποτα δεν γράφεται πριν πατηθεί το κουμπί.
 */

import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useKadOptions } from '@/hooks/useKadOptions';
import { planKadListPaste, type KadPasteItem, type KadPasteStatus } from '@/lib/kad/kad-list-paste';
import { toKadSelection } from '@/lib/kad/kad-resolve';
import type { KadSelection } from '@/lib/kad/kad-types';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface KadBulkPasteProps {
  readonly primaryCode: string;
  readonly secondaryCodes: readonly string[];
  readonly onConfirm: (selections: KadSelection[]) => void;
  readonly onCancel: () => void;
}

/** Κατάσταση → κείμενο, με ΚΥΡΙΟΛΕΚΤΙΚΑ κλειδιά (ορατά στους ελέγχους i18n). */
function useStatusText(): (status: KadPasteStatus) => string {
  const { t } = useTranslation('forms');
  return (status) => {
    switch (status) {
      case 'add':
        return t('kad.bulk.statusAdd');
      case 'unresolved':
        return t('kad.bulk.statusUnresolved');
      case 'duplicate':
        return t('kad.bulk.statusDuplicate');
      case 'primary':
        return t('kad.bulk.statusPrimary');
    }
  };
}

function PreviewRow({ item }: { readonly item: KadPasteItem }) {
  const statusText = useStatusText();
  const colors = useSemanticColors();
  const ok = item.status === 'add';
  const Icon = item.status === 'unresolved' ? X : Check;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 h-4 w-4 shrink-0', ok ? colors.text.success : colors.text.muted)}
      />
      <span className={cn(!ok && colors.text.muted)}>
        <strong className="font-medium">{item.entry?.code ?? item.raw}</strong>
        {item.entry && <> — {item.entry.description}</>}
        <span className="block text-xs">{statusText(item.status)}</span>
      </span>
    </li>
  );
}

export function KadBulkPaste({ primaryCode, secondaryCodes, onConfirm, onCancel }: KadBulkPasteProps) {
  const { t } = useTranslation('forms');
  const colors = useSemanticColors();
  const inputId = useId();
  const headingId = useId();
  const { catalog, isLoading } = useKadOptions();
  const [text, setText] = useState('');

  const plan = useMemo(
    () => planKadListPaste(catalog, text, { primaryCode, secondaryCodes }),
    [catalog, text, primaryCode, secondaryCodes],
  );
  const toAdd = plan.flatMap((item) => (item.status === 'add' && item.entry ? [toKadSelection(item.entry)] : []));

  return (
    <section aria-labelledby={headingId} className="mb-3 space-y-3 rounded-md border p-3">
      <h4 id={headingId} className="text-sm font-semibold text-foreground">
        {t('kad.bulk.title')}
      </h4>
      <Label htmlFor={inputId}>{t('kad.bulk.inputLabel')}</Label>
      <Textarea id={inputId} value={text} onChange={(e) => setText(e.target.value)} rows={4} disabled={isLoading} />
      {text.trim() !== '' && (
        <section aria-label={t('kad.bulk.previewTitle')}>
          {plan.length === 0 ? (
            <p className={cn('text-sm', colors.text.muted)}>{t('kad.bulk.empty')}</p>
          ) : (
            <ul className="space-y-1">
              {plan.map((item, index) => (
                <PreviewRow key={`${item.raw}-${index}`} item={item} />
              ))}
            </ul>
          )}
        </section>
      )}
      <footer className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('kad.bulk.cancel')}
        </Button>
        <Button type="button" size="sm" disabled={toAdd.length === 0} onClick={() => onConfirm(toAdd)}>
          {t('kad.bulk.confirm', { count: toAdd.length })}
        </Button>
      </footer>
    </section>
  );
}

export default KadBulkPaste;
