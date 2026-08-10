import { redirect } from 'next/navigation';
import { ACCOUNT_ROUTES } from '@/lib/routes';

/**
 * Account Hub Root - Redirects to Profile
 *
 * @enterprise ADR-024 - Account Hub Centralization
 */
export default function AccountPage() {
  redirect(ACCOUNT_ROUTES.profile);
}
