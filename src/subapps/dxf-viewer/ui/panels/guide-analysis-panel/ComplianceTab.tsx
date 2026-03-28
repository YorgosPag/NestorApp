'use client';

/**
 * @module ComplianceTab
 * @description Compliance tab — B93 Building Code + B95 Seismic.
 * @see ADR-189
 */

import React, { useState, useCallback } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n';
import { useGuideState } from '../../../hooks/state/useGuideState';
import { checkBuildingCode, checkSeismicCompliance } from '../../../systems/guides';
import type { BuildingCodeType, SeismicZone, ComplianceResult } from '../../../systems/guides';

const SEISMIC_ZONES: readonly SeismicZone[] = [
  { zone: 'I', pga: 0.12 },
  { zone: 'II', pga: 0.16 },
  { zone: 'III', pga: 0.24 },
  { zone: 'IV', pga: 0.36 },
] as const;

export const ComplianceTab: React.FC = () => {
  const { t } = useTranslation('dxf-viewer');
  const colors = useSemanticColors();
  const { guides } = useGuideState();

  const [codeType, setCodeType] = useState<BuildingCodeType>('generic');
  const [zoneIndex, setZoneIndex] = useState(1); // default Zone II
  const [buildingResult, setBuildingResult] = useState<ComplianceResult | null>(null);
  const [seismicResult, setSeismicResult] = useState<ComplianceResult | null>(null);

  const handleCheck = useCallback(() => {
    const br = checkBuildingCode(guides, codeType);
    const sr = checkSeismicCompliance(guides, SEISMIC_ZONES[zoneIndex]);
    setBuildingResult(br);
    setSeismicResult(sr);
  }, [guides, codeType, zoneIndex]);

  if (guides.length === 0) {
    return (
      <p className={`text-sm ${colors.text.muted} py-6 text-center`}>
        {t('guideAnalysis.compliance.empty')}
      </p>
    );
  }

  return (
    <section className="space-y-3">
      {/* Controls */}
      <div className="grid grid-cols-2 gap-2">
        <fieldset>
          <label className={`text-xs ${colors.text.muted} block mb-1`}>
            {t('guideAnalysis.compliance.buildingCode')}
          </label>
          <Select value={codeType} onValueChange={(v) => setCodeType(v as BuildingCodeType)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="generic">{t('guideAnalysis.compliance.generic')}</SelectItem>
              <SelectItem value="EN">EN</SelectItem>
              <SelectItem value="DIN">DIN</SelectItem>
            </SelectContent>
          </Select>
        </fieldset>
        <fieldset>
          <label className={`text-xs ${colors.text.muted} block mb-1`}>
            {t('guideAnalysis.compliance.seismicZone')}
          </label>
          <Select value={String(zoneIndex)} onValueChange={(v) => setZoneIndex(Number(v))}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t('guideAnalysis.compliance.zoneI')}</SelectItem>
              <SelectItem value="1">{t('guideAnalysis.compliance.zoneII')}</SelectItem>
              <SelectItem value="2">{t('guideAnalysis.compliance.zoneIII')}</SelectItem>
              <SelectItem value="3">{t('guideAnalysis.compliance.zoneIV')}</SelectItem>
            </SelectContent>
          </Select>
        </fieldset>
      </div>

      <Button size="sm" className="w-full" onClick={handleCheck}>
        {t('guideAnalysis.compliance.check')}
      </Button>

      {/* Results */}
      {buildingResult && (
        <ComplianceResultSection result={buildingResult} t={t} />
      )}
      {seismicResult && (
        <ComplianceResultSection result={seismicResult} t={t} />
      )}
    </section>
  );
};

interface ComplianceResultSectionProps {
  result: ComplianceResult;
  t: (key: string) => string;
}

const ComplianceResultSection: React.FC<ComplianceResultSectionProps> = ({ result, t }) => {
  const colors = useSemanticColors();
  return (
  <section className="space-y-1.5">
    {/* Pass/Fail banner */}
    <div className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium ${
      result.passed
        ? 'bg-green-500/10 text-green-500'
        : 'bg-red-500/10 text-red-500'
    }`}>
      {result.passed
        ? <CheckCircle2 className="h-4 w-4" />
        : <XCircle className="h-4 w-4" />}
      <span>{result.standard}: {result.passed ? t('guideAnalysis.compliance.passed') : t('guideAnalysis.compliance.failed')}</span>
    </div>

    {/* Checklist table */}
    <table className="w-full text-xs">
      <thead>
        <tr className={`${colors.text.muted} border-b`}>
          <th className="text-left py-1 font-medium">{t('guideAnalysis.compliance.description')}</th>
          <th className="text-right py-1 font-medium">{t('guideAnalysis.compliance.value')}</th>
          <th className="text-right py-1 font-medium">{t('guideAnalysis.compliance.limit')}</th>
          <th className="text-center py-1 font-medium w-8">{t('guideAnalysis.compliance.status')}</th>
        </tr>
      </thead>
      <tbody>
        {result.checks.map((check, i) => (
          <tr key={i} className="border-b border-border/50">
            <td className="py-1 pr-1">{check.description}</td>
            <td className="text-right py-1 tabular-nums">{check.value?.toFixed(2) ?? '—'}</td>
            <td className="text-right py-1 tabular-nums">{check.limit?.toFixed(2) ?? '—'}</td>
            <td className="text-center py-1">
              {check.status === 'pass'
                ? <CheckCircle2 className="inline h-3.5 w-3.5 text-green-500" />
                : <XCircle className="inline h-3.5 w-3.5 text-red-500" />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
  );
};

ComplianceTab.displayName = 'ComplianceTab';
