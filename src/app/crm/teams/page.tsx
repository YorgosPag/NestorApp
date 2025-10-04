'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users2, Plus, Settings, Shield } from 'lucide-react';

const teams = [
  {
    name: 'Ομάδα Πωλήσεων',
    description: 'Υπεύθυνοι για τις πωλήσεις και τη διαχείριση πελατών.',
    members: [
      { name: 'Γιώργος Παπαδόπουλος', role: 'Manager' },
      { name: 'Μαρία Ιωάννου', role: 'Sales Rep' },
      { name: 'Κώστας Βασιλείου', role: 'Sales Rep' },
    ],
  },
  {
    name: 'Τμήμα Marketing',
    description: 'Υπεύθυνοι για τις προωθητικές ενέργειες.',
    members: [
      { name: 'Ελένη Δημητρίου', role: 'Marketing Head' },
      { name: 'Νίκος Σταθόπουλος', role: 'Digital Marketer' },
    ],
  },
    {
    name: 'Τμήμα Υποστήριξης',
    description: 'Υπεύθυνοι για την εξυπηρέτηση πελατών.',
    members: [
      { name: 'Άννα Κωστοπούλου', role: 'Support Lead' },
    ],
  },
];

const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
}

export default function CrmTeamsPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
            <div className="flex items-center gap-2">
                <Users2 className="w-8 h-8 text-primary" />
                <h1 className="text-3xl font-bold">Ομάδες & Ρόλοι</h1>
            </div>
          <p className="text-muted-foreground">Διαχείριση των ομάδων εργασίας και των δικαιωμάτων τους.</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Νέα Ομάδα
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <Card key={team.name} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{team.name}</CardTitle>
                <Button variant="ghost" size="sm">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription>{team.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Μέλη ({team.members.length})</h4>
              <div className="space-y-3">
                {team.members.map((member) => (
                  <div key={member.name} className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage data-ai-hint="avatar person" src={`https://placehold.co/40x40.png?text=${getInitials(member.name)}`} />
                      <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                ))}
              </div>
               <div className="pt-4">
                 <Button variant="outline" size="sm" className="w-full">
                    <Shield className="w-4 h-4 mr-2" />
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
