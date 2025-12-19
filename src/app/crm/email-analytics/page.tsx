'use client';

// ⚡ ENTERPRISE: Use LazyRoutes instead of direct import για bundle optimization
import { LazyRoutes } from '@/utils/lazyRoutes';

export default function EmailAnalyticsPage() {
  const EmailAnalytics = LazyRoutes.EmailAnalytics;
  return (
    <div className="container mx-auto p-6">
      <EmailAnalytics />
    </div>
  );
}
