// ============================================================================
// STATE COMPONENTS - ENTERPRISE MODULE
// ============================================================================
//
// 🎭 Dedicated components για διαφορετικές καταστάσεις του summary
// Loading, Empty, New Contact states extracted για reusability
//
// ============================================================================

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Plus } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface StateComponentProps {
  /** Optional CSS className */
  className?: string;
}

interface EmptyStateProps extends StateComponentProps {
  /** Whether in read-only mode */
  readonly?: boolean;
  /** Callback when add button is clicked */
  onManageRelationships?: () => void;
}

// ============================================================================
// NEW CONTACT STATE
// ============================================================================

/**
 * 🆕 NewContactState Component
 *
 * Displayed when contact hasn't been saved yet
 */
export const NewContactState: React.FC<StateComponentProps> = ({ className }) => (
  <Card className={className}>
    <CardContent className="pt-6">
      <div className="text-center text-gray-500">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="font-medium text-lg mb-2">Σχέσεις Επαφής</h3>
        <p className="text-sm mb-4">
          Οι σχέσεις θα είναι διαθέσιμες μετά την αποθήκευση της επαφής.
        </p>
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600">
            💡 <strong>Συμβουλή:</strong> Αποθηκεύστε την επαφή για να προσθέσετε
            επαγγελματικές σχέσεις, εργαζόμενους και μετόχους.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// ============================================================================
// LOADING STATE
// ============================================================================

/**
 * ⏳ LoadingState Component
 *
 * Displayed while relationships are being fetched
 */
export const LoadingState: React.FC<StateComponentProps> = ({ className }) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="flex items-center space-x-2">
        <Users className="h-5 w-5" />
        <span>Σχέσεις Επαφής</span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500">Φόρτωση σχέσεων...</p>
      </div>
    </CardContent>
  </Card>
);

// ============================================================================
// EMPTY STATE
// ============================================================================

/**
 * 📭 EmptyState Component
 *
 * Displayed when no relationships exist
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  className,
  readonly = false,
  onManageRelationships
}) => (
  <Card className={className}>
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Σχέσεις Επαφής</span>
        </div>
        {!readonly && onManageRelationships && (
          <Button
            onClick={onManageRelationships}
            size="sm"
            className="ml-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Προσθήκη
          </Button>
        )}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-center py-8">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <h3 className="font-medium mb-2">Δεν υπάρχουν σχέσεις</h3>
        <p className="text-gray-500 text-sm mb-4">
          Προσθέστε επαγγελματικές σχέσεις, εργαζόμενους και συνεργάτες.
        </p>
        {!readonly && onManageRelationships && (
          <Button
            onClick={onManageRelationships}
            variant="outline"
            size="sm"
          >
            Ξεκινήστε εδώ
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  NewContactState,
  LoadingState,
  EmptyState
};