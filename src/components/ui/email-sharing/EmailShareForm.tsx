'use client';

/**
 * @fileoverview Email Share Form — recipients, message, template selection.
 * Uses centralized email API via ShareModal's handleEmailShare.
 */

import React, { useState, useCallback } from 'react';
import { ArrowLeft, Plus, Send, X, Home, Briefcase, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { isValidEmail } from '@/lib/validation/email-validation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import type { EmailTemplateType } from '@/types/email-templates';

import type { EmailShareData, ShareData } from './types';

export type { EmailShareData, ShareData };

const MAX_RECIPIENTS = 5;
const MAX_MESSAGE_LENGTH = 500;

const TEMPLATES: { id: EmailTemplateType; icon: typeof Home; color: string }[] = [
  { id: 'residential', icon: Home, color: 'from-orange-400 to-red-500' },
  { id: 'commercial', icon: Briefcase, color: 'from-blue-500 to-indigo-600' },
  { id: 'premium', icon: Crown, color: 'from-amber-400 to-orange-500' },
];

export interface EmailShareFormProps {
  shareData: ShareData;
  onEmailShare: (data: EmailShareData) => Promise<void> | void;
  onBack?: () => void;
  loading?: boolean;
}

export const EmailShareForm: React.FC<EmailShareFormProps> = ({
  shareData,
  onEmailShare,
  onBack,
  loading = false,
}) => {
  const { t } = useTranslation('common');

  const [recipients, setRecipients] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [templateType, setTemplateType] = useState<EmailTemplateType>('residential');
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const addRecipient = useCallback(() => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;

    if (!isValidEmail(trimmed)) {
      setError(t('emailShare.invalidEmail'));
      return;
    }
    if (recipients.length >= MAX_RECIPIENTS) {
      setError(t('emailShare.maxRecipients', { max: MAX_RECIPIENTS }));
      return;
    }
    if (recipients.includes(trimmed)) {
      setError(t('emailShare.invalidEmail'));
      return;
    }

    setRecipients(prev => [...prev, trimmed]);
    setEmailInput('');
    setError(null);
  }, [emailInput, recipients, t]);

  const removeRecipient = useCallback((index: number) => {
    setRecipients(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRecipient();
    }
  }, [addRecipient]);

  const handleSubmit = useCallback(async () => {
    if (recipients.length === 0) {
      setError(t('emailShare.noRecipients'));
      return;
    }
    setSubmitError(null);
    try {
      await onEmailShare({
        recipients,
        personalMessage: personalMessage || undefined,
        templateType,
        propertyTitle: shareData.title,
        propertyDescription: shareData.text,
        propertyUrl: shareData.url,
      });
    } catch {
      setSubmitError(t('emailShare.sendError'));
    }
  }, [recipients, personalMessage, templateType, shareData, onEmailShare, t]);

  const charsRemaining = MAX_MESSAGE_LENGTH - personalMessage.length;

  return (
    <section className="space-y-4">
      {/* Recipients */}
      <fieldset>
        <label className="text-sm font-medium mb-1.5 block">
          {t('emailShare.recipientLabel')}
        </label>
        <div className="flex gap-2">
          <Input
            type="email"
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder={t('emailShare.recipientPlaceholder')}
            disabled={loading}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRecipient}
            disabled={loading || !emailInput.trim()}
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('emailShare.addRecipient')}
          </Button>
        </div>

        {/* Recipient chips */}
        {recipients.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-2">
            {recipients.map((email, i) => (
              <li
                key={email}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-sm"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(i)}
                  className="hover:text-destructive transition-colors"
                  aria-label={t('emailShare.removeRecipient')}
                  disabled={loading}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-destructive mt-1">{error}</p>}
      </fieldset>

      {/* Personal message */}
      <fieldset>
        <label className="text-sm font-medium mb-1.5 block">
          {t('emailShare.messageLabel')}
        </label>
        <Textarea
          value={personalMessage}
          onChange={e => setPersonalMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          placeholder={t('emailShare.messagePlaceholder')}
          disabled={loading}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">
          {t('emailShare.charsRemaining', { count: charsRemaining })}
        </p>
      </fieldset>

      {/* Template selector */}
      <fieldset>
        <label className="text-sm font-medium mb-1.5 block">
          {t('emailShare.templateLabel')}
        </label>
        <nav className="flex gap-2">
          {TEMPLATES.map(tmpl => {
            const Icon = tmpl.icon;
            const isSelected = templateType === tmpl.id;
            const templateKey = `template${tmpl.id.charAt(0).toUpperCase()}${tmpl.id.slice(1)}` as
              'templateResidential' | 'templateCommercial' | 'templatePremium';
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setTemplateType(tmpl.id)}
                disabled={loading}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-3 rounded-lg border-2 transition-all',
                  isSelected
                    ? `border-primary bg-gradient-to-br ${tmpl.color} text-white`
                    : 'border-border hover:border-primary/50'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">
                  {t(`emailShare.${templateKey}`)}
                </span>
              </button>
            );
          })}
        </nav>
      </fieldset>

      {/* Submit error */}
      {submitError && (
        <p className="text-sm text-destructive text-center">{submitError}</p>
      )}

      {/* Actions */}
      <footer className="flex gap-2 pt-2">
        {onBack && (
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={loading}
            className="flex-1"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t('emailShare.back')}
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={loading || recipients.length === 0}
          className="flex-1"
        >
          <Send className="w-4 h-4 mr-1" />
          {loading ? t('emailShare.sending') : t('emailShare.send')}
        </Button>
      </footer>
    </section>
  );
};

export default EmailShareForm;
