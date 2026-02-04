import { redirect } from 'next/navigation';
import { APP_ROUTES } from '@/lib/routes';

export default function CrmCustomersPage() {
  redirect(APP_ROUTES.contacts);
}
