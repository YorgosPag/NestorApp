// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users2, Plus, Settings, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { enterpriseTeamsService } from '@/services/teams/EnterpriseTeamsService';
import type { EnterpriseTeamMember } from '@/services/teams/EnterpriseTeamsService';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/contexts/AuthContext';
import { Spinner } from '@/components/ui/spinner';
import { cn, getSpacingClass } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';
import { getAvatarPlaceholderUrl } from '@/config/media-constants';

interface DisplayTeam {
  id: string;
  name: string;
  description: string;
  members: EnterpriseTeamMember[];
}

// Use the singleton instance of enterprise teams service
const teamsService = enterpriseTeamsService;

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

export default function CrmTeamsPage() {
  const logger = createModuleLogger('crm/teams');
  const { t } = useTranslation('crm');
  const iconSizes = useIconSizes();
  const pagePadding = getSpacingClass('p', 'lg');
  const sectionMargin = getSpacingClass('m', 'lg', 'b');
  const { user } = useAuth();
  const [teams, setTeams] = useState<DisplayTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load teams data from the database
  useEffect(() => {
    const loadTeamsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load teams configuration from database
        const organizationId = user?.companyId;
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

  // Show loading state
  if (loading) {
    return (
      <div className={pagePadding}>
        <div className={cn('flex items-center justify-center min-h-[400px]')}>
          <div className={cn('text-center space-y-4')}>
            <Spinner size="large" className={cn(iconSizes.xl, 'mx-auto text-primary')} />
            <p className="text-muted-foreground">{t('teams.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={pagePadding}>
        <div className={cn('flex items-center justify-center min-h-[400px]')}>
          <div className={cn('text-center space-y-4')}>
            <div className={`${iconSizes.xl} bg-destructive/20 rounded-full flex items-center justify-center mx-auto`}>
              <Shield className={`${iconSizes.sm} text-destructive`} />
            </div>
            <div className="space-y-2">
              <p className="font-medium text-destructive">{t('teams.error.title')}</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                {t('teams.error.reload')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state
  if (teams.length === 0) {
    return (
      <div className={pagePadding}>
        <div className={cn('flex items-center justify-between', sectionMargin)}>
          <div>
            <div className={cn('flex items-center gap-2')}>
              <Users2 className={cn(iconSizes.xl, 'text-primary')} />
              <h1 className="text-3xl font-bold">{t('teams.title')}</h1>
            </div>
            <p className="text-muted-foreground">{t('teams.subtitle')}</p>
          </div>
          <Button>
            <Plus className={cn(iconSizes.sm, 'mr-2')} />
            {t('teams.newTeam')}
          </Button>
        </div>
        <div className={cn('flex items-center justify-center min-h-[400px]')}>
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
        </div>
      </div>
    );
  }

  return (
    <div className={pagePadding}>
      <div className={cn('flex items-center justify-between', sectionMargin)}>
        <div>
            <div className={cn('flex items-center gap-2')}>
                <Users2 className={cn(iconSizes.xl, 'text-primary')} />
                <h1 className="text-3xl font-bold">{t('teams.title')}</h1>
            </div>
          <p className="text-muted-foreground">{t('teams.subtitle')}</p>
        </div>
        <Button>
          <Plus className={cn(iconSizes.sm, 'mr-2')} />
          {t('teams.newTeam')}
        </Button>
      </div>

      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6')}>
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
              <h4 className="text-sm font-medium text-muted-foreground">{t('teams.members', { count: team.members.length })}</h4>
              <div className={cn('space-y-3')}>
                {team.members.map((member) => (
                  <div key={member.id} className={cn('flex items-center gap-3')}>
                    <Avatar>
                      <AvatarImage data-ai-hint="avatar person" src={getAvatarPlaceholderUrl(getInitials(member.displayName))} />
                      <AvatarFallback>{getInitials(member.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">{member.position?.title || member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
               <div className={cn('pt-4')}>
                 <Button variant="outline" size="sm" className={cn('w-full')}>
                    <Shield className={`${iconSizes.sm} mr-2`} />
                    {t('teams.managePermissions')}
                </Button>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
