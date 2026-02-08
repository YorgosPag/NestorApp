// 🏢 ENTERPRISE: Stats moved to page level (CRMDashboardPageContent) — 2026-02-08
// OverviewTab now shows only: RecentActivities, QuickActions, TeamPerformance
'use client';

import { RecentActivities } from './RecentActivities';
import { QuickActions } from './QuickActions';
import { TeamPerformance } from './TeamPerformance';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

export function OverviewTab() {
  const layout = useLayoutClasses();

  return (
    <section className={layout.flexColGap4}>
      {/* Recent Activities & Quick Actions */}
      <div className={layout.getGridCols(2, '6')}>
        <RecentActivities />
        <QuickActions />
      </div>

      {/* Team Performance */}
      <TeamPerformance />
    </section>
  );
}
