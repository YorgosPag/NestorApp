'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FolderKanban, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { getProjectsList } from '../../building-services';
import { RealtimeService } from '@/services/realtime';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// 🏢 ENTERPRISE: Type definitions (ZERO any)
interface ProjectOption {
  id: string;
  name: string;
}

interface ProjectSelectorCardProps {
  /** Building ID για update */
  buildingId: string;
  /** Τρέχον projectId (αν υπάρχει) */
  currentProjectId?: string;
  /** Callback μετά από επιτυχές update */
  onProjectChanged?: (newProjectId: string) => void;
  /** Αν είναι σε edit mode */
  isEditing?: boolean;
}

// 🏢 ENTERPRISE: Centralized labels (ZERO hardcoded strings)
const LABELS = {
  CARD_TITLE: 'Σύνδεση με Έργο',
  SELECT_LABEL: 'Ανήκει σε Έργο',
  SELECT_PLACEHOLDER: 'Επιλέξτε έργο...',
  NO_PROJECT: 'Χωρίς έργο',
  SAVE_BUTTON: 'Αποθήκευση',
  SAVING: 'Αποθήκευση...',
  SUCCESS_MESSAGE: 'Το κτίριο συνδέθηκε με το έργο!',
  ERROR_MESSAGE: 'Σφάλμα κατά την αποθήκευση',
  LOADING_PROJECTS: 'Φόρτωση έργων...',
} as const;

/**
 * 🏢 ENTERPRISE: ProjectSelectorCard Component
 *
 * Επιτρέπει τη σύνδεση ενός κτιρίου με ένα έργο.
 * Χρησιμοποιεί Radix Select (ADR-001 canonical) και Firestore για persistence.
 */
export function ProjectSelectorCard({
  buildingId,
  currentProjectId,
  onProjectChanged,
  isEditing = true,
}: ProjectSelectorCardProps) {
  // 🏢 ENTERPRISE: Centralized hooks (ZERO inline styles)
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: State management
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  // 🏢 ENTERPRISE: Initialize with '__none__' if no project (Radix requires non-empty value)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '__none__');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // 🏢 ENTERPRISE: Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      try {
        const projectsData = await getProjectsList();
        setProjects(projectsData);
        console.log(`✅ [ProjectSelectorCard] Loaded ${projectsData.length} projects`);
      } catch (error) {
        console.error('❌ [ProjectSelectorCard] Error loading projects:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // 🏢 ENTERPRISE: Sync with external currentProjectId changes
  useEffect(() => {
    if (currentProjectId !== undefined) {
      // Convert empty/null to '__none__' for Radix Select compatibility
      setSelectedProjectId(currentProjectId || '__none__');
    }
  }, [currentProjectId]);

  // 🏢 ENTERPRISE: Handle project selection
  const handleProjectChange = useCallback((value: string) => {
    setSelectedProjectId(value);
    setSaveStatus('idle');
  }, []);

  // 🏢 ENTERPRISE: Save to Firestore
  const handleSave = useCallback(async () => {
    if (!buildingId) {
      console.error('❌ [ProjectSelectorCard] No buildingId provided');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    try {
      const buildingRef = doc(db, COLLECTIONS.BUILDINGS, buildingId);

      // 🏢 ENTERPRISE: Convert "__none__" back to null for Firestore
      const projectIdToSave = selectedProjectId === '__none__' ? null : selectedProjectId || null;

      await updateDoc(buildingRef, {
        projectId: projectIdToSave,
        updatedAt: new Date().toISOString(),
      });

      console.log(`✅ [ProjectSelectorCard] Building ${buildingId} linked to project ${projectIdToSave}`);
      setSaveStatus('success');

      // 🏢 ENTERPRISE: Dispatch real-time event for Navigation updates
      RealtimeService.dispatchBuildingProjectLinked({
        buildingId,
        previousProjectId: currentProjectId || null,
        newProjectId: projectIdToSave,
        timestamp: Date.now(),
      });

      if (onProjectChanged && projectIdToSave) {
        onProjectChanged(projectIdToSave);
      }

      // Reset success status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('❌ [ProjectSelectorCard] Error saving:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [buildingId, selectedProjectId, onProjectChanged]);

  // 🏢 ENTERPRISE: Check if value changed (using '__none__' for empty values)
  const hasChanges = selectedProjectId !== (currentProjectId || '__none__');

  // 🏢 ENTERPRISE: Get current project name for display
  const currentProjectName = projects.find(p => p.id === currentProjectId)?.name;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderKanban className={iconSizes.md} />
          {LABELS.CARD_TITLE}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project Selector */}
        <fieldset className="space-y-2">
          <Label htmlFor="project-selector">{LABELS.SELECT_LABEL}</Label>

          {loading ? (
            <section className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
              <span>{LABELS.LOADING_PROJECTS}</span>
            </section>
          ) : (
            <Select
              value={selectedProjectId}
              onValueChange={handleProjectChange}
              disabled={!isEditing}
            >
              <SelectTrigger
                id="project-selector"
                className={cn(
                  !isEditing && 'bg-muted',
                  saveStatus === 'success' && getStatusBorder('success'),
                  saveStatus === 'error' && getStatusBorder('error')
                )}
              >
                <SelectValue placeholder={LABELS.SELECT_PLACEHOLDER} />
              </SelectTrigger>
              <SelectContent>
                {/* Option for no project - Radix requires non-empty value */}
                <SelectItem value="__none__">
                  {LABELS.NO_PROJECT}
                </SelectItem>

                {/* Project options */}
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </fieldset>

        {/* Current project info (when not editing) */}
        {!isEditing && currentProjectName && (
          <p className={cn('text-sm', colors.text.muted)}>
            Τρέχον έργο: <strong>{currentProjectName}</strong>
          </p>
        )}

        {/* Save button and status */}
        {isEditing && (
          <footer className="flex items-center justify-between pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              variant={hasChanges ? 'default' : 'outline'}
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className={cn(iconSizes.sm, 'mr-2 animate-spin')} />
                  {LABELS.SAVING}
                </>
              ) : (
                <>
                  <Save className={cn(iconSizes.sm, 'mr-2')} />
                  {LABELS.SAVE_BUTTON}
                </>
              )}
            </Button>

            {/* Status indicators */}
            {saveStatus === 'success' && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className={iconSizes.sm} />
                {LABELS.SUCCESS_MESSAGE}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className={iconSizes.sm} />
                {LABELS.ERROR_MESSAGE}
              </span>
            )}
          </footer>
        )}
      </CardContent>
    </Card>
  );
}

export default ProjectSelectorCard;
