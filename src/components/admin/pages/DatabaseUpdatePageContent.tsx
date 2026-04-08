'use client';

/**
 * Database Update Admin Page Content
 * @performance ADR-294 Batch 5 — lazy-loaded via LazyRoutes
 * @note Data definitions extracted to database-update-data.ts (SRP)
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Database, Users, Building, Plus, Edit,
  CheckCircle, AlertTriangle,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { createModuleLogger } from '@/lib/telemetry';
import {
  collection, setDoc, doc, serverTimestamp,
  getDocs, query, limit, writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateContactId } from '@/services/enterprise-id.service';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  EXISTING_CONTACT_IDS, NEW_CONTACTS,
  CONTACT_ASSIGNMENTS, STATUS_ASSIGNMENTS
} from './database-update-data';

const logger = createModuleLogger('DatabaseUpdatePage');

export function DatabaseUpdatePageContent() {
  const { t } = useTranslation('admin');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [completed, setCompleted] = useState({
    contacts: false, updates: false, units: false, relationships: false
  });

  if (process.env.NODE_ENV === 'production') {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className={colors.text.muted}>{t('databaseUpdate.productionDisabled')}</p>
      </main>
    );
  }

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    logger.info(message);
  };

  const addNewContacts = async (): Promise<string[]> => {
    addLog(`🔄 ${t('databaseUpdate.logs.addingContacts')}`);
    const addedContactIds: string[] = [];
    try {
      for (const contact of NEW_CONTACTS) {
        const contactData = { ...contact, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: 'database-update-script', lastModifiedBy: 'database-update-script' };
        const contactId = generateContactId();
        await setDoc(doc(db, COLLECTIONS.CONTACTS, contactId), contactData);
        addedContactIds.push(contactId);
        const name = 'firstName' in contact ? contact.firstName : contact.companyName;
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
        batch.update(doc(db, 'contacts', contactId), {
          tags: assignment.tags, updatedAt: serverTimestamp(),
          lastModifiedBy: 'database-update-script', notes: t('databaseUpdate.logs.role', { role: assignment.role })
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

  const updatePropertiesWithNewStatuses = async (): Promise<number> => {
    addLog(`🔄 ${t('databaseUpdate.logs.updatingUnits')}`);
    let updatedCount = 0;
    try {
      const propertiesQuery = query(collection(db, COLLECTIONS.PROPERTIES), limit(20));
      const propertiesSnapshot = await getDocs(propertiesQuery);
      const batch = writeBatch(db);
      const contactIds = Object.keys(CONTACT_ASSIGNMENTS);
      propertiesSnapshot.docs.forEach((propDoc, index) => {
        if (index < contactIds.length) {
          const contactId = contactIds[index];
          if (!(contactId in CONTACT_ASSIGNMENTS)) return;
          const assignment = CONTACT_ASSIGNMENTS[contactId as keyof typeof CONTACT_ASSIGNMENTS];
          const newStatus = STATUS_ASSIGNMENTS[assignment.role];
          const updateData: Record<string, unknown> = { status: newStatus, updatedAt: serverTimestamp() };
          if (assignment.role === 'buyer') { updateData.soldTo = contactId; updateData.saleDate = new Date().toISOString(); }
          else if (assignment.role === 'landowner') { updateData.ownerId = contactId; }
          else if (assignment.role.includes('renter')) { updateData.tenantId = contactId; }
          else if (assignment.role === 'corporate') { updateData.companyId = contactId; }
          batch.update(doc(db, 'properties', propDoc.id), updateData);
          addLog(`  ✅ ${t('databaseUpdate.logs.unitUpdated', { id: propDoc.id, status: newStatus, contactId })}`);
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

  const executeUpdate = async () => {
    setIsLoading(true); setLogs([]);
    setCompleted({ contacts: false, updates: false, units: false, relationships: false });
    try {
      addLog(`🚀 ${t('databaseUpdate.logs.starting')}`);
      await addNewContacts(); setCompleted(prev => ({ ...prev, contacts: true }));
      await updateExistingContacts(); setCompleted(prev => ({ ...prev, updates: true }));
      await updatePropertiesWithNewStatuses(); setCompleted(prev => ({ ...prev, units: true, relationships: true }));
      addLog(`🎉 ${t('databaseUpdate.logs.completed')}`);
    } catch (error) {
      addLog(`💥 ${t('databaseUpdate.logs.error', { error: String(error) })}`);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Database className={`${iconSizes.xl} text-blue-600`} />{t('databaseUpdate.title')}
        </h1>
        <p className={colors.text.muted}>{t('databaseUpdate.subtitle')}</p>
      </div>
      <Separator />
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className={iconSizes.md} />{t('databaseUpdate.roleAssignmentsPreview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(CONTACT_ASSIGNMENTS).slice(0, 9).map(([id, assignment]) => (
              <div key={id} className={`p-3 ${quick.card}`}>
                <div className={cn("font-mono text-xs", colors.text.muted)}>{id.slice(0, 8)}...</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="outline" className="text-xs">{assignment.role}</Badge>
                  <Badge variant="secondary" className="text-xs">{STATUS_ASSIGNMENTS[assignment.role]}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="text-center space-y-4">
        <Button onClick={executeUpdate} disabled={isLoading} size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
          {isLoading
            ? <><Spinner size="small" color="inherit" className="mr-2" />{t('databaseUpdate.button.executing')}</>
            : <><Database className={`mr-2 ${iconSizes.sm}`} />{t('databaseUpdate.button.execute')}</>}
        </Button>
        {isLoading && (
          <div className={cn("flex items-center justify-center gap-2 text-sm", colors.text.muted)}>
            <AlertTriangle className={iconSizes.sm} />{t('databaseUpdate.browserWarning')}
          </div>
        )}
      </div>
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CheckCircle className={iconSizes.md} />{t('databaseUpdate.executionLogs')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={logs.join('\n')} readOnly className="font-mono text-sm" rows={15} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DatabaseUpdatePageContent;
