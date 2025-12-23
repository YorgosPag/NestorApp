'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users2, Plus, Settings, Shield, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { enterpriseTeamsService } from '@/services/teams/EnterpriseTeamsService';
import type { EnterpriseTeam, EnterpriseTeamMember } from '@/services/teams/EnterpriseTeamsService';

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
  const iconSizes = useIconSizes();
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
        const organizationId = 'default-org'; // This should come from user context
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
        console.error('Failed to load teams data:', err);
        setError('Failed to load teams. Please try again.');

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
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className={`${iconSizes.xl} animate-spin mx-auto text-primary`} />
            <p className="text-muted-foreground">Φόρτωση ομάδων...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className={`${iconSizes.xl} bg-destructive/20 rounded-full flex items-center justify-center mx-auto`}>
              <Shield className={`${iconSizes.sm} text-destructive`} />
            </div>
            <div className="space-y-2">
              <p className="font-medium text-destructive">Σφάλμα φόρτωσης</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="mt-4"
              >
                Επαναφόρτωση
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
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2">
              <Users2 className={`${iconSizes.xl} text-primary`} />
              <h1 className="text-3xl font-bold">Ομάδες & Ρόλοι</h1>
            </div>
            <p className="text-muted-foreground">Διαχείριση των ομάδων εργασίας και των δικαιωμάτων τους.</p>
          </div>
          <Button>
            <Plus className={`${iconSizes.sm} mr-2`} />
            Νέα Ομάδα
          </Button>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Users2 className={`${iconSizes.xl2} text-muted-foreground/50 mx-auto`} />
            <div className="space-y-2">
              <p className="font-medium">Δεν βρέθηκαν ομάδες</p>
              <p className="text-sm text-muted-foreground">
                Δημιουργήστε την πρώτη ομάδα για να ξεκινήσετε.
              </p>
              <Button className="mt-4">
                <Plus className={`${iconSizes.sm} mr-2`} />
                Δημιουργία Ομάδας
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
            <div className="flex items-center gap-2">
                <Users2 className={`${iconSizes.xl} text-primary`} />
                <h1 className="text-3xl font-bold">Ομάδες & Ρόλοι</h1>
            </div>
          <p className="text-muted-foreground">Διαχείριση των ομάδων εργασίας και των δικαιωμάτων τους.</p>
        </div>
        <Button>
          <Plus className={`${iconSizes.sm} mr-2`} />
          Νέα Ομάδα
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <Card key={team.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{team.name}</CardTitle>
                <Button variant="ghost" size="sm">
                  <Settings className={iconSizes.sm} />
                </Button>
              </div>
              <CardDescription>{team.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Μέλη ({team.members.length})</h4>
              <div className="space-y-3">
                {team.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage data-ai-hint="avatar person" src={`https://placehold.co/40x40.png?text=${getInitials(member.displayName)}`} />
                      <AvatarFallback>{getInitials(member.displayName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">{member.position?.title || member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
               <div className="pt-4">
                 <Button variant="outline" size="sm" className="w-full">
                    <Shield className={`${iconSizes.sm} mr-2`} />
                    Διαχείριση Δικαιωμάτων
                </Button>
               </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
