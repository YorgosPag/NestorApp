import type { FilterPanelConfig } from '../types';
import {
  COMMON_FILTER_LABELS,
  COMMUNICATION_CHANNELS,
  CRM_PERIOD_LABELS,
  CRM_STAGE_LABELS,
  CRM_STATUS_LABELS,
  FL,
  PRIORITY_LABELS,
  SP,
  TASK_STATUS_LABELS,
  TASK_TIMEFRAME_LABELS,
  TASK_TYPE_LABELS,
  TRIAGE_STATUSES,
} from './shared';

export const communicationsFiltersConfig: FilterPanelConfig = {
  title: "filters.communicationsTitle",
  searchPlaceholder: "filters.placeholders.communicationsSearch",
  i18nNamespace: "filters", // 🏢 ENTERPRISE: Filters domain namespace
  rows: [
    {
      id: "communications-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: "filters.placeholders.communicationsSearch",
          ariaLabel: "Search communications",
          width: 2,
        },
        {
          id: "channel",
          type: "select",
          label: "filters.channel",
          placeholder: "filters.placeholders.selectChannel",
          ariaLabel: "Channel filter",
          width: 1,
          options: [
            { value: "all", label: "filters.allChannels" },
            { value: "email", label: "filters.channels.email" },
            { value: "sms", label: "filters.channels.sms" },
            { value: "telegram", label: "filters.channels.telegram" },
          ],
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          ariaLabel: "Communication status filter",
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_STATUSES },
            { value: "sent", label: "filters.status.sent" },
            { value: "received", label: "filters.status.received" },
            { value: "pending", label: "filters.status.pending" },
            { value: "failed", label: "filters.status.failed" },
          ],
        },
      ],
    },
    {
      id: "communications-date",
      fields: [
        {
          id: "dateFrom",
          type: "date",
          label: "filters.dateFrom",
          ariaLabel: "From date filter",
          width: 1,
        },
        {
          id: "dateTo",
          type: "date",
          label: "filters.dateTo",
          ariaLabel: "To date filter",
          width: 1,
        },
      ],
    },
  ],
};

// Communications Filter State Interface
// 🏢 ENTERPRISE: Added index signature for GenericFilterState compatibility
export interface CommunicationsFilterState {
  [key: string]: unknown;
  searchTerm: string;
  channel: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

// Default Communications Filters
export const defaultCommunicationsFilters: CommunicationsFilterState = {
  searchTerm: "",
  channel: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

// ====================================================================
// [ENTERPRISE] Task Filters Configuration
// For CRM task detail/list surfaces (Pending Subjects)
// ====================================================================
export const taskFiltersConfig: FilterPanelConfig = {
  title: "filters.tasksTitle",
  searchPlaceholder: SP.general,
  i18nNamespace: "filters",
  rows: [
    {
      id: "tasks-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: SP.general,
          width: 2,
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_STATUSES },
            { value: "pending", label: TASK_STATUS_LABELS.pending },
            { value: "in_progress", label: TASK_STATUS_LABELS.in_progress },
            { value: "completed", label: TASK_STATUS_LABELS.completed },
            { value: "cancelled", label: TASK_STATUS_LABELS.cancelled },
          ],
        },
        {
          id: "priority",
          type: "select",
          label: FL.priority,
          placeholder: SP.priority_placeholder,
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_PRIORITIES },
            { value: "low", label: PRIORITY_LABELS.low },
            { value: "medium", label: PRIORITY_LABELS.medium },
            { value: "high", label: PRIORITY_LABELS.high },
            { value: "urgent", label: PRIORITY_LABELS.urgent },
          ],
        },
        {
          id: "type",
          type: "select",
          label: FL.type,
          placeholder: SP.type_placeholder,
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_TYPES },
            { value: "call", label: TASK_TYPE_LABELS.call },
            { value: "email", label: TASK_TYPE_LABELS.email },
            { value: "meeting", label: TASK_TYPE_LABELS.meeting },
            { value: "viewing", label: TASK_TYPE_LABELS.viewing },
            { value: "follow_up", label: TASK_TYPE_LABELS.follow_up },
            { value: "document", label: TASK_TYPE_LABELS.document },
            { value: "other", label: TASK_TYPE_LABELS.other },
          ],
        },
        {
          id: "timeframe",
          type: "select",
          label: FL.timeframe,
          placeholder: "filters.timeframe.all",
          width: 1,
          options: [
            { value: "all", label: "filters.timeframe.all" },
            { value: "overdue", label: TASK_TIMEFRAME_LABELS.overdue },
            { value: "today", label: TASK_TIMEFRAME_LABELS.today },
            { value: "tomorrow", label: TASK_TIMEFRAME_LABELS.tomorrow },
            { value: "week", label: TASK_TIMEFRAME_LABELS.week },
          ],
        },
      ],
    },
  ],
};

// Task Filter State Interface
export interface TaskFilterState {
  [key: string]: unknown;
  searchTerm: string;
  status: string;
  priority: string;
  type: string;
  timeframe: string;
}

// Default Task Filters
export const defaultTaskFilters: TaskFilterState = {
  searchTerm: "",
  status: "all",
  priority: "all",
  type: "all",
  timeframe: "all",
};

// ====================================================================
// [ENTERPRISE] CRM Dashboard Filters Configuration — Salesforce/HubSpot Pattern
// Global filters: Search + Pipeline Stage + Status + Period
// ====================================================================

export interface CrmDashboardFilterState {
  [key: string]: unknown;
  searchTerm: string;
  stage: string;
  status: string;
  period: string;
}

export const defaultCrmDashboardFilters: CrmDashboardFilterState = {
  searchTerm: "",
  stage: "all",
  status: "all",
  period: "all",
};

export const crmDashboardFiltersConfig: FilterPanelConfig = {
  title: "filters.title",
  searchPlaceholder: SP.general,
  i18nNamespace: "filters",
  rows: [
    {
      id: "crm-dashboard-global",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: SP.general,
          ariaLabel: "Search CRM Dashboard",
          width: 2,
        },
        {
          id: "stage",
          type: "select",
          label: FL.stage,
          placeholder: "filters.crmStages.all",
          width: 1,
          options: [
            { value: "all", label: "filters.crmStages.all" },
            {
              value: "initial_contact",
              label: CRM_STAGE_LABELS.initial_contact,
            },
            { value: "qualification", label: CRM_STAGE_LABELS.qualification },
            { value: "viewing", label: CRM_STAGE_LABELS.viewing },
            { value: "proposal", label: CRM_STAGE_LABELS.proposal },
            { value: "negotiation", label: CRM_STAGE_LABELS.negotiation },
            { value: "contract", label: CRM_STAGE_LABELS.contract },
            { value: "closed_won", label: CRM_STAGE_LABELS.closed_won },
            { value: "closed_lost", label: CRM_STAGE_LABELS.closed_lost },
          ],
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: "filters.crmStatus.all",
          width: 1,
          options: [
            { value: "all", label: "filters.crmStatus.all" },
            { value: "active", label: CRM_STATUS_LABELS.active },
            { value: "inactive", label: CRM_STATUS_LABELS.inactive },
            { value: "pending", label: CRM_STATUS_LABELS.pending },
          ],
        },
        {
          id: "period",
          type: "select",
          label: FL.period,
          placeholder: "filters.crmPeriod.all",
          width: 1,
          options: [
            { value: "all", label: "filters.crmPeriod.all" },
            { value: "day", label: CRM_PERIOD_LABELS.day },
            { value: "week", label: CRM_PERIOD_LABELS.week },
            { value: "month", label: CRM_PERIOD_LABELS.month },
            { value: "year", label: CRM_PERIOD_LABELS.year },
          ],
        },
      ],
    },
  ],
};

// ====================================================================
// [ENTERPRISE] AI Inbox Filters Configuration
// ====================================================================

export const aiInboxFiltersConfig: FilterPanelConfig = {
  title: "filters.aiInboxTitle",
  searchPlaceholder: "filters.placeholders.communicationsSearch",
  i18nNamespace: "filters",
  rows: [
    {
      id: "ai-inbox-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: "filters.placeholders.communicationsSearch",
          ariaLabel: "Search AI Inbox",
          width: 2,
        },
        {
          id: "channel",
          type: "select",
          label: "filters.channel",
          placeholder: "filters.placeholders.selectChannel",
          ariaLabel: "AI Inbox channel filter",
          width: 1,
          options: [
            { value: "all", label: "filters.channels.all" },
            {
              value: COMMUNICATION_CHANNELS.EMAIL,
              label: "filters.channels.email",
            },
            {
              value: COMMUNICATION_CHANNELS.SMS,
              label: "filters.channels.sms",
            },
            {
              value: COMMUNICATION_CHANNELS.TELEGRAM,
              label: "filters.channels.telegram",
            },
          ],
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          ariaLabel: "AI Inbox status filter",
          width: 1,
          options: [
            { value: "all", label: "filters.allStatuses" },
            { value: TRIAGE_STATUSES.PENDING, label: "filters.status.pending" },
            {
              value: TRIAGE_STATUSES.APPROVED,
              label: "filters.status.approved",
            },
            {
              value: TRIAGE_STATUSES.REJECTED,
              label: "filters.status.rejected",
            },
          ],
        },
      ],
    },
    {
      id: "ai-inbox-date",
      fields: [
        {
          id: "dateFrom",
          type: "date",
          label: "filters.dateFrom",
          ariaLabel: "AI Inbox from date filter",
          width: 1,
        },
        {
          id: "dateTo",
          type: "date",
          label: "filters.dateTo",
          ariaLabel: "AI Inbox to date filter",
          width: 1,
        },
      ],
    },
  ],
};

export interface AIInboxFilterState {
  [key: string]: unknown;
  searchTerm: string;
  channel: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export const defaultAIInboxFilters: AIInboxFilterState = {
  searchTerm: "",
  channel: "all",
  status: TRIAGE_STATUSES.PENDING,
  dateFrom: "",
  dateTo: "",
};

// ====================================================================
// [ENTERPRISE] Operator Inbox Filters Configuration (UC-009)
// For AI Pipeline Operator Inbox (/admin/operator-inbox)
// ====================================================================
export const operatorInboxFiltersConfig: FilterPanelConfig = {
  title: "filters.operatorInboxTitle",
  searchPlaceholder: "filters.placeholders.communicationsSearch",
  i18nNamespace: "filters",
  rows: [
    {
      id: "operator-inbox-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: "filters.placeholders.communicationsSearch",
          ariaLabel: "Search Operator Inbox",
          width: 2,
        },
        {
          id: "intent",
          type: "select",
          label: "filters.intent",
          placeholder: SP.status_placeholder,
          ariaLabel: "Operator Inbox intent filter",
          width: 1,
          options: [
            { value: "all", label: "filters.allStatuses" },
            {
              value: "appointment_request",
              label: "filters.intents.appointment",
            },
            { value: "invoice", label: "filters.intents.invoice" },
            { value: "defect_report", label: "filters.intents.defectReport" },
            { value: "unknown", label: "filters.intents.unknown" },
          ],
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          ariaLabel: "Operator Inbox status filter",
          width: 1,
          options: [
            { value: "all", label: "filters.allStatuses" },
            { value: "proposed", label: "filters.pipelineStatus.proposed" },
            { value: "approved", label: "filters.status.approved" },
            { value: "rejected", label: "filters.status.rejected" },
          ],
        },
      ],
    },
    {
      id: "operator-inbox-date",
      fields: [
        {
          id: "dateFrom",
          type: "date",
          label: "filters.dateFrom",
          ariaLabel: "Operator Inbox from date filter",
          width: 1,
        },
        {
          id: "dateTo",
          type: "date",
          label: "filters.dateTo",
          ariaLabel: "Operator Inbox to date filter",
          width: 1,
        },
      ],
    },
  ],
};

export interface OperatorInboxFilterState {
  [key: string]: unknown;
  searchTerm: string;
  intent: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export const defaultOperatorInboxFilters: OperatorInboxFilterState = {
  searchTerm: "",
  intent: "all",
  status: "proposed",
  dateFrom: "",
  dateTo: "",
};

// ====================================================================
// [ENTERPRISE] File Manager Filters Configuration
// For central file manager (/files page)
// ====================================================================
