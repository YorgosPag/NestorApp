import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Users, Link, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface LinkingResult {
  success: boolean;
  message: string;
  linkedUnits: number;
  updates?: Array<{
    unitId: string;
    contactId: string;
    contactName: string;
  }>;
}

export function LinkSoldUnitsToCustomers() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LinkingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLinkUnits = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('🔗 Starting sold units linking process...');

      const response = await fetch('/api/units/admin-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setResult(data);
        console.log('✅ Units linked successfully:', data);
      } else {
        throw new Error(data.error || 'Failed to link units');
      }

    } catch (err) {
      console.error('❌ Error linking units:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className={iconSizes.lg} />
          Σύνδεση Πωληθέντων Μονάδων με Πελάτες
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Αυτόματη σύνδεση των units με status "sold" με υπάρχοντες πελάτες στη βάση δεδομένων.
          Αυτό θα επιλύσει το πρόβλημα της μη εμφάνισης πελατών στο έργο {process.env.NEXT_PUBLIC_PRIMARY_PROJECT_NAME || 'Main Project'}.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Action Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleLinkUnits}
            disabled={loading}
            size="lg"
            className="w-full max-w-md"
          >
            {loading ? (
              <>
                <RefreshCw className={`${iconSizes.sm} mr-2 animate-spin`} />
                Συνδέω μονάδες με πελάτες...
              </>
            ) : (
              <>
                <Users className={`${iconSizes.sm} mr-2`} />
                Σύνδεση Sold Units με Contacts
              </>
            )}
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>
              <strong>Σφάλμα:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Success Result */}
        {result?.success && (
          <Alert>
            <CheckCircle className={`${iconSizes.sm} text-green-600`} />
            <AlertDescription>
              <strong>Επιτυχία!</strong> {result.message}
              {result.linkedUnits > 0 && (
                <div className="mt-2">
                  <Badge variant="secondary">
                    {result.linkedUnits} μονάδες συνδέθηκαν με πελάτες
                  </Badge>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Detailed Results */}
        {result?.updates && result.updates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Αποτελέσματα Σύνδεσης</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.updates.map((update, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 bg-muted ${quick.input}`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className={`${iconSizes.sm} text-green-600`} />
                      <span className="text-sm">
                        <strong>Unit:</strong> {update.unitId}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      → <strong>{update.contactName}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              💡 Πώς λειτουργεί:
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Βρίσκει όλα τα units με status "sold" που δεν έχουν soldTo field</li>
              <li>• Συλλέγει όλους τους διαθέσιμους πελάτες από τη βάση contacts</li>
              <li>• Συνδέει αυτόματα τα sold units με υπάρχοντες πελάτες</li>
              <li>• Μετά τη σύνδεση, οι πελάτες θα εμφανίζονται στο tab "Πελάτες Έργου"</li>
            </ul>
          </CardContent>
        </Card>

        {/* Warning */}
        <Alert>
          <AlertTriangle className={iconSizes.sm} />
          <AlertDescription>
            <strong>Σημείωση:</strong> Αυτή η λειτουργία κάνει πραγματικές αλλαγές στη βάση δεδομένων.
            Σιγουρέψου ότι έχεις backup πριν προχωρήσεις.
          </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
}

export default LinkSoldUnitsToCustomers;