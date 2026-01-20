'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { CheckCircle, Ruler, TrendingUp } from 'lucide-react';
import { getThemeVariant } from '@/components/ui/theme/ThemeComponents';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 ENTERPRISE: Centralized Unit Icon
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;

import { GeneralProjectHeader } from '../GeneralProjectHeader';
import { BasicProjectInfoTab } from '../BasicProjectInfoTab';
import { PermitsAndStatusTab } from '../PermitsAndStatusTab';
import { ProjectAttachmentsTab } from '../ProjectAttachmentsTab';
import { ProjectStructureTab } from '../tabs/ProjectStructureTab';
import MapTabContent from '../../building-management/tabs/MapTabContent';

import { useProjectStats } from './hooks/useProjectStats';
import { useAutosave } from './hooks/useAutosave';
import { StatCard } from './parts/StatCard';
import { ProjectCustomersTable } from './parts/ProjectCustomersTable';
import { ProjectBuildingsCard } from './parts/ProjectBuildingsCard';
import type { GeneralProjectTabProps } from './types';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function GeneralProjectTab({ project }: GeneralProjectTabProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const [isEditing, setIsEditing] = useState(false);
  const [projectData, setProjectData] = useState({
    name: project.name,
    licenseTitle: project.title,
    description: t('generalTab.defaultDescription'),
    buildingBlock: '10',
    protocolNumber: '',
    licenseNumber: '5142/24-10-2001',
    issuingAuthority: '',
    status: project.status,
    showOnWeb: false,
    mapPath: '\\\\Server\\shared\\6. erga\\Eterpis_Gen\\Eterp_Gen_Images\\Eterp_Xartis.jpg',
    floorPlanPath: '\\\\Server\\shared\\6. erga\\TEST\\SSSSSS.pdf',
    percentagesPath: '\\\\Server\\shared\\6. erga\\TEST\\SSSSSSSS.xls',
    companyName: project.companyName,
  });

  const { stats, loading: loadingStats } = useProjectStats(project.id);
  const { autoSaving, lastSaved, setDirty } = useAutosave(projectData, isEditing);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProjectData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setDirty();
  };

  useEffect(() => {
    setProjectData(prev => ({ 
      ...prev, 
      name: project.name, 
      licenseTitle: project.title, 
      status: project.status, 
      companyName: project.companyName 
    }));
  }, [project]);

  const handleSave = () => {
    setIsEditing(false);
    console.log("Saving data...", projectData);
    // In a real app, you would call the update service here
  };

  const salesPercentage = stats && stats.totalUnits > 0 ? (stats.soldUnits / stats.totalUnits) * 100 : 0;
  const availableUnits = stats ? stats.totalUnits - stats.soldUnits : 0;

  // Get centralized theme configuration
  const themeConfig = getThemeVariant('default');

  return (
    <>
      <GeneralProjectHeader
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        autoSaving={autoSaving}
        lastSaved={lastSaved}
        handleSave={handleSave}
        projectCode={project.projectCode}
        projectId={project.id}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 my-6">
        <StatCard
          icon={UnitIcon}
          value={loadingStats ? '...' : stats?.totalUnits ?? 0}
          label={t('generalTab.totalUnits')}
          loading={loadingStats}
          colorClass="bg-blue-600 text-white"
        />
        <StatCard
          icon={CheckCircle}
          value={loadingStats ? '...' : stats?.soldUnits ?? 0}
          label={t('generalTab.soldUnits')}
          loading={loadingStats}
          colorClass="bg-green-600 text-white"
        />
        <StatCard
          icon={Ruler}
          value={loadingStats ? '...' : `${(stats?.totalSoldArea ?? 0).toLocaleString('el-GR')} m²`}
          label={t('generalTab.totalSoldArea')}
          loading={loadingStats}
          colorClass="bg-purple-600 text-white"
        />
        <StatCard
          icon={TrendingUp}
          value={loadingStats ? '...' : `${salesPercentage.toFixed(1)}%`}
          label={t('generalTab.salesPercentage')}
          loading={loadingStats}
          colorClass="bg-orange-600 text-white"
          subtitle={loadingStats ? '' : t('generalTab.availableUnits', { count: availableUnits })}
        />
      </div>

      {!loadingStats && stats && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{t('generalTab.salesProgress')}</span>
                <span>{t('generalTab.unitsProgress', { sold: stats.soldUnits, total: stats.totalUnits })}</span>
              </div>
              <ThemeProgressBar
                progress={salesPercentage}
                label={t('generalTab.salesProgress')}
                size="md"
                showPercentage={false}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{t('generalTab.percentageComplete', { percentage: salesPercentage.toFixed(1) })}</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="basic-info" className="w-full">
        <TabsList className="flex flex-wrap gap-2 w-full h-auto min-h-fit">
          <TabsTrigger value="basic-info" className={themeConfig.tabTrigger}>{t('generalTab.tabs.basicInfo')}</TabsTrigger>
          <TabsTrigger value="structure" className={themeConfig.tabTrigger}>{t('generalTab.tabs.structure')}</TabsTrigger>
          <TabsTrigger value="location" className={themeConfig.tabTrigger}>{t('generalTab.tabs.location')}</TabsTrigger>
          <TabsTrigger value="permits" className={themeConfig.tabTrigger}>{t('generalTab.tabs.permits')}</TabsTrigger>
          <TabsTrigger value="attachments" className={themeConfig.tabTrigger}>{t('generalTab.tabs.attachments')}</TabsTrigger>
        </TabsList>

        <TabsContent value="basic-info" className="pt-4">
          <BasicProjectInfoTab
            data={projectData}
            setData={setProjectData}
            isEditing={isEditing}
          />
          {/* 🏢 ENTERPRISE: Κτίρια που ανήκουν στο έργο */}
          <ProjectBuildingsCard projectId={project.id} />
          <ProjectCustomersTable projectId={project.id} />
        </TabsContent>
        
        <TabsContent value="structure" className="pt-4">
          <ProjectStructureTab projectId={project.id} />
        </TabsContent>
        
        <TabsContent value="location" className="pt-4">
          <MapTabContent building={{ 
            name: project.name, 
            address: project.address || '', 
            city: project.city || '' 
          }} />
        </TabsContent>
        
        <TabsContent value="permits" className="pt-4">
          <PermitsAndStatusTab 
            data={projectData}
            setData={setProjectData}
            isEditing={isEditing}
          />
        </TabsContent>
        
        <TabsContent value="attachments" className="pt-4">
          <ProjectAttachmentsTab 
            data={projectData}
            setData={setProjectData}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}