// ============================================================================
// FINANCIAL INFORMATION INTERFACES - ENTERPRISE MODULE
// ============================================================================
//
// 💰 Financial relationship details for corporate structures
// Handles ownership, compensation, and financial arrangements
// Part of modular Enterprise relationship types architecture
//
// ============================================================================

/**
 * 💰 Financial Information (for shareholders, etc.)
 *
 * Financial relationship details for corporate structures
 * Handles ownership, compensation, and financial arrangements
 */
export interface FinancialInfo {
  /** 📊 Ownership percentage (for shareholders) */
  ownershipPercentage?: number;

  /** 💰 Salary range/level (for employees) */
  salaryRange?: string;

  /** 💰 Annual compensation (if known/relevant) */
  annualCompensation?: number;

  /** 📈 Stock options/equity grants */
  equityGrants?: number;

  /** 💳 Cost center code */
  costCenter?: string;

  /** 🏦 Payroll department */
  payrollDepartment?: string;

  /** 📋 Contract value (for contractors) */
  contractValue?: number;

  /** 📅 Contract duration */
  contractDuration?: string;

  /** 💸 Billing rate (for consultants) */
  billingRate?: number;

  /** 🏷️ Budget code */
  budgetCode?: string;
}