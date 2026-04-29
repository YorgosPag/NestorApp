/**
 * =============================================================================
 * VendorInviteDialog — single-dialog 2-step vendor invite flow (ADR-327 Phase H.2)
 * =============================================================================
 *
 * Replaces the previous 2-modal sequence (InviteModal → UnifiedShareDialog) with
 * a single `<Dialog>` that switches between two internal steps:
 *
 *   step "form"   → choose recipient (Manual email | From contacts) + expiry
 *   step "share"  → after createVendorInvite() — UserAuthPermissionPanel
 *                   (social platform grid + copy + email)
 *
 * The HMAC portal token is generated lazily — only when the user clicks the
 * "Δημιουργία Πρόσκλησης" button — so the email entered manually is bound to
 * the invite document at creation time.
 *
 * @module subapps/procurement/components/VendorInviteDialog
 * @see ADR-327 §17 Phase H.2
 */

'use client';

import { useCallback, useState, useRef } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox-types';
import { UserAuthPermissionPanel } from '@/components/ui/sharing/panels/UserAuthPermissionPanel';
import type { CreateInviteInput } from '../hooks/useVendorInvites';

// ============================================================================
// PROPS
// ============================================================================

type RecipientMode = 'manual' | 'contacts';
type Step = 'form' | 'share';

interface CreateInviteResult {
  inviteId: string;
  portalUrl: string;
  delivery: { success: boolean; errorReason: string | null };
}

export interface VendorInviteDialogProps {
  rfqId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorContacts: ComboboxOption[];
  contactsLoading: boolean;
  onCreate: (dto: CreateInviteInput) => Promise<CreateInviteResult>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ============================================================================
// COMPONENT
// ============================================================================

export function VendorInviteDialog({
  rfqId,
  open,
  onOpenChange,
  vendorContacts,
  contactsLoading,
  onCreate,
}: VendorInviteDialogProps) {
  const { t } = useTranslation('quotes');

  const [step, setStep] = useState<Step>('form');
  const [mode, setMode] = useState<RecipientMode>('contacts');
  const [vendorId, setVendorId] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<CreateInviteResult | null>(null);

  const reset = useCallback(() => {
    setStep('form');
    setMode('contacts');
    setVendorId('');
    setManualEmail('');
    setManualName('');
    setExpiresInDays(7);
    setError(null);
    setSubmitting(false);
    setCreatedInvite(null);
  }, []);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(reset, 200);
  }, [onOpenChange, reset]);

  const validate = useCallback((): string | null => {
    if (mode === 'contacts') {
      if (!vendorId) return t('invites.errors.noVendorSelected');
      return null;
    }
    const email = manualEmail.trim();
    const name = manualName.trim();
    if (!email) return t('invites.errors.noEmailEntered');
    if (!EMAIL_REGEX.test(email)) return t('invites.errors.invalidEmail');
    if (!name) return t('invites.errors.noNameEntered');
    return null;
  }, [mode, vendorId, manualEmail, manualName, t]);

  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setSubmitting(true);
    setError(null);
    try {
      const dto: CreateInviteInput =
        mode === 'contacts'
          ? { vendorContactId: vendorId, deliveryChannel: 'copy_link', expiresInDays }
          : {
              manualEmail: manualEmail.trim(),
              manualName: manualName.trim(),
              deliveryChannel: 'copy_link',
              expiresInDays,
            };
      const result = await onCreate(dto);
      setCreatedInvite(result);
      setStep('share');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('invites.errors.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [validate, mode, vendorId, manualEmail, manualName, expiresInDays, onCreate, t]);

  const handleEmailResend = useCallback(async () => {
    if (!createdInvite) return;
    const res = await fetch(`/api/rfqs/${rfqId}/invites/${createdInvite.inviteId}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const json = await res.json() as { error?: string };
      throw new Error(json?.error ?? `HTTP ${res.status}`);
    }
  }, [rfqId, createdInvite]);

  const dialogTitle =
    step === 'form' ? t('invites.dialog.title') : t('invites.dialog.shareTitle');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        {step === 'form' ? (
          <FormStep
            mode={mode}
            onModeChange={setMode}
            vendorId={vendorId}
            onVendorIdChange={setVendorId}
            vendorContacts={vendorContacts}
            contactsLoading={contactsLoading}
            manualEmail={manualEmail}
            onManualEmailChange={setManualEmail}
            manualName={manualName}
            onManualNameChange={setManualName}
            expiresInDays={expiresInDays}
            onExpiresChange={setExpiresInDays}
            error={error}
            submitting={submitting}
            onCancel={handleClose}
            onSubmit={handleSubmit}
          />
        ) : (
          createdInvite && (
            <ShareStep
              portalUrl={createdInvite.portalUrl}
              recipientLabel={mode === 'contacts'
                ? (vendorContacts.find((c) => c.value === vendorId)?.label ?? '')
                : manualName}
              isOpen={open}
              onClose={handleClose}
              onEmailSend={handleEmailResend}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// FORM STEP
// ============================================================================

interface FormStepProps {
  mode: RecipientMode;
  onModeChange: (mode: RecipientMode) => void;
  vendorId: string;
  onVendorIdChange: (id: string) => void;
  vendorContacts: ComboboxOption[];
  contactsLoading: boolean;
  manualEmail: string;
  onManualEmailChange: (email: string) => void;
  manualName: string;
  onManualNameChange: (name: string) => void;
  expiresInDays: number;
  onExpiresChange: (days: number) => void;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function FormStep({
  mode, onModeChange,
  vendorId, onVendorIdChange, vendorContacts, contactsLoading,
  manualEmail, onManualEmailChange, manualName, onManualNameChange,
  expiresInDays, onExpiresChange,
  error, submitting, onCancel, onSubmit,
}: FormStepProps) {
  const { t } = useTranslation('quotes');

  return (
    <section className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as RecipientMode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="contacts">{t('invites.dialog.tabs.contacts')}</TabsTrigger>
          <TabsTrigger value="manual">{t('invites.dialog.tabs.manual')}</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-1.5 pt-3">
          <label className="text-sm font-medium">{t('invites.dialog.contacts.label')}</label>
          <SearchableCombobox
            value={vendorId}
            onValueChange={onVendorIdChange}
            options={vendorContacts}
            placeholder={t('invites.dialog.contacts.placeholder')}
            emptyMessage={t('invites.dialog.contacts.empty')}
            isLoading={contactsLoading}
          />
        </TabsContent>

        <TabsContent value="manual" className="space-y-3 pt-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="vendor-invite-email">
              {t('invites.dialog.manual.emailLabel')}
            </label>
            <Input
              id="vendor-invite-email"
              type="email"
              value={manualEmail}
              onChange={(e) => onManualEmailChange(e.target.value)}
              placeholder={t('invites.dialog.manual.emailPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="vendor-invite-name">
              {t('invites.dialog.manual.nameLabel')}
            </label>
            <Input
              id="vendor-invite-name"
              type="text"
              value={manualName}
              onChange={(e) => onManualNameChange(e.target.value)}
              placeholder={t('invites.dialog.manual.namePlaceholder')}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="vendor-invite-expires">
          {t('invites.dialog.expiresLabel')}
        </label>
        <Input
          id="vendor-invite-expires"
          type="number"
          min={1}
          max={90}
          value={expiresInDays}
          onChange={(e) => onExpiresChange(Number(e.target.value))}
          className="w-24"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          {t('invites.dialog.cancel')}
        </Button>
        <Button onClick={onSubmit} disabled={submitting}>
          {submitting ? t('invites.dialog.creating') : t('invites.dialog.create')}
        </Button>
      </DialogFooter>
    </section>
  );
}

// ============================================================================
// SHARE STEP
// ============================================================================

interface ShareStepProps {
  portalUrl: string;
  recipientLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onEmailSend: () => Promise<void>;
}

function ShareStep({ portalUrl, recipientLabel, isOpen, onClose, onEmailSend }: ShareStepProps) {
  const { t } = useTranslation('quotes');
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const sentRef = useRef(false);

  const handleEmailSend = useCallback(async () => {
    if (sentRef.current) return;
    sentRef.current = true;
    setEmailState('sending');
    try {
      await onEmailSend();
      setEmailState('sent');
    } catch {
      sentRef.current = false;
      setEmailState('idle');
    }
  }, [onEmailSend]);

  const emailLabel =
    emailState === 'sending'
      ? t('invites.dialog.sendingEmail')
      : emailState === 'sent'
        ? t('invites.dialog.emailSent')
        : t('invites.dialog.sendEmail', { name: recipientLabel });

  const emailButton = (
    <Button
      type="button"
      className="w-full h-12"
      onClick={handleEmailSend}
      disabled={emailState !== 'idle'}
    >
      {emailLabel}
    </Button>
  );

  return (
    <section className="space-y-4">
      <UserAuthPermissionPanel
        shareData={{
          title: recipientLabel || t('invites.dialog.shareTitle'),
          text: '',
          url: portalUrl,
        }}
        isOpen={isOpen}
        onClose={onClose}
        hideChannelPicker
        extraQuickActions={emailButton}
      />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('invites.dialog.close')}
        </Button>
      </DialogFooter>
    </section>
  );
}
