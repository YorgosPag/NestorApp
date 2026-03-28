/**
 * @module reports/sections/executive/types
 * @enterprise ADR-265 Phase 4 — Executive Summary shared types
 */

import type { RAGStatus } from '@/components/reports/core';

// ---------------------------------------------------------------------------
// Project Health (RAG table)
// ---------------------------------------------------------------------------

export interface ProjectHealthRow {
  id: string;
  name: string;
  progress: number;
  cpi: number;
  spi: number;
  cpiHealth: RAGStatus;
  spiHealth: RAGStatus;
  overallHealth: RAGStatus;
  budget: number;
}

// ---------------------------------------------------------------------------
// Overdue payments
// ---------------------------------------------------------------------------

export interface OverdueItem {
  unitId: string;
  unitName: string;
  projectName: string;
  buyerName: string;
  amount: number;
  daysOverdue: number;
}

// ---------------------------------------------------------------------------
// Revenue trend
// ---------------------------------------------------------------------------

export interface RevenueTrendPoint {
  month: string;
  label: string;
  revenue: number;
}

// ---------------------------------------------------------------------------
// Pipeline summary
// ---------------------------------------------------------------------------

export interface PipelineStageData {
  stage: string;
  stageLabel: string;
  count: number;
  value: number;
}
