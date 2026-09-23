/**
 * =============================================================================
 * SETTINGS PAGE - REDIRECT TO ACCOUNT HUB
 * =============================================================================
 *
 * Enterprise Pattern: Legacy URL compatibility
 * Redirects /settings → /account/preferences for backward compatibility
 *
 * ⚠️ Μέσα από το σύνορο του διακομιστή — ο προορισμός μένει στον ΙΔΙΟ χώρο (ADR-875 §11).
 *
 * @module app/settings/page
 * @enterprise ADR-024 - Account Hub Centralization
 */

import { ACCOUNT_ROUTES } from '@/lib/routes';
import { redirect } from '@/lib/workspace/server-navigation';

interface SettingsPageProps {
  readonly params: Promise<{ readonly workspace: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { workspace } = await params;
  redirect(ACCOUNT_ROUTES.preferences, workspace);
}
