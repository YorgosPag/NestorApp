'use client';

import { LaborComplianceService } from '@/services/labor-compliance';
import type { ContributionRates, InsuranceClass } from '@/components/projects/ika/contracts';

interface SaveLaborComplianceConfigWithPolicyInput {
  readonly classes: InsuranceClass[];
  readonly rates: ContributionRates;
  readonly metadata: {
    year: number;
    userId: string;
    sourceCircular: string | null;
    effectiveDate: string;
  };
}

interface SeedLaborComplianceDefaultsWithPolicyInput {
  readonly userId: string;
}

export async function saveLaborComplianceConfigWithPolicy({
  classes,
  rates,
  metadata,
}: SaveLaborComplianceConfigWithPolicyInput): Promise<void> {
  await LaborComplianceService.saveConfig(classes, rates, metadata);
}

export async function seedLaborComplianceDefaultsWithPolicy({
  userId,
}: SeedLaborComplianceDefaultsWithPolicyInput): Promise<boolean> {
  return LaborComplianceService.seedFromDefaults(userId);
}
