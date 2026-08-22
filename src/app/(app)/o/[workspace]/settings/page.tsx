/**
 * =============================================================================
 * SETTINGS PAGE - REDIRECT TO ACCOUNT HUB
 * =============================================================================
 *
 * Enterprise Pattern: Legacy URL compatibility
 * Redirects /settings → /account/preferences for backward compatibility
 *
 * @module app/settings/page
 * @enterprise ADR-024 - Account Hub Centralization
 */

import { redirect } from 'next/navigation';
import { ACCOUNT_ROUTES } from '@/lib/routes';

export default function SettingsPage() {
  redirect(ACCOUNT_ROUTES.preferences);
}
