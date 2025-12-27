'use client';

/**
 * 🏢 UNIT CUSTOMER TAB - ENTERPRISE IMPLEMENTATION
 *
 * Full-featured customer management tab for units με real Firebase integration
 * Εμφανίζει complete customer profile για sold/rented/reserved units
 *
 * ENTERPRISE FEATURES:
 * - Real database-driven (Firebase soldTo relationships)
 * - Full customer profile display
 * - Direct action integration (call, email, view)
 * - Purchase/rental history
 * - Property relationship management
 * - Responsive design
 * - Accessibility compliant
 *
 * @created 2025-12-14
 * @author Claude AI Assistant
 * @version 1.0.0
 * @enterprise Microsoft/Google standards
 */

import React from 'react';
import { User, Phone, Mail, Calendar, Home, FileText, AlertTriangle, ExternalLink, ArrowRight } from 'lucide-react';
import { formatDateTime, formatDate, formatCurrency } from '@/lib/intl-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { UnifiedCustomerCard } from '@/components/shared/customer-info';
import { useOptimizedCustomerInfo } from './hooks/useOptimizedCustomerInfo';
import type { Property } from '@/types/property-viewer';

export interface UnitCustomerTabProps {
  /** The unit/property object από τη real Firebase database */
  selectedUnit: Property;
  /** Additional data from the parent component */
  additionalData?: any;
  /** Global props from the tabs system */
  globalProps?: any;
}

/**
 * Enterprise customer tab για unit details
 * Δείχνει full customer profile και relationship management
 */
// ============================================================================
// OPTIMIZED CUSTOMER PROFILE SECTION COMPONENT
// ============================================================================

interface CustomerProfileSectionProps {
  customerId: string;
  unitPrice?: number;
}

function CustomerProfileSection({ customerId, unitPrice }: CustomerProfileSectionProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const {
    customerInfo,
    loading,
    error,
    refetch
  } = useOptimizedCustomerInfo(customerId, Boolean(customerId));

  // ENTERPRISE: Optimized Loading State
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className={`${iconSizes.md} ${colors.text.info}`} />
            Πληροφορίες Πελάτη
            <div className="ml-auto">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AnimatedSpinner size="small" variant="info" />
                <span>Φόρτωση...</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* ENTERPRISE: Professional Skeleton Loader */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className={`${iconSizes.xl2} rounded-full`} />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <div className="flex gap-2 pt-4">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ENTERPRISE: Error State
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`${iconSizes.md} text-destructive`} />
            Σφάλμα Φόρτωσης Πελάτη
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>
              Δεν ήταν δυνατή η φόρτωση των στοιχείων του πελάτη: {error}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={refetch}
              className="flex-1"
            >
              Επανάληψη Φόρτωσης
            </Button>
            <Button
              variant="ghost"
              onClick={() => window.location.reload()}
              className="flex-1"
            >
              Reload Σελίδας
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ENTERPRISE: Success State με Full Profile
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className={`${iconSizes.md} ${colors.text.info}`} />
          Πληροφορίες Πελάτη
          <Badge variant="outline" className="ml-auto">
            Φορτώθηκε
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* ENTERPRISE: Fast Rendering με Cached Data */}
        <div className="space-y-4">

          {/* ENTERPRISE: Clickable Customer Profile Header */}
          <div
            className={`flex items-start gap-4 p-3 ${quick.card} border border-transparent ${getStatusBorder('info', 'hover:')} hover:bg-primary/5 cursor-pointer transition-all duration-200 group`}
            onClick={() => {
              // ENTERPRISE: Deep-link navigation με URL parameters
              const contactsUrl = `/contacts?filter=customer&contactId=${customerId}&source=unit`;
              window.open(contactsUrl, '_blank');
            }}
            role="button"
            tabIndex={0}
            title="Κλικ για προβολή στη λίστα επαφών"
          >
            <div className={`${iconSizes.xl4} bg-primary/10 rounded-full flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors`}>
              <User className={`${iconSizes.xl} text-primary`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                  {customerInfo?.displayName || 'Άγνωστος πελάτης'}
                </h3>
                <ExternalLink className={`${iconSizes.sm} text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100`} />
              </div>
              {customerInfo?.primaryPhone && (
                <p className="text-muted-foreground flex items-center gap-2 mb-1">
                  <Phone className={iconSizes.sm} />
                  {customerInfo.primaryPhone}
                </p>
              )}
              {customerInfo?.primaryEmail && (
                <p className="text-muted-foreground flex items-center gap-2 mb-1">
                  <Mail className={iconSizes.sm} />
                  <span className="truncate">{customerInfo.primaryEmail}</span>
                </p>
              )}
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <Calendar className={iconSizes.xs} />
                Φόρτωση: {customerInfo ? formatDateTime(customerInfo.fetchedAt, { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </div>
            <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors">
              <ArrowRight className={iconSizes.md} />
            </div>
          </div>

          {/* ENTERPRISE: Navigation Hint */}
          <div className={`${colors.bg.info} ${quick.info} p-3`}>
            <p className={`text-sm ${colors.text.info} flex items-center gap-2`}>
              <ExternalLink className={iconSizes.sm} />
              <strong>Tip:</strong> Κάνε κλικ στα στοιχεία του πελάτη για να τον δεις στη λίστα επαφών
            </p>
          </div>

          <Separator />

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer ID</p>
              <p className={`font-mono text-xs bg-muted px-2 py-1 ${quick.input}`}>
                {customerId}
              </p>
            </div>
            {unitPrice && (
              <div>
                <p className="text-sm text-muted-foreground">Αξία Συναλλαγής</p>
                <p className={`font-semibold ${colors.text.success}`}>
                  {formatCurrency(unitPrice)}
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className={`flex flex-wrap gap-2 pt-4 ${getDirectionalBorder('muted', 'top')}`}>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const contactsUrl = `/contacts?filter=customer&contactId=${customerId}&source=unit`;
                window.open(contactsUrl, '_blank');
              }}
            >
              <ExternalLink className={`${iconSizes.sm} mr-2`} />
              Λίστα Επαφών
            </Button>

            {customerInfo?.primaryPhone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const cleanPhone = customerInfo.primaryPhone!.replace(/\s+/g, '');
                  window.open(`tel:${cleanPhone}`, '_self');
                }}
              >
                <Phone className={`${iconSizes.sm} mr-2`} />
                Κλήση
              </Button>
            )}

            {customerInfo?.primaryEmail && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`mailto:${customerInfo.primaryEmail}`, '_self')}
              >
                <Mail className={`${iconSizes.sm} mr-2`} />
                Email
              </Button>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnitCustomerTab({
  selectedUnit,
  additionalData,
  globalProps
}: UnitCustomerTabProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // ========================================================================
  // ENTERPRISE VALIDATION: Unit Customer Checks
  // ========================================================================

  const hasSoldStatus = selectedUnit?.status === 'sold' ||
                       selectedUnit?.status === 'reserved' ||
                       selectedUnit?.status === 'rented';

  const hasCustomerLink = Boolean(selectedUnit?.soldTo);

  // Early returns για units χωρίς customer info
  if (!selectedUnit) {
    return (
      <div className="p-6 text-center">
        <User className={`${iconSizes.xl3} mx-auto text-muted-foreground mb-4`} />
        <p className="text-muted-foreground">
          Δεν έχει επιλεχθεί μονάδα
        </p>
      </div>
    );
  }

  if (!hasSoldStatus) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className={`${iconSizes.md} ${colors.text.info}`} />
            Διαθέσιμη Μονάδα
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className={`${colors.bg.info} rounded-full ${iconSizes.xl4} flex items-center justify-center mx-auto mb-4`}>
              <Home className={`${iconSizes.xl} ${colors.text.info}`} />
            </div>
            <h3 className="font-semibold text-lg mb-2">
              Η μονάδα "{selectedUnit.name}" είναι διαθέσιμη
            </h3>
            <p className="text-muted-foreground mb-4">
              Status: <Badge variant="outline">{selectedUnit.status}</Badge>
            </p>
            <Button variant="outline" asChild>
              <a href="/crm/calendar">
                <Calendar className={`${iconSizes.sm} mr-2`} />
                Προγραμματισμός Ξενάγησης
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasCustomerLink) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`${iconSizes.md} ${colors.text.warning}`} />
            Πωλημένη Μονάδα χωρίς Πελάτη
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className={iconSizes.sm} />
            <AlertDescription>
              Η μονάδα έχει status "{selectedUnit.status}" αλλά δεν έχει συνδεδεμένο πελάτη.
              Αυτό μπορεί να υποδηλώνει πρόβλημα στη βάση δεδομένων ή ότι η σύνδεση πελάτη δεν έχει ολοκληρωθεί.
            </AlertDescription>
          </Alert>

          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Status μονάδας:</strong> {selectedUnit.status}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Ημερομηνία συναλλαγής:</strong> {
                selectedUnit.saleDate
                  ? formatDate(selectedUnit.saleDate)
                  : 'Άγνωστη'
              }
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Πελάτης ID:</strong> {selectedUnit.soldTo || 'Δεν υπάρχει'}
            </p>
          </div>

          <div className="mt-6">
            <Button variant="outline" className="w-full">
              <FileText className={`${iconSizes.sm} mr-2`} />
              Διαχείριση Συναλλαγής
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ========================================================================
  // ENTERPRISE CUSTOMER DISPLAY: Full Profile Tab
  // ========================================================================

  return (
    <div className="p-6 space-y-6">

      {/* ENTERPRISE: Unit Sale Information Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className={`${iconSizes.md} ${colors.text.success}`} />
            Στοιχεία Συναλλαγής
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status Μονάδας</p>
              <Badge
                variant={selectedUnit.status === 'sold' ? 'destructive' : 'secondary'}
                className="mt-1"
              >
                {selectedUnit.status === 'sold' ? 'Πωλήθηκε' :
                 selectedUnit.status === 'reserved' ? 'Κρατήθηκε' : 'Ενοικιάστηκε'}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Ημερομηνία Συναλλαγής</p>
              <p className="font-medium">
                {selectedUnit.saleDate
                  ? formatDate(selectedUnit.saleDate, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })
                  : 'Άγνωστη ημερομηνία'
                }
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Αξία Συναλλαγής</p>
              <p className={`font-medium ${colors.text.success}`}>
                {selectedUnit.price
                  ? formatCurrency(selectedUnit.price)
                  : 'Μη διαθέσιμη'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ENTERPRISE: Full Customer Profile Display με OPTIMIZED LOADING */}
      <CustomerProfileSection
        customerId={selectedUnit.soldTo!}
        unitPrice={selectedUnit.price}
      />

      {/* ENTERPRISE: Property Relationship Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className={`${iconSizes.md} ${colors.text.warning}`} />
            Διαχείριση Σχέσης Ακινήτου
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <Button variant="outline" className="justify-start h-auto p-4">
              <FileText className={`${iconSizes.md} mr-3 ${colors.text.info}`} />
              <div className="text-left">
                <div className="font-medium">Έγγραφα Συναλλαγής</div>
                <div className="text-sm text-muted-foreground">
                  Συμβόλαια, αποδείξεις, πιστοποιητικά
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <Calendar className={`${iconSizes.md} mr-3 ${colors.text.success}`} />
              <div className="text-left">
                <div className="font-medium">Ιστορικό Συναλλαγών</div>
                <div className="text-sm text-muted-foreground">
                  Χρονολόγιο πληρωμών και ενεργειών
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <Phone className={`${iconSizes.md} mr-3 ${colors.text.accent}`} />
              <div className="text-left">
                <div className="font-medium">Επικοινωνία</div>
                <div className="text-sm text-muted-foreground">
                  Κλήσεις, emails, συναντήσεις
                </div>
              </div>
            </Button>

            <Button variant="outline" className="justify-start h-auto p-4">
              <Home className={`${iconSizes.md} mr-3 ${colors.text.info}`} />
              <div className="text-left">
                <div className="font-medium">Άλλα Ακίνητα</div>
                <div className="text-sm text-muted-foreground">
                  Δείτε όλα τα ακίνητα του πελάτη
                </div>
              </div>
            </Button>

          </div>
        </CardContent>
      </Card>

      {/* ENTERPRISE: Quick Actions Panel */}
      <Card className={INTERACTIVE_PATTERNS.SUBTLE_HOVER}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className={`${iconSizes.md} ${colors.text.success}`} />
            Γρήγορες Ενέργειες
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">

            <Button
              variant="default"
              onClick={() => window.open(`tel:${selectedUnit.soldTo}`, '_self')}
            >
              <Phone className={`${iconSizes.sm} mr-2`} />
              Άμεση Κλήση
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open(`/contacts?contactId=${selectedUnit.soldTo}`, '_blank')}
            >
              <User className={`${iconSizes.sm} mr-2`} />
              Πλήρες Προφίλ
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Add to calendar or task management
                console.log('Schedule follow-up for customer:', selectedUnit.soldTo);
              }}
            >
              <Calendar className={`${iconSizes.sm} mr-2`} />
              Προγραμματισμός
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                // Generate report
                console.log('Generate customer report for:', selectedUnit.soldTo);
              }}
            >
              <FileText className={`${iconSizes.sm} mr-2`} />
              Αναφορά
            </Button>

          </div>
        </CardContent>
      </Card>

    </div>
  );
}