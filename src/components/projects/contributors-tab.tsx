'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const contributors = [
  { id: 1, role: 'Αρχιτέκτων', name: 'Παπαδόπουλος Γεώργιος', company: 'P Architects', phone: '2310123456', email: 'g.papadopoulos@parch.gr' },
  { id: 2, role: 'Πολιτικός Μηχανικός', name: 'Ιωάννου Μαρία', company: 'Structura A.E.', phone: '2310654321', email: 'm.ioannou@structura.gr' },
  { id: 3, role: 'Μηχανολόγος Μηχανικός', name: 'Βασιλείου Κωνσταντίνος', company: 'Mech Solutions', phone: '2310789012', email: 'k.vasileiou@mech.gr' },
  { id: 4, role: 'Εργολάβος', name: 'Κατασκευαστική ΑΒΓ', company: 'Κατασκευαστική ΑΒΓ', phone: '2310345678', email: 'info@abg-kat.gr' }
];

export function ContributorsTab() {
  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Συντελεστές Έργου</CardTitle>
              <CardDescription>Λίστα με τους συντελεστές και τις επαφές τους για το έργο.</CardDescription>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Προσθήκη Συντελεστή
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ρόλος</TableHead>
                  <TableHead>Ονοματεπώνυμο</TableHead>
                  <TableHead>Εταιρεία</TableHead>
                  <TableHead>Τηλέφωνο</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Ενέργειες</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributors.map((contributor) => (
                  <TableRow key={contributor.id}>
                    <TableCell className="font-medium">{contributor.role}</TableCell>
                    <TableCell>{contributor.name}</TableCell>
                    <TableCell>{contributor.company}</TableCell>
                    <TableCell>{contributor.phone}</TableCell>
                    <TableCell>
                      <a href={`mailto:${contributor.email}`} className="text-primary hover:underline">{contributor.email}</a>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Επεξεργασία</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Διαγραφή</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}