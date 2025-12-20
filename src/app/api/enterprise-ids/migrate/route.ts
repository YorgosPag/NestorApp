/**
 * 🚀 ENTERPRISE ID MIGRATION API ENDPOINT
 *
 * ✅ PURE HTTP: μόνο Request/Response (40 γραμμές)
 * ✅ NO DUPLICATES: όλη η λογική στον MigrationController
 * ✅ CLEAN: Route → Controller pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { MigrationPhase, type MigrationStats } from '@/services/enterprise-id-migration.service';
import { EntityType, isValidEntityType } from '@/services/relationships/enterprise-relationship-engine.contracts';
import { MigrationController, type MigrationConfig } from './migration-controller';

const controller = new MigrationController();

export async function GET(): Promise<NextResponse> {
  try {
    const { stats, phase } = controller.getMigrationStatus();
    return NextResponse.json({ success: true, message: 'Status retrieved', stats, phase });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Failed to get status',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const config: MigrationConfig = {
      phase: body.phase || MigrationPhase.DUAL_SUPPORT,
      entityTypes: validateEntityTypes(body.entityTypes || ['company', 'project', 'building', 'unit', 'contact']),
      dryRun: body.dryRun || false,
      batchSize: body.batchSize || 10
    };

    const result = await controller.executeMigration(config);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Migration failed',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  }
}

function validateEntityTypes(types: readonly string[]): readonly EntityType[] {
  return types.filter((type): type is EntityType => isValidEntityType(type));
}