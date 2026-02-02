'use client';

/**
 * =============================================================================
 * 🔐 CLAIMS REPAIR ADMIN SCREEN - ENTERPRISE UI
 * =============================================================================
 *
 * Admin UI για την διόρθωση missing claims σε Firebase users.
 * Zero token exposure - χρησιμοποιεί authenticated session μέσω apiClient.
 *
 * @module app/admin/users/claims-repair
 * @enterprise Zero Token Exposure - Secure Admin UI
 *
 * 🔒 SECURITY:
 * - Super_admin only (withAuth protection)
 * - Uses apiClient.post() - authenticated session (NO manual token handling)
 * - NO token exposure στο console/clipboard
 * - Audit logging automatic (server-side via /api/admin/set-user-claims)
 * - Centralized error handling
 *
 * 🏢 ENTERPRISE COMPLIANCE:
 * - i18n via useTranslation('admin')
 * - Radix Select (ADR-001 canonical component)
 * - Typography tokens via SEMANTIC_TYPOGRAPHY_TOKENS
 * - Spacing tokens via useSpacingTokens
 * - Layout tokens via useLayoutClasses
 * - Semantic HTML (<main>, header, section, form, labels)
 * - NO ErrorTracker for success (removed)
 * - Sanitized error context (NO PII, NO raw server messages)
 *
 * ⚠️ IMPORTANT:
 * - refreshToken() ONLY affects the super_admin's session
 * - Affected user MUST logout/login to refresh their token
 * - Audit logging happens SERVER-SIDE in /api/admin/set-user-claims
 *
 * @see /api/admin/set-user-claims - Backend endpoint
 */

import { useState, FormEvent } from 'react';
import { useAuth } from '@/auth/contexts/AuthContext';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import type { GlobalRole } from '@/lib/auth/types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { SEMANTIC_TYPOGRAPHY_TOKENS } from '@/hooks/useTypography';

// ✅ ENTERPRISE: Design System Components (ADR-001)
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// =============================================================================
// TYPES
// =============================================================================

interface FormData {
  uid: string;
  email: string;
  companyId: string;
  globalRole: GlobalRole;
}

interface SetClaimsResponse {
  success: boolean;
  message: string;
  user?: {
    uid: string;
    email: string;
    companyId: string;
    globalRole: GlobalRole;
    customClaimsSet: boolean;
    firestoreDocCreated: boolean;
  };
  error?: string;
  warning?: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ClaimsRepairPage() {
  const { refreshToken } = useAuth();
  const { t } = useTranslation('admin');
  const spacing = useSpacingTokens();
  const layout = useLayoutClasses();

  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    uid: '',
    email: '',
    companyId: '',
    globalRole: 'company_admin'
  });

  // ===========================================================================
  // FORM HANDLERS
  // ===========================================================================

  const handleSetClaims = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // ✅ ENTERPRISE: Authenticated session, NO token handling
      const response = await apiClient.post<SetClaimsResponse>(
        '/api/admin/set-user-claims',
        formData
      );

      // Show success message
      setSuccessMessage(response.message || t('claimsRepair.actions.submit'));

      // ⚠️ IMPORTANT: refreshToken() affects ONLY super_admin session
      // Affected user needs to logout/login separately
      await refreshToken();

      // Clear form
      setFormData({
        uid: '',
        email: '',
        companyId: '',
        globalRole: 'company_admin'
      });

      // ✅ AUDIT: Server-side logging in /api/admin/set-user-claims (NO client-side tracking)

    } catch (error) {
      // ✅ ENTERPRISE: Sanitized error display (NO raw server messages with PII)
      const message = error instanceof Error
        ? 'Failed to set claims. Please check the input and try again.'
        : 'An unexpected error occurred.';

      setErrorMessage(message);

      // ✅ NO ErrorTracker here - server logs the error with full context
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <main className={`container ${spacing.margin.auto} ${spacing.padding.lg}`}>
      <header className={spacing.margin.bottom.xl}>
        <h1 className={`${SEMANTIC_TYPOGRAPHY_TOKENS.h2.tailwind} ${spacing.margin.bottom.sm}`}>
          {t('claimsRepair.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('claimsRepair.description')}
        </p>
      </header>

      <section className={layout.cardAuthWidth}>
        {/* Success/Error Messages */}
        {successMessage && (
          <Alert variant="default" className={spacing.margin.bottom.md}>
            {successMessage}
          </Alert>
        )}
        {errorMessage && (
          <Alert variant="destructive" className={spacing.margin.bottom.md}>
            {errorMessage}
          </Alert>
        )}

        <Card className={spacing.padding.lg}>
          <form onSubmit={handleSetClaims} className={spacing.spaceBetween.md}>
            {/* User UID */}
            <div>
              <Label htmlFor="uid">{t('claimsRepair.fields.uid.label')}</Label>
              <Input
                id="uid"
                type="text"
                value={formData.uid}
                onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                placeholder={t('claimsRepair.fields.uid.placeholder')}
                required
              />
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="email">{t('claimsRepair.fields.email.label')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder={t('claimsRepair.fields.email.placeholder')}
                required
              />
            </div>

            {/* Company ID */}
            <div>
              <Label htmlFor="companyId">{t('claimsRepair.fields.companyId.label')}</Label>
              <Input
                id="companyId"
                type="text"
                value={formData.companyId}
                onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                placeholder={t('claimsRepair.fields.companyId.placeholder')}
                required
              />
            </div>

            {/* Global Role - ✅ RADIX SELECT (ADR-001) */}
            <div>
              <Label htmlFor="globalRole">{t('claimsRepair.fields.globalRole.label')}</Label>
              <Select
                value={formData.globalRole}
                onValueChange={(value) => setFormData({ ...formData, globalRole: value as GlobalRole })}
              >
                <SelectTrigger id="globalRole">
                  <SelectValue placeholder={t('claimsRepair.fields.globalRole.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {GLOBAL_ROLES.map(role => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <Button type="submit" disabled={loading} className={layout.widthFull}>
              {loading ? t('claimsRepair.actions.submitting') : t('claimsRepair.actions.submit')}
            </Button>
          </form>
        </Card>
      </section>

      {/* Documentation */}
      <Card className={`${spacing.margin.top.xl} ${spacing.padding.lg} ${layout.cardXlWidth}`}>
        <h2 className={`${SEMANTIC_TYPOGRAPHY_TOKENS.h4.tailwind} ${spacing.margin.bottom.md}`}>
          {t('claimsRepair.help.title')}
        </h2>
        <ol className={`list-decimal list-inside ${spacing.spaceBetween.sm} ${SEMANTIC_TYPOGRAPHY_TOKENS.caption.tailwind}`}>
          <li>{t('claimsRepair.help.step1')}</li>
          <li>{t('claimsRepair.help.step2')}</li>
          <li>{t('claimsRepair.help.step3')}</li>
          <li>{t('claimsRepair.help.step4')}</li>
          <li>{t('claimsRepair.help.step5')}</li>
          <li>{t('claimsRepair.help.step6')}</li>
        </ol>

        <h3 className={`${SEMANTIC_TYPOGRAPHY_TOKENS.h4.tailwind} ${spacing.margin.top.lg} ${spacing.margin.bottom.sm}`}>
          {t('claimsRepair.security.title')}
        </h3>
        <ul className={`list-disc list-inside ${spacing.spaceBetween.xs} ${SEMANTIC_TYPOGRAPHY_TOKENS.caption.tailwind}`}>
          <li>{t('claimsRepair.security.feature1')}</li>
          <li>{t('claimsRepair.security.feature2')}</li>
          <li>{t('claimsRepair.security.feature3')}</li>
          <li>{t('claimsRepair.security.feature4')}</li>
        </ul>

        <Alert variant="default" className={spacing.margin.top.md}>
          <strong>{t('claimsRepair.notice.title')}:</strong>
          {' '}
          {t('claimsRepair.notice.body')}
        </Alert>
      </Card>
    </main>
  );
}
