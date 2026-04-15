'use client';

/**
 * =============================================================================
 * CRM TEAMS PAGE CONTENT - TEAM MANAGEMENT
 * =============================================================================
 *
 * Enterprise Pattern: PageHeader + UnifiedDashboard
 * Features: Team listing, member management, stats
 *
 * @module components/crm/pages/CrmTeamsPageContent
 * @performance ADR-294 Batch 4 — lazy-loaded via LazyRoutes
 */

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users2, Plus, Settings, Shield, UserCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useCompanyId } from '@/hooks/useCompanyId';
import { PageLoadingState, PageErrorState } from '@/core/states';
import { cn } from '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { createModuleLogger } from '@/lib/telemetry';
import { getAvatarPlaceholderUrl } from '@/config/media-constants';
import { getInitials } from '@/types/contacts/helpers';
import { PageHeader } from '@/core/headers';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import { PageContainer } from '@/core/containers';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const teamsCache = createStaleCache<DisplayTeam[]>('crm-teams');

interface TeamMember {
  id: string;
  displayName: string;
  role: string;
  position?: { title?: string } | null;
}

interface DisplayTeam {
  id: string;
  name: string;
  description: string;
  members: TeamMember[];
}

export function CrmTeamsPageContent() {
  const logger = createModuleLogger('crm/teams');
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { user: _user } = useAuth();
  const resolvedCompanyId = useCompanyId()?.companyId;
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [teams, setTeams] = useState<DisplayTeam[]>(teamsCache.get() ?? []);
  const [loading, setLoading] = useState(!teamsCache.hasLoaded());
  const [error, setError] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    const loadTeamsData = async () => {
      try {
        // ADR-300: Only show spinner on first load — not on re-navigation
        if (!teamsCache.hasLoaded()) setLoading(true);
        setError(null);

        if (!resolvedCompanyId) {
          setError(t('teams.error.missingOrg'));
          setTeams([]);
          setLoading(false);
          return;
        }

        const teamsQ = query(
          collection(db, COLLECTIONS.TEAMS),
          where('companyId', '==', resolvedCompanyId),
          where('isActive', '==', true),
          orderBy('name')
        );
        const teamsSnap = await getDocs(teamsQ);

        const displayTeams: DisplayTeam[] = await Promise.all(
          teamsSnap.docs.map(async (teamDoc) => {
            const teamData = teamDoc.data() as {
              name?: string;
              description?: string;
            };

            const membersQ = query(
              collection(db, COLLECTIONS.CONTACTS),
              where('companyId', '==', resolvedCompanyId),
              where('type', '==', 'employee'),
              where('department', '==', teamDoc.id),
              where('isActive', '==', true),
              orderBy('displayName')
            );
            const membersSnap = await getDocs(membersQ);
            const members: TeamMember[] = membersSnap.docs.map((m) => {
              const data = m.data() as {
                displayName?: string;
                role?: string;
                position?: { title?: string } | null;
              };
              return {
                id: m.id,
                displayName: data.displayName ?? '',
                role: data.role ?? '',
                position: data.position ?? null,
              };
            });

            return {
              id: teamDoc.id,
              name: teamData.name ?? teamDoc.id,
              description: teamData.description ?? '',
              members,
            };
          })
        );

        // ADR-300: Write to module-level cache so next remount skips spinner
        teamsCache.set(displayTeams);
        setTeams(displayTeams);
      } catch (err) {
        logger.error('Failed to load teams data', { error: err instanceof Error ? err.message : 'Unknown error' });
        setError(t('teams.error.loadFailed'));
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    loadTeamsData();
  }, [resolvedCompanyId, t, logger]);

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

      {showDashboard && (
        <section className="w-full" role="region" aria-label={t('teams.stats.totalTeams')}>
          <UnifiedDashboard
            stats={dashboardStats}
            columns={2}
          />
        </section>
      )}

      {teams.length === 0 ? (
        <section className={cn('flex items-center justify-center min-h-[400px]')} role="region" aria-label={t('teams.empty.title')}>
          <div className={cn('text-center space-y-4')}>
            <Users2 className={cn(iconSizes.xl2, colors.text.muted, 'opacity-50 mx-auto')} />
            <div className="space-y-2">
              <p className="font-medium">{t('teams.empty.title')}</p>
              <p className={cn("text-sm", colors.text.muted)}>
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
                <h4 className={cn("text-sm font-medium", colors.text.muted)}>
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
                        <p className={cn("text-xs", colors.text.muted)}>
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

export default CrmTeamsPageContent;
