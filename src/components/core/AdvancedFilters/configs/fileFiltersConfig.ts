import type { FilterPanelConfig } from '../types';
import { FL } from './shared';

export const fileFiltersConfig: FilterPanelConfig = {
  title: "filters.filesTitle",
  searchPlaceholder: "filters.placeholders.filesSearch",
  i18nNamespace: "files", // 🏢 ENTERPRISE: Files domain namespace
  rows: [
    {
      id: "files-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: "filters.placeholders.filesSearch",
          ariaLabel: "Search files",
          width: 2,
        },
        {
          id: "category",
          type: "select",
          label: "filters.category",
          placeholder: "filters.placeholders.selectCategory",
          ariaLabel: "File category filter",
          width: 1,
          options: [
            { value: "all", label: "filters.allCategories" },
            { value: "photos", label: "files.categories.photos" },
            { value: "videos", label: "files.categories.videos" },
            { value: "documents", label: "files.categories.documents" },
            { value: "contracts", label: "files.categories.contracts" },
            { value: "floorplans", label: "files.categories.floorplans" },
          ],
        },
        {
          id: "entityType",
          type: "select",
          label: "filters.entityType",
          placeholder: "filters.placeholders.selectEntityType",
          ariaLabel: "Entity type filter",
          width: 1,
          options: [
            { value: "all", label: "filters.allEntityTypes" },
            { value: "project", label: "files.entityTypes.project" },
            { value: "building", label: "files.entityTypes.building" },
            { value: "property", label: "files.entityTypes.property" },
            { value: "contact", label: "files.entityTypes.contact" },
          ],
        },
      ],
    },
    {
      id: "files-details",
      fields: [
        {
          id: "classification",
          type: "select",
          label: "filters.classification",
          placeholder: "filters.placeholders.selectClassification",
          ariaLabel: "Classification filter",
          width: 1,
          options: [
            { value: "all", label: "filters.allClassifications" },
            { value: "public", label: "batch.classification.public" },
            { value: "internal", label: "batch.classification.internal" },
            {
              value: "confidential",
              label: "batch.classification.confidential",
            },
          ],
        },
        {
          id: "fileType",
          type: "select",
          label: "filters.fileType",
          placeholder: "filters.placeholders.selectFileType",
          ariaLabel: "File type filter",
          width: 1,
          options: [
            { value: "all", label: "filters.allFileTypes" },
            { value: "image", label: "filters.fileTypes.images" },
            { value: "pdf", label: "filters.fileTypes.pdf" },
            { value: "video", label: "filters.fileTypes.video" },
            { value: "spreadsheet", label: "filters.fileTypes.spreadsheet" },
            { value: "document", label: "filters.fileTypes.document" },
          ],
        },
        {
          id: "sizeRange",
          type: "range",
          label: "filters.fileSize",
          ariaLabel: "File size range filter",
          width: 1,
          min: 0,
          max: 100, // In MB
        },
        {
          id: "dateRange",
          type: "daterange",
          label: "filters.uploadDate",
          ariaLabel: "Upload date range filter",
          width: 1,
        },
      ],
    },
  ],
};

// File Filter State Interface
export interface FileFilterState {
  [key: string]: unknown;
  searchTerm: string;
  category: string;
  entityType: string;
  classification: string;
  fileType: string;
  sizeRange: { min?: number; max?: number };
  dateRange: { from?: Date; to?: Date };
}

// Default File Filters
export const defaultFileFilters: FileFilterState = {
  searchTerm: "",
  category: "all",
  entityType: "all",
  classification: "all",
  fileType: "all",
  sizeRange: { min: undefined, max: undefined },
  dateRange: { from: undefined, to: undefined },
};
