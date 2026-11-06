/**
 * @fileoverview Η κατοχή μάρκας (ADR-923 §16): απόδειξη, χειροκίνητη έγκριση, ημερομηνία λήξης.
 * @module subapps/catalog/types/supplier-brand-claim
 *
 * 🔑 **Δύο ερωτήσεις, δύο πεδία.** Το `status` λέει πού βρίσκεται η αίτηση· το `grant` λέει τι δικαίωμα ισχύει. Έτσι μια ανανέωση σε
 *    εξέλιξη, ή μια απορριφθείσα ανανέωση, δεν αφαιρεί μάρκα που ισχύει ακόμη. Ανάκληση σβήνει το `grant`.
 * 🔑 **Η λήξη δεν αποθηκεύεται ως κατάσταση.** Παράγεται από το `validUntil` σε κάθε ανάγνωση, άρα καμία εργασία δεν χρειάζεται να
 *    θυμηθεί κάτι, και η αντιπροσωπεία που λήγει πέφτει μόνη της.
 */

export const SUPPLIER_BRAND_RELATIONS = ['manufacturer', 'authorized-representative'] as const;
export type SupplierBrandRelation = (typeof SUPPLIER_BRAND_RELATIONS)[number];

export const SUPPLIER_BRAND_CLAIM_STATUSES = ['pending-review', 'approved', 'rejected', 'revoked'] as const;
export type SupplierBrandClaimStatus = (typeof SUPPLIER_BRAND_CLAIM_STATUSES)[number];

export const MAX_BRAND_NAME_LENGTH = 120;

/** Τα σκαλιά της ειδοποίησης πριν από τη λήξη (§16): το ίδιο λεξιλόγιο με το μητρώο λήξεων, χωρίς `lead` και `missing`. */
export const BRAND_EXPIRY_NOTICE_STAGES = ['d30', 'd7', 'd0', 'expired'] as const;
export type BrandExpiryNoticeStage = (typeof BRAND_EXPIRY_NOTICE_STAGES)[number];

export interface SupplierBrandGrant {
  readonly relation: SupplierBrandRelation;
  readonly validUntil: string;
  readonly grantedAt: string;
  readonly grantedBy: string;
  /**
   * Το πιο επείγον σκαλί που έχει ήδη ειπωθεί για **αυτό** το δικαίωμα. Ζει μέσα στο `grant`, άρα η ανανέωση (νέο `grant`)
   * ξαναρχίζει μόνη της και η ανάκληση το σβήνει μαζί του. Απόν ⇒ τίποτα δεν ειπώθηκε.
   */
  readonly expiryNotice?: BrandExpiryNoticeStage;
}

/** `supplier_brand_claims/{id}`: ένα έγγραφο ανά (χώρος, μάρκα). Νέα αίτηση για την ίδια μάρκα το ξαναγράφει. */
export interface SupplierBrandClaimRecord {
  readonly id: string;
  readonly companyId: string;
  readonly brandName: string;
  /** Κανονικοποιημένο όνομα: εδώ κρίνεται αν «Toshiba» και « TOSHIBA » είναι η ίδια μάρκα. */
  readonly brandKey: string;
  readonly relation: SupplierBrandRelation;
  readonly evidenceFileId: string;
  readonly status: SupplierBrandClaimStatus;
  readonly grant: SupplierBrandGrant | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
  readonly reviewNote: string | null;
}

/** Ό,τι φτάνει στο κοινό. Κανένα αρχείο, καμία ημερομηνία, καμία σημείωση. */
export interface PublicSupplierBrand {
  readonly brandName: string;
  readonly relation: SupplierBrandRelation;
}
