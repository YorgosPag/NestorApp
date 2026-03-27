import {
  Users, Building2, Landmark, Activity, Calendar,
  Star, Briefcase, TrendingUp,
} from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { normalizeToDate } from '@/lib/date-local';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { TFunction } from 'i18next';

/**
 * Compute the 8-card dashboard stats for the contacts page.
 *
 * Pure function — called from useMemo inside useContactsPageState.
 */
export function buildContactDashboardStats(
  contacts: Contact[],
  t: TFunction,
): DashboardStat[] {
  return [
    { title: t('page.dashboard.totalContacts'), value: contacts.length, icon: Users, color: 'blue' },
    {
      title: t('page.dashboard.totalPersonnel'),
      value: contacts.filter(c => c.type === 'individual').length,
      icon: Briefcase,
      color: 'green',
    },
    {
      title: t('page.dashboard.legalEntities'),
      value: contacts.filter(c => c.type === 'company').length,
      icon: Building2,
      color: 'purple',
    },
    {
      title: t('page.dashboard.activeContacts'),
      value: contacts.filter((c: Contact & { status?: string }) => c.status === 'active' || !c.status).length,
      icon: Activity,
      color: 'cyan',
    },
    {
      title: t('page.dashboard.services'),
      value: contacts.filter(c => c.type === 'service').length,
      icon: Landmark,
      color: 'orange',
    },
    {
      title: t('page.dashboard.recentAdditions'),
      value: contacts.filter(c => {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const createdDate = normalizeToDate(c.createdAt);
        return createdDate && createdDate > oneMonthAgo;
      }).length,
      icon: Calendar,
      color: 'pink',
    },
    {
      title: t('page.dashboard.favorites'),
      value: contacts.filter(c => c.isFavorite).length,
      icon: Star,
      color: 'yellow',
    },
    {
      title: t('page.dashboard.contactsWithRelations'),
      value: contacts.filter(c => c.type === 'individual' || c.type === 'company').length,
      icon: TrendingUp,
      color: 'indigo',
    },
  ];
}
