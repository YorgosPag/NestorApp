'use client';

/**
 * @fileoverview Company Setup — Entity Type Selector
 * @description Radix Select: Ατομική / ΟΕ (+ disabled ΕΠΕ, ΑΕ)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-012 OE Partnership Support
 * @compliance CLAUDE.md — ADR-001 Radix Select, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EntityType } from '../../types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface EntityTypeSelectorProps {
  value: EntityType;
  onChange: (entityType: EntityType) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function EntityTypeSelector({ value, onChange }: EntityTypeSelectorProps) {
  const { t } = useTranslation('accounting');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('setup.entityType.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <fieldset className="space-y-2">
          <Label htmlFor="entityType">{t('setup.entityType.label')}</Label>
          <Select
            value={value}
            onValueChange={(v) => onChange(v as EntityType)}
          >
            <SelectTrigger id="entityType" className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sole_proprietor">
                {t('setup.entityType.types.sole_proprietor')}
              </SelectItem>
              <SelectItem value="oe">
                {t('setup.entityType.types.oe')}
              </SelectItem>
              <SelectItem value="epe" disabled>
                {t('setup.entityType.types.epe')}
              </SelectItem>
              <SelectItem value="ae" disabled>
                {t('setup.entityType.types.ae')}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {t('setup.entityType.hint')}
          </p>
        </fieldset>
      </CardContent>
    </Card>
  );
}
