'use client';

import { safeJsonParse } from '@/lib/json-utils';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CONTACT_INFO, ContactInfoUtils } from '@/config/contact-info-config';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Database,
  Users,
  Building,
  Plus,
  Edit,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('DatabaseUpdatePage');

// Services
import {
  collection,
  setDoc,
  doc,
  serverTimestamp,
  getDocs,
  query,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateContactId } from '@/services/enterprise-id.service';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ============================================================================
// DATA DEFINITIONS
// ============================================================================

// 🏢 ENTERPRISE: Load contact IDs από environment configuration
const getExistingContactIds = (): string[] => {
  const envContactIds = process.env.NEXT_PUBLIC_EXISTING_CONTACT_IDS;
  if (envContactIds) {
    const parsed = safeJsonParse<string[]>(envContactIds, null as unknown as string[]);
    if (parsed !== null) return parsed;
    logger.warn('Invalid EXISTING_CONTACT_IDS format, using fallback');
  }

  // 🏢 ENTERPRISE: Fallback για testing/development
  return [
    '6MkpFeW54dG03cbWUzRf',
    '6vpnjcpN5ICjCyrsUs8x',
    'DBbvKi3DYxBHbDipqfCv',
    'IjTAcUZ3eJm5zT7EA4q7',
    'JIwIiksQwG9469SByKIJ',
    'QpWvu0Jrw4DGxDqFC2xW',
    'SVgqNOX1vLM7gFZO9Vy4',
    'VJpvrADTve31letX5ob7',
    'ZxLWN7HXsZHcMfoozVL5',
    'fdhyCgd9l4cxXX0XhtyG',
    'j1xYkN18jqGMA18c600g',
    'oGHblMcwDKM4SM67mlgN',
    'sx9QlhtQelyE1LZHwBOg',
    'zX0jNOzy0GAmAhUjSdeQ'
  ];
};

// 🏢 ENTERPRISE: Use configurable contact IDs
const EXISTING_CONTACT_IDS = getExistingContactIds();

// Νέες επαφές να προστεθούν
const NEW_CONTACTS = [
  {
    type: 'individual',
    firstName: 'Ελένη',
    lastName: 'Παπαδόπουλος',
    tags: ['οικοπεδούχος', 'αντιπαροχή'],
    status: 'active',
    isFavorite: false,
    emails: [{ email: ContactInfoUtils.generateEmail('Eleni', 'Papadopoulos'), type: 'personal', isPrimary: true }],
    phones: [{ phone: ContactInfoUtils.generatePhone('mobile'), type: 'mobile', isPrimary: true }],
    profession: 'Συνταξιούχος',
    notes: 'Οικοπεδούχος με αντιπαροχή 3 διαμερισμάτων'
  },
  {
    type: 'individual',
    firstName: 'Γιάννης',
    lastName: 'Κωνσταντίνου',
    tags: ['οικοπεδούχος', 'αντιπαροχή'],
    status: 'active',
    isFavorite: false,
    emails: [{ email: ContactInfoUtils.generateEmail('Giannis', 'Konstantinou'), type: 'personal', isPrimary: true }],
    phones: [{ phone: ContactInfoUtils.generatePhone('mobile'), type: 'mobile', isPrimary: true }],
    profession: 'Μηχανικός',
    notes: 'Οικοπεδούχος με αντιπαροχή 2 διαμερισμάτων'
  },
  {
    type: 'individual',
    firstName: 'Μαρία',
    lastName: 'Αλεξάνδρου',
    tags: ['αγοραστής', 'πελάτης'],
    status: 'active',
    isFavorite: true,
    emails: [{ email: ContactInfoUtils.generateEmail('Maria', 'Alexandrou'), type: 'personal', isPrimary: true }],
    phones: [{ phone: ContactInfoUtils.generatePhone('mobile'), type: 'mobile', isPrimary: true }],
    profession: 'Ιατρός',
    notes: 'Αγόρασε διαμέρισμα 85τμ στον 4ο όροφο'
  },
  {
    type: 'company',
    companyName: 'TechStart Solutions',
    tags: ['εταιρεία', 'ενοικιαστής', 'γραφεία'],
    status: 'active',
    isFavorite: true,
    emails: [{ email: CONTACT_INFO.DEMO_EMAIL_BUSINESS, type: 'business', isPrimary: true }],
    phones: [{ phone: ContactInfoUtils.generatePhone('business'), type: 'business', isPrimary: true }],
    industry: 'Τεχνολογία',
    vatNumber: '999888777',
    notes: 'Ενοικιάζει γραφειακό χώρο 150τμ'
  }
];

// Assignments για υπάρχουσες επαφές
const CONTACT_ASSIGNMENTS = {
  '6MkpFeW54dG03cbWUzRf': { role: 'landowner', tags: ['οικοπεδούχος', 'αντιπαροχή'] },
  '6vpnjcpN5ICjCyrsUs8x': { role: 'landowner', tags: ['οικοπεδούχος', 'αντιπαροχή'] },
  'DBbvKi3DYxBHbDipqfCv': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },
  'IjTAcUZ3eJm5zT7EA4q7': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },
  'JIwIiksQwG9469SByKIJ': { role: 'buyer', tags: ['αγοραστής', 'πελάτης'] },
  'QpWvu0Jrw4DGxDqFC2xW': { role: 'long_term_renter', tags: ['ενοικιαστής', 'μακροχρόνια μίσθωση'] },
  'SVgqNOX1vLM7gFZO9Vy4': { role: 'long_term_renter', tags: ['ενοικιαστής', 'μακροχρόνια μίσθωση'] },
  'VJpvrADTve31letX5ob7': { role: 'short_term_renter', tags: ['ενοικιαστής', 'βραχυχρόνια μίσθωση'] },
  'ZxLWN7HXsZHcMfoozVL5': { role: 'short_term_renter', tags: ['ενοικιαστής', 'βραχυχρόνια μίσθωση'] },
  'fdhyCgd9l4cxXX0XhtyG': { role: 'corporate', tags: ['εταιρεία', 'γραφεία'] },
  'j1xYkN18jqGMA18c600g': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'oGHblMcwDKM4SM67mlgN': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'sx9QlhtQelyE1LZHwBOg': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] },
  'zX0jNOzy0GAmAhUjSdeQ': { role: 'prospect', tags: ['προοπτικός', 'ενδιαφέρον'] }
} as const;

// Status mapping
const STATUS_ASSIGNMENTS = {
  'landowner': 'owner-compensation',
  'buyer': 'sold',
  'long_term_renter': 'long-term-rented',
  'short_term_renter': 'short-term-rented',
  'corporate': 'company-owned',
  'prospect': 'for-sale'
} as const;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DatabaseUpdatePage() {
  const { t } = useTranslation('admin');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [completed, setCompleted] = useState({
    contacts: false,
    updates: false,
    units: false,
    relationships: false
  });

  // 🔒 ADR-253: Production guard — database mutations are dev-only
  if (process.env.NODE_ENV === 'production') {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className={colors.text.muted}>{t('databaseUpdate.productionDisabled')}</p>
      </main>
    );
  }

  // ========================================================================
  // UTILITY FUNCTIONS
  // ========================================================================

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    logger.info(message);
  };

  // ========================================================================
  // DATABASE OPERATIONS
  // ========================================================================

  const addNewContacts = async (): Promise<string[]> => {
    addLog(`🔄 ${t('databaseUpdate.logs.addingContacts')}`);

    const addedContactIds: string[] = [];

    try {
      for (const contact of NEW_CONTACTS) {
        const contactData = {
          ...contact,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: 'database-update-script',
          lastModifiedBy: 'database-update-script'
        };

        const contactId = generateContactId();
        await setDoc(doc(db, COLLECTIONS.CONTACTS, contactId), contactData);
        addedContactIds.push(contactId);

        const name = contact.firstName || contact.companyName;
        addLog(`  ✅ ${t('databaseUpdate.logs.contactAdded', { name, id: contactId })}`);
      }

      addLog(`✅ ${t('databaseUpdate.logs.contactsAdded', { count: addedContactIds.length })}`);
      return addedContactIds;

    } catch (error) {
      addLog(`❌ ${t('databaseUpdate.logs.contactAddError', { error: String(error) })}`);
      throw error;
    }
  };

  const updateExistingContacts = async (): Promise<number> => {
    addLog(`🔄 ${t('databaseUpdate.logs.updatingContacts')}`);

    let updatedCount = 0;

    try {
      const batch = writeBatch(db);

      for (const [contactId, assignment] of Object.entries(CONTACT_ASSIGNMENTS)) {
        const contactRef = doc(db, 'contacts', contactId);

        batch.update(contactRef, {
          tags: assignment.tags,
          updatedAt: serverTimestamp(),
          lastModifiedBy: 'database-update-script',
          notes: t('databaseUpdate.logs.role', { role: assignment.role })
        });

        updatedCount++;
        addLog(`  ✅ ${t('databaseUpdate.logs.contactUpdated', { id: contactId, role: assignment.role })}`);
      }

      await batch.commit();
      addLog(`✅ ${t('databaseUpdate.logs.contactsUpdated', { count: updatedCount })}`);

      return updatedCount;

    } catch (error) {
      addLog(`❌ ${t('databaseUpdate.logs.contactUpdateError', { error: String(error) })}`);
      throw error;
    }
  };

  const updateUnitsWithNewStatuses = async (): Promise<number> => {
    addLog(`🔄 ${t('databaseUpdate.logs.updatingUnits')}`);

    let updatedCount = 0;

    try {
      const unitsQuery = query(collection(db, COLLECTIONS.UNITS), limit(20));
      const unitsSnapshot = await getDocs(unitsQuery);

      const batch = writeBatch(db);
      const contactIds = Object.keys(CONTACT_ASSIGNMENTS);

      unitsSnapshot.docs.forEach((unitDoc, index) => {
        if (index < contactIds.length) {
          const contactId = contactIds[index];
          // 🏢 ENTERPRISE: Type-safe access with guard
          if (!(contactId in CONTACT_ASSIGNMENTS)) return;
          const assignment = CONTACT_ASSIGNMENTS[contactId as keyof typeof CONTACT_ASSIGNMENTS];
          const newStatus = STATUS_ASSIGNMENTS[assignment.role];

          // 🏢 ENTERPRISE: Type-safe unit update data with Firebase compatibility
          const updateData: Record<string, unknown> = {
            status: newStatus,
            updatedAt: serverTimestamp()
          };

          if (assignment.role === 'buyer') {
            updateData.soldTo = contactId;
            updateData.saleDate = new Date().toISOString();
          } else if (assignment.role === 'landowner') {
            updateData.ownerId = contactId;
          } else if (assignment.role.includes('renter')) {
            updateData.tenantId = contactId;
          } else if (assignment.role === 'corporate') {
            updateData.companyId = contactId;
          }

          batch.update(doc(db, 'units', unitDoc.id), updateData);

          addLog(`  ✅ ${t('databaseUpdate.logs.unitUpdated', { id: unitDoc.id, status: newStatus, contactId })}`);
          updatedCount++;
        }
      });

      await batch.commit();
      addLog(`✅ ${t('databaseUpdate.logs.unitsUpdated', { count: updatedCount })}`);

      return updatedCount;

    } catch (error) {
      addLog(`❌ ${t('databaseUpdate.logs.unitUpdateError', { error: String(error) })}`);
      throw error;
    }
  };

  // ========================================================================
  // MAIN EXECUTION FUNCTION
  // ========================================================================

  const executeUpdate = async () => {
    setIsLoading(true);
    setLogs([]);
    setCompleted({ contacts: false, updates: false, units: false, relationships: false });

    try {
      addLog(`🚀 ${t('databaseUpdate.logs.starting')}`);

      // Step 1: Add new contacts
      const newContactIds = await addNewContacts();
      setCompleted(prev => ({ ...prev, contacts: true }));

      // Step 2: Update existing contacts
      await updateExistingContacts();
      setCompleted(prev => ({ ...prev, updates: true }));

      // Step 3: Update units and create relationships
      await updateUnitsWithNewStatuses();
      setCompleted(prev => ({ ...prev, units: true, relationships: true }));

      addLog(`🎉 ${t('databaseUpdate.logs.completed')}`);

    } catch (error) {
      addLog(`💥 ${t('databaseUpdate.logs.error', { error: String(error) })}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Database className={`${iconSizes.xl} text-blue-600`} />
          {t('databaseUpdate.title')}
        </h1>
        <p className={colors.text.muted}>
          {t('databaseUpdate.subtitle')}
        </p>
      </div>

      <Separator />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="text-center">
            <Plus className={`${iconSizes.xl} mx-auto ${completed.contacts ? 'text-green-500' : 'text-blue-500'}`} />
            <CardTitle className="text-sm">{t('databaseUpdate.cards.newContacts')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-2xl font-bold">{NEW_CONTACTS.length}</p>
            <p className={cn("text-xs", colors.text.muted)}>{t('databaseUpdate.cards.add')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Edit className={`${iconSizes.xl} mx-auto ${completed.updates ? 'text-green-500' : 'text-orange-500'}`} />
            <CardTitle className="text-sm">{t('databaseUpdate.cards.updates')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-2xl font-bold">{EXISTING_CONTACT_IDS.length}</p>
            <p className={cn("text-xs", colors.text.muted)}>{t('databaseUpdate.cards.contacts')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Building className={`${iconSizes.xl} mx-auto ${completed.units ? 'text-green-500' : 'text-purple-500'}`} />
            <CardTitle className="text-sm">{t('databaseUpdate.cards.units')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-2xl font-bold">~20</p>
            <p className={cn("text-xs", colors.text.muted)}>{t('databaseUpdate.cards.newStatuses')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Users className={`${iconSizes.xl} mx-auto ${completed.relationships ? 'text-green-500' : 'text-red-500'}`} />
            <CardTitle className="text-sm">{t('databaseUpdate.cards.relationships')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-2xl font-bold">~20</p>
            <p className={cn("text-xs", colors.text.muted)}>Contact-Unit</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Assignments Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className={iconSizes.md} />
            {t('databaseUpdate.roleAssignmentsPreview')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(CONTACT_ASSIGNMENTS).slice(0, 9).map(([id, assignment]) => (
              <div key={id} className={`p-3 ${quick.card}`}>
                <div className={cn("font-mono text-xs", colors.text.muted)}>{id.slice(0, 8)}...</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {assignment.role}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {STATUS_ASSIGNMENTS[assignment.role]}
                  </Badge>
                </div>
              </div>
            ))}
            <div className={`p-3 ${quick.card} bg-muted/50 flex items-center justify-center`}>
              <span className={cn("text-sm", colors.text.muted)}>
                {t('databaseUpdate.more', { count: Object.keys(CONTACT_ASSIGNMENTS).length - 9 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="text-center space-y-4">
        <Button
          onClick={executeUpdate}
          disabled={isLoading}
          size="lg"
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          {isLoading ? (
            <>
              <Spinner size="small" color="inherit" className="mr-2" />
              {t('databaseUpdate.button.executing')}
            </>
          ) : (
            <>
              <Database className={`mr-2 ${iconSizes.sm}`} />
              {t('databaseUpdate.button.execute')}
            </>
          )}
        </Button>

        {isLoading && (
          <div className={cn("flex items-center justify-center gap-2 text-sm", colors.text.muted)}>
            <AlertTriangle className={iconSizes.sm} />
            {t('databaseUpdate.browserWarning')}
          </div>
        )}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className={iconSizes.md} />
              {t('databaseUpdate.executionLogs')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={logs.join('\n')}
              readOnly
              className="font-mono text-sm"
              rows={15}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}