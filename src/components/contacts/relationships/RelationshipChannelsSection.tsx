// ============================================================================
// RELATIONSHIP CHANNELS SECTION — the relationship's phones/e-mails (ADR-372 §8.5 b1)
// ============================================================================
//
// 🔴 Why it exists (measured live, 2026-11-21): the «Type» of a relationship's channels
// came from the CARD the form was opened on, not from the role holder — a person's lines
// on the ARIES card were offered company types, and a stored `work` showed an EMPTY cell.
// Picking a contact silently copied its channels as a bare string (+30 guessed, `work`
// forced, no extension), kept the PREVIOUS contact's channels, and copied a COMPANY's
// switchboard into a shareholder's relationship.
//
// Now: the owner is the role holder (`formChannelOwner` → codec `relationshipChannelOwnerSide`);
// copying is an explicit action that reads the holder's STRUCTURED channels and replaces
// the rows; a stored type the owner does not offer keeps its label (`typeOptionsWithStored`).
// ============================================================================
'use client';

import React, { useCallback, useId, useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { designSystem } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { createModuleLogger } from '@/lib/telemetry';
import { ContactsService } from '@/services/contacts.service';
import { UniversalCommunicationManager } from '@/components/contacts/dynamic/UniversalCommunicationManager';
import { getEntityAwareCommunicationConfig } from '@/components/contacts/dynamic/communication';
import type { CommunicationItem } from '@/components/contacts/dynamic/communication';
import {
  phonesToCommunicationItems, emailsToCommunicationItems, communicationItemsToPhones, communicationItemsToEmails,
} from '@/components/contacts/dynamic/communication/utils/communication-item-mappers';
import { projectContactInfo } from '@/services/contact-relationships/core/relationship-field-codec';
import type { ContactType } from '@/types/contacts/contracts';
import type { RelationshipFormData } from './types/relationship-manager.types';
import { formChannelOwner } from './hooks/relationship-form-orientation';

const logger = createModuleLogger('RelationshipChannelsSection');

/** Static keys (CHECK 3.13 — resolvable, no template-built key). */
const COPY_NOTICE_KEYS = {
  nothingToCopy: 'relationships.form.channels.nothingToCopy',
  copyFailed: 'relationships.form.channels.copyFailed',
} as const;

type CopyNotice = keyof typeof COPY_NOTICE_KEYS | null;

export interface RelationshipChannelsSectionProps {
  formData: RelationshipFormData;
  setFormData: React.Dispatch<React.SetStateAction<RelationshipFormData>>;
  /** The contact whose card the form is on. */
  currentContactId?: string;
  currentContactType: ContactType;
  disabled?: boolean;
}

export const RelationshipChannelsSection: React.FC<RelationshipChannelsSectionProps> = ({
  formData,
  setFormData,
  currentContactId,
  currentContactType,
  disabled = false,
}) => {
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const [copying, setCopying] = useState(false);
  const [notice, setNotice] = useState<CopyNotice>(null);
  const hintId = useId();

  const owner = useMemo(
    () => formChannelOwner(formData.relationshipType, currentContactType, formData.targetContactType),
    [formData.relationshipType, currentContactType, formData.targetContactType]
  );
  const ownerContactId = owner.side === 'current' ? currentContactId : formData.targetContactId;

  const phoneConfig = useMemo(() => getEntityAwareCommunicationConfig('phone', owner.kind), [owner.kind]);
  const emailConfig = useMemo(() => getEntityAwareCommunicationConfig('email', owner.kind), [owner.kind]);
  const phoneItems = useMemo(() => phonesToCommunicationItems(formData.phones ?? []), [formData.phones]);
  const emailItems = useMemo(() => emailsToCommunicationItems(formData.emails ?? []), [formData.emails]);

  // `contactInfo` is the codec's PROJECTION of the structured rows — one rule (ADR-372 §8.6).
  // A hand edit makes the rows the user's own: a later pick no longer clears them.
  const handlePhonesChange = useCallback((items: CommunicationItem[]) => {
    const phones = communicationItemsToPhones(items, owner.kind);
    setFormData(prev => ({
      ...prev,
      phones,
      channelsCopiedFrom: undefined,
      contactInfo: projectContactInfo(prev.contactInfo, phones, prev.emails ?? []) ?? undefined,
    }));
  }, [setFormData, owner.kind]);

  const handleEmailsChange = useCallback((items: CommunicationItem[]) => {
    const emails = communicationItemsToEmails(items, owner.kind);
    setFormData(prev => ({
      ...prev,
      emails,
      channelsCopiedFrom: undefined,
      contactInfo: projectContactInfo(prev.contactInfo, prev.phones ?? [], emails) ?? undefined,
    }));
  }, [setFormData, owner.kind]);

  const handleCopyFromContact = useCallback(async () => {
    if (!ownerContactId) return;
    setCopying(true);
    setNotice(null);
    try {
      const contact = await ContactsService.getContact(ownerContactId);
      const phones = (contact?.phones ?? []).map(phone => ({ ...phone }));
      const emails = (contact?.emails ?? []).map(email => ({ ...email }));
      if (phones.length === 0 && emails.length === 0) {
        setNotice('nothingToCopy');
        return;
      }
      setFormData(prev => ({
        ...prev,
        phones,
        emails,
        channelsCopiedFrom: ownerContactId,
        contactInfo: projectContactInfo(prev.contactInfo, phones, emails) ?? undefined,
      }));
    } catch (error) {
      logger.error('Copy channels from contact failed', { error, contactId: ownerContactId });
      setNotice('copyFailed');
    } finally {
      setCopying(false);
    }
  }, [ownerContactId, setFormData]);

  return (
    <section className="md:col-span-2 space-y-2" aria-label={t('relationships.form.labels.professionalInfo')}>
      <header className="flex items-center justify-between gap-2">
        <Label className={designSystem.cn(designSystem.getTypographyClass('sm', 'medium'), 'block')}>
          {t('relationships.form.labels.professionalInfo')}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopyFromContact}
          disabled={disabled || copying || !ownerContactId}
          aria-describedby={hintId}
        >
          <Copy className={iconSizes.sm} />
          {t('relationships.form.channels.copyFromContact')}
        </Button>
      </header>
      <p id={hintId} className={designSystem.cn(designSystem.getTypographyClass('xs'), 'text-muted-foreground')}>
        {t('relationships.form.channels.copyHint')}
      </p>
      {notice && (
        <p role="status" className={designSystem.cn(designSystem.getTypographyClass('xs'), designSystem.getStatusColor('warning', 'text'))}>
          {t(COPY_NOTICE_KEYS[notice])}
        </p>
      )}

      <UniversalCommunicationManager config={phoneConfig} items={phoneItems} disabled={disabled} onChange={handlePhonesChange} />
      <UniversalCommunicationManager config={emailConfig} items={emailItems} disabled={disabled} onChange={handleEmailsChange} />
    </section>
  );
};
