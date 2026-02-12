export type ObligationTransmittalRecipientRole =
  | 'owner'
  | 'buyer'
  | 'contractor'
  | 'subcontractor'
  | 'consultant'
  | 'authority'
  | 'other';

export type ObligationTransmittalChannel =
  | 'email'
  | 'in-app'
  | 'manual'
  | 'courier';

export type ObligationDeliveryStatus =
  | 'pending'
  | 'delivered'
  | 'failed';

export interface ObligationTransmittalRecipient {
  recipientId?: string;
  recipientName: string;
  recipientEmail?: string;
  role: ObligationTransmittalRecipientRole;
  channel: ObligationTransmittalChannel;
}

export interface ObligationIssueProof {
  algorithm: 'sha256';
  pdfSha256: string;
  generatedAt: Date;
  fileName: string;
  byteSize: number;
}

export interface ObligationDistributionEntry {
  recipientName: string;
  recipientEmail?: string;
  role: ObligationTransmittalRecipientRole;
  channel: ObligationTransmittalChannel;
  status: ObligationDeliveryStatus;
  deliveredAt?: Date;
}

export interface ObligationIssueLogEntry {
  id: string;
  transmittalId: string;
  issuedAt: Date;
  issuedBy: string;
  revision: number;
  docNumber: string;
  recipientCount: number;
  proofHash: string;
}

export interface ObligationTransmittal {
  id: string;
  companyId: string;
  obligationId: string;
  projectId?: string;
  buildingId?: string;
  docNumber: string;
  revision: number;
  issuedAt: Date;
  issuedBy: string;
  message?: string;
  recipients: ObligationTransmittalRecipient[];
  deliveryProof: ObligationDistributionEntry[];
  issueProof: ObligationIssueProof;
  createdAt: Date;
  updatedAt: Date;
}

export interface ObligationIssueRequest {
  obligationId: string;
  recipients: ObligationTransmittalRecipient[];
  message?: string;
}

export interface ObligationIssueResult {
  transmittal: ObligationTransmittal;
  issueLogEntry: ObligationIssueLogEntry;
  distribution: ObligationDistributionEntry[];
  pdfData: Uint8Array;
}
