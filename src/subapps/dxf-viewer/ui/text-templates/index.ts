/**
 * ADR-344 Phase 7.D — Public barrel for the text-template management UI.
 *
 * Consumers should import the manager via this barrel; the inner files
 * (list / preview / editor / dialogs / hooks) are implementation details.
 */
export { TextTemplateManager } from './TextTemplateManager';
export { TextTemplateList } from './TextTemplateList';
export { TextTemplatePreview } from './preview/TextTemplatePreview';
export { TextTemplateEditorDialog } from './editor/TextTemplateEditorDialog';
export { TextTemplateDeleteDialog } from './TextTemplateDeleteDialog';
export { PlaceholderPicker } from './PlaceholderPicker';
export { useTextTemplates } from './hooks/useTextTemplates';
export { useTextTemplateMutations, TemplateMutationError } from './hooks/useTextTemplateMutations';
export { useTextTemplatePreviewScope } from './hooks/useTextTemplatePreviewScope';
