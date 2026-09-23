import { ACCOUNT_ROUTES } from '@/lib/routes';
import { redirect } from '@/lib/workspace/server-navigation';

interface AccountPageProps {
  readonly params: Promise<{ readonly workspace: string }>;
}

/**
 * Account Hub Root - Redirects to Profile
 *
 * ⚠️ Μέσα από το σύνορο του διακομιστή: ωμό `/account/profile` θα έπεφτε στο δίχτυ
 * και θα πήγαινε στον χώρο **του θεατή**, όχι σε αυτόν από όπου ήρθε (ADR-875 §11).
 *
 * @enterprise ADR-024 - Account Hub Centralization
 */
export default async function AccountPage({ params }: AccountPageProps) {
  const { workspace } = await params;
  redirect(ACCOUNT_ROUTES.profile, workspace);
}
