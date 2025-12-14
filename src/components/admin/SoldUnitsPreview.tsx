import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, EyeOff, RefreshCw, Home } from 'lucide-react';
import { ContactsService } from '@/services/contacts.service';

interface Unit {
  id: string;
  name?: string;
  status: string;
  soldTo?: string;
  buildingId?: string;
  project?: string;
  area?: number;
  price?: number;
}

interface UnitsData {
  success: boolean;
  units: Unit[];
  count: number;
}

interface ContactLookup {
  [contactId: string]: string; // contactId -> contact name
}

export function SoldUnitsPreview() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [contactLookup, setContactLookup] = useState<ContactLookup>({});

  const loadUnits = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/units');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: UnitsData = await response.json();
      if (data.success) {
        setUnits(data.units);

        // 🔍 Load contact names για sold units
        await loadContactNames(data.units);
      } else {
        throw new Error('Failed to load units');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const loadContactNames = async (units: Unit[]) => {
    try {
      // Get unique contact IDs from sold units
      const contactIds = units
        .filter(unit => unit.status === 'sold' && unit.soldTo && unit.soldTo !== 'Not sold')
        .map(unit => unit.soldTo!)
        .filter((id, index, arr) => arr.indexOf(id) === index); // unique IDs

      if (contactIds.length === 0) return;

      console.log('🔍 Loading contact names for IDs:', contactIds);

      // Create lookup map
      const lookup: ContactLookup = {};

      // Load contact details για κάθε ID
      for (const contactId of contactIds) {
        try {
          const contact = await ContactsService.getContact(contactId);
          if (contact) {
            let displayName = '';
            if (contact.type === 'individual') {
              displayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
            } else if (contact.type === 'company') {
              displayName = contact.companyName || 'Unknown Company';
            } else if (contact.type === 'service') {
              displayName = contact.serviceName || 'Unknown Service';
            }

            lookup[contactId] = displayName || 'Unknown Contact';
            console.log(`✅ Contact loaded: ${contactId} → ${displayName}`);
          } else {
            lookup[contactId] = 'Contact Not Found';
            console.warn(`❌ Contact not found: ${contactId}`);
          }
        } catch (error) {
          lookup[contactId] = 'Error Loading';
          console.error(`❌ Error loading contact ${contactId}:`, error);
        }
      }

      setContactLookup(lookup);
      console.log('✅ Contact lookup completed:', lookup);

    } catch (error) {
      console.error('❌ Error loading contact names:', error);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  // Filter sold units without soldTo
  const soldUnitsWithoutCustomer = units.filter(unit =>
    unit.status === 'sold' && (!unit.soldTo || unit.soldTo === 'Not sold')
  );

  // Filter sold units with soldTo
  const soldUnitsWithCustomer = units.filter(unit =>
    unit.status === 'sold' && unit.soldTo && unit.soldTo !== 'Not sold'
  );

  // All units for project 1001 (Παλαιολόγου)
  const palaiologouUnits = units.filter(unit =>
    unit.buildingId?.includes('palaiologou') ||
    unit.project?.includes('Παλαιολόγου') ||
    unit.project?.includes('Κέντρο') // Based on the API response
  );

  const displayUnits = showAll ? units : palaiologouUnits;

  return (
    <div className="space-y-6">

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Σύνολο Units</p>
                <p className="text-2xl font-bold">{units.length}</p>
              </div>
              <Home className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Παλαιολόγου Units</p>
                <p className="text-2xl font-bold">{palaiologouUnits.length}</p>
              </div>
              <Badge variant="outline">Πρωτ.</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sold χωρίς Customer</p>
                <p className="text-2xl font-bold text-red-600">{soldUnitsWithoutCustomer.length}</p>
              </div>
              <Badge variant="destructive">❌</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sold με Customer</p>
                <p className="text-2xl font-bold text-green-600">{soldUnitsWithCustomer.length}</p>
              </div>
              <Badge variant="default">✅</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              Units Overview {showAll ? '(Όλα)' : '(Έργο Παλαιολόγου)'}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showAll ? 'Μόνο Παλαιολόγου' : 'Όλα τα Units'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadUnits}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Ανανέωση
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                <strong>Σφάλμα:</strong> {error}
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-8">Φόρτωση units...</div>
          ) : (
            <div className="rounded-md border max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Όνομα</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Customer (soldTo)</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Τιμή</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayUnits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Δεν βρέθηκαν units
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayUnits.map((unit) => (
                      <TableRow key={unit.id}>
                        <TableCell className="font-mono text-xs">
                          {unit.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          {unit.name || 'Unnamed Unit'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              unit.status === 'sold' ? 'destructive' :
                              unit.status === 'reserved' ? 'secondary' :
                              unit.status === 'rented' ? 'default' :
                              'outline'
                            }
                          >
                            {unit.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {unit.soldTo && unit.soldTo !== 'Not sold' ? (
                            <div className="space-y-1">
                              <Badge variant="default" className="text-xs">
                                {contactLookup[unit.soldTo] || 'Loading...'}
                              </Badge>
                              <div className="text-xs text-muted-foreground font-mono">
                                ID: {unit.soldTo.substring(0, 8)}...
                              </div>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-red-600">
                              Χωρίς Customer
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {unit.buildingId?.substring(0, 15)}...
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {unit.project?.substring(0, 20)}...
                        </TableCell>
                        <TableCell className="text-right">
                          {unit.price ? `€${unit.price.toLocaleString()}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Statistics */}
          <div className="mt-4 text-sm text-muted-foreground">
            Εμφανίζονται {displayUnits.length} από {units.length} συνολικά units
            {!showAll && ` (φιλτραρισμένα για έργο Παλαιολόγου)`}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

export default SoldUnitsPreview;