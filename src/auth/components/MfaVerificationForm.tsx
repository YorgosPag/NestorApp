/**
 * 📄 MFA VERIFICATION FORM — Two-factor authentication code entry
 *
 * Enterprise 2FA verification screen rendered when MFA is required.
 * Extracted from AuthForm (Google SRP).
 */

'use client';

import '@/lib/design-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Lock } from 'lucide-react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AuthScreen } from './AuthScreenChrome';
import { AuthField } from './AuthField';

interface MfaVerificationFormProps {
  mfaCode: string;
  onMfaCodeChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isLoading: boolean;
  displayError: string | null;
  successMessage: string | null;
}

export function MfaVerificationForm({
  mfaCode,
  onMfaCodeChange,
  onSubmit,
  onCancel,
  isLoading,
  displayError,
  successMessage,
}: MfaVerificationFormProps) {
  // 🔴 ADR-744 §18 — το `t` ΕΡΧΟΤΑΝ ΩΣ PROP από το `AuthForm`, δηλαδή αυτό το αρχείο
  // δήλωνε ΜΗΔΕΝ namespace και τα **16** κλειδιά του (`mfa.*`) έπεφταν σιωπηλά έξω
  // από κάθε slice. Το prop έφυγε: κανείς δεν περνάει πια μεταφραστή.
  const { t } = useTranslation('auth');
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const layout = useLayoutClasses();

  return (
    <AuthScreen title={t('mfa.title')} description={t('mfa.description')}>
      <CardContent>
            <form onSubmit={onSubmit} className={layout.flexColGap4}>
              {displayError && (
                <Alert variant="destructive">
                  <AlertDescription>{displayError}</AlertDescription>
                </Alert>
              )}

              {successMessage && (
                <Alert className={`${getStatusBorder('success')} ${colors.bg.success}`}>
                  <AlertDescription className={colors.text.success}>
                    {successMessage}
                  </AlertDescription>
                </Alert>
              )}

              <AuthField
                id="mfaCode"
                label={t('mfa.codeLabel')}
                icon={Lock}
                hint={t('mfa.codeHint')}
              >
                <Input
                  id="mfaCode"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder={t('mfa.codePlaceholder')}
                  value={mfaCode}
                  onChange={(e) => onMfaCodeChange(e.target.value.replace(/\D/g, ''))}
                  disabled={isLoading}
                  hasLeftIcon
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
              </AuthField>

              <Button type="submit" className={layout.widthFull} disabled={isLoading}>
                {isLoading && <Spinner size="small" className={layout.buttonIconSpacing} />}
                {t('mfa.verifyButton')}
              </Button>

              <Button
                type="button"
                variant="outline"
                className={layout.widthFull}
                onClick={onCancel}
                disabled={isLoading}
              >
                {t('mfa.cancelButton')}
              </Button>
            </form>
      </CardContent>
    </AuthScreen>
  );
}
