// 🏢 ENTERPRISE: Import centralized parking table column labels - ZERO HARDCODED VALUES
import { PARKING_TABLE_COLUMN_LABELS } from '@/constants/property-statuses-enterprise';

export const COLUMN_KEYS = [
  "select", "code", "type", "propertyCode", "level", "area", "price",
  "value", "valueWithSyndicate", "status", "owner", "floorPlan",
  "constructedBy", "actions",
] as const;

// ✅ CENTRALIZED: Using PARKING_TABLE_COLUMN_LABELS from central system - ZERO HARDCODED VALUES
export const COLUMNS = [
  { key: "select", label: "" },
  { key: "code", label: PARKING_TABLE_COLUMN_LABELS.CODE },
  { key: "type", label: PARKING_TABLE_COLUMN_LABELS.TYPE },
  { key: "propertyCode", label: PARKING_TABLE_COLUMN_LABELS.PROPERTY_CODE },
  { key: "level", label: PARKING_TABLE_COLUMN_LABELS.LEVEL },
  { key: "area", label: PARKING_TABLE_COLUMN_LABELS.AREA },
  { key: "price", label: PARKING_TABLE_COLUMN_LABELS.PRICE },
  { key: "value", label: PARKING_TABLE_COLUMN_LABELS.VALUE },
  { key: "valueWithSyndicate", label: PARKING_TABLE_COLUMN_LABELS.VALUE_WITH_SYNDICATE },
  { key: "status", label: PARKING_TABLE_COLUMN_LABELS.STATUS },
  { key: "owner", label: PARKING_TABLE_COLUMN_LABELS.OWNER },
  { key: "floorPlan", label: PARKING_TABLE_COLUMN_LABELS.FLOOR_PLAN },
  { key: "constructedBy", label: PARKING_TABLE_COLUMN_LABELS.CONSTRUCTED_BY },
  { key: "actions", label: PARKING_TABLE_COLUMN_LABELS.ACTIONS },
] as const;

export const DEFAULT_COLUMN_WIDTHS = [40,120,100,120,100,80,100,120,180,100,150,150,150,80];
