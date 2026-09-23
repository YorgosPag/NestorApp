import { APP_ROUTES } from '@/lib/routes';
import { redirect } from '@/lib/workspace/server-navigation';

interface CrmCustomersPageProps {
  readonly params: Promise<{ readonly workspace: string }>;
}

/** ⚠️ Μέσα από το σύνορο του διακομιστή — ο προορισμός μένει στον ΙΔΙΟ χώρο (ADR-875 §11). */
export default async function CrmCustomersPage({ params }: CrmCustomersPageProps) {
  const { workspace } = await params;
  redirect(APP_ROUTES.contacts, workspace);
}
