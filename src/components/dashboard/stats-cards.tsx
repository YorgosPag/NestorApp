
"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CommonBadge } from "@/core/badges";
import { ThemeProgressBar } from "@/core/progress/ThemeProgressBar";
import {
  Users,
  TrendingUp,
  Plus,
  Star,
  Activity,
  Clock,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import type { QuickStats } from "@/types/dashboard";

interface StatsCardsProps {
  stats: QuickStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { t } = useTranslation('dashboard');
  
  return (
    <section
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      role="region"
      aria-label="Στατιστικά Dashboard"
    >
      <Card className="card-hover border-l-4 border-l-blue-600">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('stats.totalContacts')}</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <data value={stats.totalContacts} className="text-2xl font-bold">
            {stats.totalContacts.toLocaleString("el-GR")}
          </data>
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <TrendingUp className="mr-1 h-3 w-3 text-green-600" />
            <span className="text-green-600 font-medium">+12.5%</span>
            <span className="ml-1">{t('stats.periods.lastMonth')}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover border-l-4 border-l-green-600">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('stats.newContacts')}</CardTitle>
          <Plus className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <data value={stats.newThisMonth} className="text-2xl font-bold">{stats.newThisMonth}</data>
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <span>{t('stats.periods.thisMonth')}</span>
          </div>
          <div className="mt-2">
            <ThemeProgressBar
              progress={65}
              label=""
              size="sm"
              showPercentage={false}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover border-l-4 border-l-yellow-600">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('stats.favorites')}</CardTitle>
          <Star className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <data value={stats.favorites} className="text-2xl font-bold">{stats.favorites}</data>
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <CommonBadge
              status="company"
              customLabel={t('stats.quickAccess')}
              variant="secondary"
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="card-hover border-l-4 border-l-purple-600">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('stats.activeToday')}</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <data value={stats.activeToday} className="text-2xl font-bold">{stats.activeToday}</data>
          <div className="flex items-center text-xs text-muted-foreground mt-2">
            <Clock className="mr-1 h-3 w-3" />
            <span>{t('stats.periods.last24h')}</span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
