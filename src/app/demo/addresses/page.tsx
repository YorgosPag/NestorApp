/* eslint-disable custom/no-hardcoded-strings, design-system/enforce-semantic-colors */
'use client';

/**
 * =============================================================================
 * 🏢 ADDRESS SYSTEM DEMO PAGE
 * =============================================================================
 *
 * Enterprise testing page for Address components
 * Pattern: SAP/Salesforce - Component showcase before production
 *
 * Purpose:
 * - Demonstrate AddressCard, AddressListCard, AddressFormSection
 * - Test helper functions (format, migrate, validate)
 * - Verify enterprise patterns work correctly
 *
 * Navigation: http://localhost:3001/demo/addresses
 */

import React, { useState } from 'react';
import { AddressCard, AddressListCard, AddressFormSection } from '@/components/shared/addresses';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import {
  createProjectAddress,
  migrateLegacyAddress,
  getPrimaryAddress,
  formatAddressLine,
  validateAddress
} from '@/types/project/address-helpers';
import type { ProjectAddress } from '@/types/project/addresses';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

export default function AddressesDemoPage() {
  const colors = useSemanticColors();
  // Sample addresses for demo
  const [addresses, setAddresses] = useState<ProjectAddress[]>([
    createProjectAddress({
      street: 'Σαμοθράκης',
      number: '16',
      city: 'Θεσσαλονίκη',
      postalCode: '54621',
      type: 'site',
      isPrimary: true,
      blockSide: 'south',
      label: 'Κύρια Πρόσοψη',
      sortOrder: 0
    }),
    createProjectAddress({
      street: 'Καλαμαριάς',
      number: '23',
      city: 'Θεσσαλονίκη',
      postalCode: '54621',
      type: 'entrance',
      isPrimary: false,
      blockSide: 'east',
      label: 'Δευτερεύουσα Είσοδος',
      sortOrder: 1
    }),
    createProjectAddress({
      street: 'Θέρμης',
      number: '45',
      city: 'Θεσσαλονίκη',
      postalCode: '54621',
      type: 'delivery',
      isPrimary: false,
      blockSide: 'north',
      label: 'Παράδοση Υλικών',
      sortOrder: 2
    })
  ]);

  const [newHierarchy, setNewHierarchy] = useState<Partial<AddressWithHierarchyValue>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Legacy migration demo
  const [legacyAddress, setLegacyAddress] = useState('Σαμοθράκης 16');
  const [legacyCity, setLegacyCity] = useState('Θεσσαλονίκη');
  const [migratedAddresses, setMigratedAddresses] = useState<ProjectAddress[]>([]);

  const handleMigrate = () => {
    const migrated = migrateLegacyAddress(legacyAddress, legacyCity);
    setMigratedAddresses(migrated);
  };

  const handleAddAddress = () => {
    const hv = newHierarchy as AddressWithHierarchyValue;
    const city = hv.settlementName || hv.municipalityName || '';
    const partial = {
      street: hv.street || '',
      number: hv.number || undefined,
      city,
      postalCode: hv.postalCode || '',
    };

    const errors = validateAddress(partial);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    const newAddress = createProjectAddress({
      ...partial,
      isPrimary: addresses.length === 0,
      sortOrder: addresses.length,
    });

    setAddresses([...addresses, newAddress]);
    setNewHierarchy({});
    setValidationErrors([]);
  };

  const primaryAddress = getPrimaryAddress(addresses);

  return (
    <div className="container mx-auto py-8 space-y-8 max-w-6xl">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">
          🏢 Enterprise Address System - Demo
        </h1>
        <p className={colors.text.muted}>
          Testing AddressCard, AddressListCard, AddressFormSection
        </p>
        <p className={cn("text-sm mt-1", colors.text.muted)}>
          Pattern: SAP Real Estate, Salesforce CPQ, Microsoft Dynamics
        </p>
      </div>

      {/* Section 1: AddressListCard */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">1. Address List Card</h2>
        <AddressListCard
          addresses={addresses}
          onAddAddress={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
          onEditAddress={(addr) => alert(`Edit: ${addr.street} ${addr.number}`)}
        />
      </section>

      {/* Section 2: Single AddressCard */}
      {primaryAddress && (
        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Primary Address Card</h2>
          <AddressCard
            address={primaryAddress}
            onEdit={(addr) => alert(`Edit: ${formatAddressLine(addr)}`)}
          />
        </section>
      )}

      {/* Section 3: Helper Functions Demo */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">3. Helper Functions</h2>
        <Card>
          <CardHeader>
            <CardTitle>Utility Functions Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">getPrimaryAddress()</h3>
              <pre className="bg-muted p-3 rounded text-xs">
                {JSON.stringify(primaryAddress, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold mb-2">formatAddressLine()</h3>
              {primaryAddress && (
                <p className="text-sm bg-muted p-3 rounded">
                  {formatAddressLine(primaryAddress)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Section 4: Legacy Migration Demo */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">4. Legacy Migration</h2>
        <Card>
          <CardHeader>
            <CardTitle>migrateLegacyAddress()</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Legacy Address</label>
                <input
                  type="text"
                  value={legacyAddress}
                  onChange={(e) => setLegacyAddress(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Legacy City</label>
                <input
                  type="text"
                  value={legacyCity}
                  onChange={(e) => setLegacyCity(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded"
                />
              </div>
            </div>

            <Button onClick={handleMigrate}>
              Migrate to New Format
            </Button>

            {migratedAddresses.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Migrated Result:</h3>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto">
                  {JSON.stringify(migratedAddresses, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Section 5: AddressFormSection */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">5. Add New Address</h2>
        <Card>
          <CardHeader>
            <CardTitle>AddressFormSection Component</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddressFormSection
              value={newHierarchy}
              onChange={setNewHierarchy}
            />

            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm font-semibold text-red-800 mb-1">Errors:</p>
                <ul className="text-sm text-red-700 list-disc list-inside">
                  {validationErrors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button onClick={handleAddAddress} className="w-full">
              Προσθήκη Διεύθυνσης
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <div className={cn("pt-8 border-t border-border text-center text-sm", colors.text.muted)}>
        <p>🏢 Enterprise Address System - v1.0.0</p>
        <p className="mt-1">
          Pattern: SAP/Salesforce/Microsoft Dynamics | Created: 2026-02-02
        </p>
      </div>
    </div>
  );
}
