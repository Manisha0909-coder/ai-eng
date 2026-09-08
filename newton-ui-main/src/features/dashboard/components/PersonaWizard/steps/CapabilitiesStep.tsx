import { Check, FileText, LayoutDashboard, Wrench, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { DashboardPill } from '../../DashboardPill';
import { ToolRuleEditor } from '../../ToolRuleEditor';
import { FieldGroup } from '../FieldGroup';
import type { PersonaFormState } from '../personaWizardTypes';
import type { ToolRuleTool } from '@/services/rbac/rbacApi';
import { cn } from '@/lib/utils';

interface CapabilitiesStepProps {
  formData: PersonaFormState;
  setFormData: React.Dispatch<React.SetStateAction<PersonaFormState>>;
  isVersionMode: boolean;
  loadingDataSources: boolean;
  dataSourceOptions: string[];
  selectedDataSourceIds: string[];
  selectedDataSourceNames: string[];
  dataSourceNameMap: Record<string, string>;
  removeDataSource: (id: string) => void;
  handleDataSourceSelect: (value: string | string[]) => void;
  toolTagOptions: string[];
  selectedToolTagIds: number[];
  selectedToolTagNames: string[];
  toolTagNameMap: Record<number, string>;
  removeToolTag: (id: number) => void;
  handleToolTagSelect: (value: string | string[]) => void;
  documentTagOptions: string[];
  selectedDocumentTagIds: number[];
  selectedDocumentTagNames: string[];
  documentTagNameMap: Record<number, string>;
  removeDocumentTag: (id: number) => void;
  handleDocumentTagSelect: (value: string | string[]) => void;
  availableToolsForRules: ToolRuleTool[];
  ruleTypes: string[];
}

function ChipBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border-main bg-background px-2 py-0.5 text-[11px] text-text-main">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-surface"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function CapabilitiesStep({
  formData,
  setFormData,
  isVersionMode,
  loadingDataSources,
  dataSourceOptions,
  selectedDataSourceIds,
  selectedDataSourceNames,
  dataSourceNameMap,
  removeDataSource,
  handleDataSourceSelect,
  toolTagOptions,
  selectedToolTagIds,
  selectedToolTagNames,
  toolTagNameMap,
  removeToolTag,
  handleToolTagSelect,
  documentTagOptions,
  selectedDocumentTagIds,
  selectedDocumentTagNames,
  documentTagNameMap,
  removeDocumentTag,
  handleDocumentTagSelect,
  availableToolsForRules,
  ruleTypes,
}: CapabilitiesStepProps) {
  const summaryItems: string[] = [];
  if (formData.supports_documents) {
    summaryItems.push('Document attachments enabled');
  }
  if (selectedToolTagNames.length > 0) {
    summaryItems.push(
      `Tools: ${selectedToolTagNames.join(', ')} (${selectedToolTagNames.length} tag${selectedToolTagNames.length === 1 ? '' : 's'})`
    );
  }
  if (selectedDocumentTagNames.length > 0) {
    summaryItems.push(`Documents restricted to: ${selectedDocumentTagNames.join(', ')}`);
  }
  if (formData.type === 'dashboard' && selectedDataSourceNames.length > 0) {
    summaryItems.push(`Data source${selectedDataSourceNames.length === 1 ? '' : 's'}: ${selectedDataSourceNames.join(', ')}`);
  }
  if (formData.toolRules.length > 0) {
    summaryItems.push(`${formData.toolRules.length} tool rule${formData.toolRules.length === 1 ? '' : 's'} configured`);
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() =>
          setFormData((p) => ({ ...p, supports_documents: !p.supports_documents }))
        }
        className={cn(
          'flex w-full items-center gap-4 p-4 rounded-xl border text-left transition-colors',
          formData.supports_documents
            ? 'border-primary bg-primary/5'
            : 'border-border-main bg-surface-2/40'
        )}
        aria-pressed={formData.supports_documents}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold text-text-main">Supports Documents</p>
          <p className="text-xs text-text-muted mt-0.5">
            Allow users to upload and attach documents to conversations with this persona.
          </p>
        </div>
        <span
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
            formData.supports_documents ? 'bg-primary' : 'bg-border-main'
          )}
        >
          <span
            className={cn(
              'absolute h-4 w-4 rounded-full bg-white shadow transition-transform',
              formData.supports_documents ? 'translate-x-4' : 'translate-x-0.5'
            )}
          />
        </span>
      </button>

      <FieldGroup
        label="Tool tags"
        hint="Only tools with these tags will be available to this persona."
      >
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedToolTagIds.length > 0 ? (
            selectedToolTagIds.map((id) => (
              <DashboardPill
                key={id}
                intent="entity"
                entity="tool-tag"
                label={
                  <>
                    {toolTagNameMap[id] || `Tag #${id}`}
                    <button
                      type="button"
                      onClick={() => removeToolTag(id)}
                      className="ml-0.5 rounded-full p-0.5 hover:opacity-70"
                      aria-label="Remove tool tag"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                }
              />
            ))
          ) : (
            <span className="text-[11px] text-text-muted">No tool tags selected</span>
          )}
        </div>
        <Combobox
          items={toolTagOptions}
          placeholder="Search and select tool tags..."
          onSelect={handleToolTagSelect}
          defaultValue={selectedToolTagNames}
          className="text-text-main border-border-main"
        />
      </FieldGroup>

      <FieldGroup
        label="Document tags"
        hint="Restricts the document index visible to this persona during search."
      >
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedDocumentTagIds.length > 0 ? (
            selectedDocumentTagIds.map((id) => (
              <DashboardPill
                key={id}
                intent="entity"
                entity="doc-tag"
                label={
                  <>
                    {documentTagNameMap[id] || `Tag #${id}`}
                    <button
                      type="button"
                      onClick={() => removeDocumentTag(id)}
                      className="ml-0.5 rounded-full p-0.5 hover:opacity-70"
                      aria-label="Remove document tag"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                }
              />
            ))
          ) : (
            <span className="text-[11px] text-text-muted">No document tags selected</span>
          )}
        </div>
        <Combobox
          items={documentTagOptions}
          placeholder="Search and select document tags..."
          onSelect={handleDocumentTagSelect}
          defaultValue={selectedDocumentTagNames}
          dropdownPlacement="top"
          className="text-text-main border-border-main"
        />
      </FieldGroup>

      {formData.type === 'dashboard' && (
        <div className="rounded-xl border border-border-main overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-2/60 border-b border-border-main">
            <LayoutDashboard className="h-[13px] w-[13px] text-accent" />
            <span className="text-xs font-semibold text-text-main">Dashboard only</span>
            <span className="ml-auto text-2xs text-text-muted">
              Visible because type = Dashboard
            </span>
          </div>
          <div className="px-4 py-4">
            <FieldGroup
              label="Data sources"
              hint="Data sources the dashboard persona can query for structured output."
            >
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedDataSourceIds.length > 0 ? (
                  selectedDataSourceIds.map((id) => (
                    <ChipBadge
                      key={id}
                      label={dataSourceNameMap[id] || id}
                      onRemove={() => removeDataSource(id)}
                    />
                  ))
                ) : (
                  <span className="text-[11px] text-text-muted">No data sources selected</span>
                )}
              </div>
              {loadingDataSources ? (
                <div className="text-xs text-text-muted">Loading data sources…</div>
              ) : (
                <Combobox
                  items={dataSourceOptions}
                  placeholder="Search and select data sources..."
                  onSelect={handleDataSourceSelect}
                  defaultValue={selectedDataSourceNames}
                  className="text-text-main border-border-main"
                />
              )}
            </FieldGroup>
          </div>
        </div>
      )}

      {(formData.type === 'dashboard' || formData.supports_documents) && (
        <div className="rounded-xl border border-border-main bg-surface-2/40 p-3">
          <Label className="text-2xs font-semibold uppercase tracking-wider text-text-muted">
            Auto-attached capabilities
          </Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {formData.type === 'dashboard' && (
              <DashboardPill
                intent="entity"
                entity="tool-tag"
                label={
                  <>
                    <Wrench className="h-2.5 w-2.5" /> Dashboard Tools (auto)
                  </>
                }
                className="text-2xs"
              />
            )}
            {formData.supports_documents && (
              <DashboardPill
                intent="entity"
                entity="doc-tag"
                label={
                  <>
                    <FileText className="h-2.5 w-2.5" /> Document Tools (auto)
                  </>
                }
                className="text-2xs"
              />
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-medium text-text-main">
          Tool rules
          <span className="ml-1.5 text-xs text-text-muted font-normal">
            (optional{isVersionMode ? ' — leave empty to inherit from previous version' : ''})
          </span>
        </Label>
        <ToolRuleEditor
          rules={formData.toolRules}
          availableTools={availableToolsForRules}
          ruleTypes={ruleTypes}
          onChange={(rules) => setFormData((p) => ({ ...p, toolRules: rules }))}
        />
      </div>

      {summaryItems.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 flex gap-3">
          <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary mb-1">Capabilities summary</p>
            <ul className="space-y-0.5">
              {summaryItems.map((item) => (
                <li
                  key={item}
                  className="text-2xs text-text-muted flex gap-1.5"
                >
                  <span className="text-status-success">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
