'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για bundle optimization
import { LazyRoutes } from '@/utils/lazyRoutes';
import { cn, getSpacingClass } from '@/lib/design-system';

export default function EmailAnalyticsPage() {
  const pagePadding = getSpacingClass('p', 'lg');
  const EmailAnalytics = LazyRoutes.EmailAnalytics;
  return (
    <div className={cn('container mx-auto', pagePadding)}>
      <EmailAnalytics />
    </div>
  );
}
