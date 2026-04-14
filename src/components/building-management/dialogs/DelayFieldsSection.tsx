'use client';

/**
 * @module DelayFieldsSection
 * @enterprise ADR-266 Phase C — Extracted delay reason/note fields
 *
 * Conditional fields visible when phase/task status is 'delayed' or 'blocked'.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormInput } from '@/components/ui/form/FormComponents';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { DELAY_REASONS } from '@/types/building/construction';
import type { DelayReason } from '@/types/building/construction';

interface DelayFieldsSectionProps {
  delayReason: DelayReason | '';
  delayNote: string;
  onDelayReasonChange: (value: DelayReason) => void;
  onDelayNoteChange: (value: string) => void;
}

export function DelayFieldsSection({
  delayReason,
  delayNote,
  onDelayReasonChange,
  onDelayNoteChange,
}: DelayFieldsSectionProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  return (
    <>
      <FormField
        label={t('tabs.timeline.gantt.dialog.delayReason')}
        htmlFor="construction-delay-reason"
      >
        <FormInput>
          <Select
            value={delayReason}
            onValueChange={(v) => onDelayReasonChange(v as DelayReason)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('tabs.timeline.gantt.dialog.delayReasonPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {DELAY_REASONS.map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {t(`tabs.timeline.gantt.delayReasons.${reason}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormInput>
      </FormField>

      <FormField
        label={t('tabs.timeline.gantt.dialog.delayNote')}
        htmlFor="construction-delay-note"
      >
        <FormInput>
          <Textarea
            id="construction-delay-note"
            value={delayNote}
            onChange={(e) => onDelayNoteChange(e.target.value)}
            placeholder={t('tabs.timeline.gantt.dialog.delayNotePlaceholder')}
            rows={2}
          />
        </FormInput>
      </FormField>
    </>
  );
}
