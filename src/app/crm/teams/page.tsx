// 🏢 ENTERPRISE: CRM Teams Page with centralized PageHeader + UnifiedDashboard
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users2, Plus, Settings, Shield, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { enterpriseTeamsService } from '@/services/teams/EnterpriseTeamsService';
import type { EnterpriseTeamMember } from '@/services/teams/EnterpriseTeamsService';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { PageLoadingState, PageErrorState } from '@/core/states';
import { cn } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';
import { getAvatarPlaceholderUrl } from '@/config/media-constants';
import { getInitials } from '@/types/contacts/helpers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { PageContainer } from '@/core/containers';

interface DisplayTeam {
  id: string;
  name: string;
  description: string;
  members: EnterpriseTeamMember[];
}

// Use the singleton instance of enterprise teams service
const teamsService = enterpriseTeamsService;

export default function CrmTeamsPage() {
  const logger = createModuleLogger('crm/teams');
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const { user } = useAuth();
  const resolvedCompanyId = useCompanyId()?.companyId;
  const [teams, setTeams] = useState<DisplayTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  // Load teams data from the database
  useEffect(() => {
    const loadTeamsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load teams configuration from database
        const organizationId = resolvedCompanyId;
        if (!organizationId) {
          setError(t('teams.error.missingOrg'));
          setTeams([]);
          setLoading(false);
          return;
        }
        const teamsFromDb = await teamsService.getTeams(organizationId);

        // Transform to display format and load members
        const displayTeams: DisplayTeam[] = [];
        for (const team of teamsFromDb) {
          const members = await teamsService.getTeamMembers(team.id, organizationId);
          displayTeams.push({
            id: team.id,
            name: team.name,
            description: team.description,
            members
          });
        }

        setTeams(displayTeams);
      } catch (err) {
        logger.error('Failed to load teams data', { error: err instanceof Error ? err.message : 'Unknown error' });
        setError(t('teams.error.loadFailed'));

        // Fallback to empty state instead of hardcoded data
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeamsData();
  }, []);

  // Computed stats
  const totalMembers = teams.reduce((sum, team) => sum + team.members.length, 0);

  const dashboardStats: DashboardStat[] = [
    {
      title: t('teams.stats.totalTeams'),
      value: teams.length,
      icon: Users2,
      color: 'blue'
    },
    {
      title: t('teams.stats.totalMembers'),
      value: totalMembers,
      icon: UserCheck,
      color: 'green'
    },
  ];

  // ADR-229 Phase 2: Centralized loading/error states
  if (loading) {
    return <PageLoadingState icon={Users2} message={t('teams.loading')} layout="contained" />;
  }

  if (error) {
    return (
      <PageErrorState
        title={t('teams.error.title')}
        message={error}
        onRetry={() => window.location.reload()}
        retryLabel={t('teams.error.reload')}
        layout="contained"
      />
    );
  }

  return (
    <PageContainer ariaLabel={t('teams.title')}>
      {/* Centralized PageHeader */}
      <PageHeader
        variant="sticky-rounded"
        layout="compact"
        spacing="compact"
        breadcrumb={<ModuleBreadcrumb />}
        title={{
          icon: Users2,
          title: t('teams.title'),
          subtitle: t('teams.subtitle')
        }}
        actions={{
          showDashboard,
          onDashboardToggle: () => setShowDashboard(!showDashboard),
          addButton: {
            label: t('teams.newTeam'),
            onClick: () => {/* TODO: implement team creation */},
            icon: Plus
          }
        }}
      />

      {/* Collapsible Dashboard Stats */}
      {showDashboard && (
        <section className="w-full overflow-hidden" role="region" aria-label={t('teams.stats.totalTeams')}>
          <UnifiedDashboard
            stats={dashboardStats}
            columns={2}
            className="px-1 py-4 sm:px-4 sm:py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 overflow-hidden"
          />
        </section>
      )}

      {/* Empty state */}
      {teams.length === 0 ? (
        <section className={cn('flex items-center justify-center min-h-[400px]')} role="region" aria-label={t('teams.empty.title')}>
          <div className={cn('text-center space-y-4')}>
            <Users2 className={cn(iconSizes.xl2, 'text-muted-foreground/50 mx-auto')} />
            <div className="space-y-2">
              <p className="font-medium">{t('teams.empty.title')}</p>
              <p className="text-sm text-muted-foreground">
                {t('teams.empty.description')}
              </p>
              <Button className="mt-4">
                <Plus className={cn(iconSizes.sm, 'mr-2')} />
                {t('teams.createTeam')}
              </Button>
            </div>
          </div>
        </section>
      ) : (
        /* Teams grid */
        <section className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4')} role="region" aria-label={t('teams.title')}>
          {teams.map((team) => (
            <Card key={team.id} className={cn('flex flex-col')}>
              <CardHeader>
                <div className={cn('flex items-center justify-between')}>
                  <CardTitle>{team.name}</CardTitle>
                  <Button variant="ghost" size="sm">
                    <Settings className={iconSizes.sm} />
                  </Button>
                </div>
                <CardDescription>{team.description}</CardDescription>
              </CardHeader>
              <CardContent className={cn('flex-1 space-y-4')}>
                <h4 className="text-sm font-medium text-muted-foreground">
                  {t('teams.members', { count: team.members.length })}
                </h4>
                <div className={cn('space-y-3')}>
                  {team.members.map((member) => (
                    <div key={member.id} className={cn('flex items-center gap-3')}>
                      <Avatar>
                        <AvatarImage
                          data-ai-hint="avatar person"
                          src={getAvatarPlaceholderUrl(getInitials(member.displayName))}
                        />
                        <AvatarFallback>{getInitials(member.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{member.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.position?.title || member.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={cn('pt-4')}>
                  <Button variant="outline" size="sm" className={cn('w-full')}>
                    <Shield className={cn(iconSizes.sm, 'mr-2')} />
                    {t('teams.managePermissions')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </PageContainer>
  );
}
