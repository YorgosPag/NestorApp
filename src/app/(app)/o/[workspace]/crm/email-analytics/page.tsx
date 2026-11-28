'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για bundle optimization
import { CrmRoutes } from '@/components/crm/crm-routes';
import { cn, getSpacingClass } from '@/lib/design-system';

export default function EmailAnalyticsPage() {
  const pagePadding = getSpacingClass('p', 'lg');
  const EmailAnalytics = CrmRoutes.EmailAnalytics;
  return (
    <div className={cn('container mx-auto', pagePadding)}>
      <EmailAnalytics />
    </div>
  );
}
