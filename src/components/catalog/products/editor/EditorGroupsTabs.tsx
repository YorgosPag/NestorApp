'use client';
/**
 * **Καρτέλες ανά ομάδα ιδιοτήτων**, με μετρητή ευρημάτων στην καρτέλα (ADR-923 §5.10.4 Β3, Akeneo attribute groups).
 *
 * @module components/catalog/products/editor/EditorGroupsTabs
 */

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { CatalogValueHolder } from '@/subapps/catalog/types/product';
import type { InheritanceLink, ResolvedValues } from '@/subapps/catalog/values/resolve-inherited';

import { issuesUnder } from '../../shared/CatalogIssues';
import { useCatalogText } from '../../shared/catalog-ui-hooks';
import type { ValueEditorEnv } from '../../values/value-editor-types';
import type { ListScope } from '../ProductListToolbar';
import { AttributeValueField } from './AttributeValueField';
import type { EditorGroupPlan } from './editor-layout';

export interface EditorGroupsTabsProps {
  readonly plan: readonly EditorGroupPlan[];
  readonly active: string;
  readonly onActive: (groupId: string) => void;
  readonly holder: CatalogValueHolder;
  readonly resolved: ResolvedValues;
  readonly chain: readonly InheritanceLink[];
  readonly depth: number;
  readonly scope: ListScope;
  readonly env: ValueEditorEnv;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
  readonly nameOf: (link: InheritanceLink) => string;
  readonly onHolder: (holder: CatalogValueHolder) => void;
  readonly onOpen: (id: string) => void;
}

function issueCount(group: EditorGroupPlan, issues: readonly CatalogIssue[]): number {
  return group.fields.reduce((sum, field) =>
    sum + issuesUnder(issues, `values.${field.attributeId}`).length + issuesUnder(issues, `noValueReasons.${field.attributeId}`).length, 0);
}

export function EditorGroupsTabs(props: EditorGroupsTabsProps) {
  const { text } = useCatalogText();
  return (
    <Tabs value={props.active} onValueChange={props.onActive}>
      <TabsList className="flex-wrap">
        {props.plan.map((group) => {
          const count = issueCount(group, props.issues);
          return (
            <TabsTrigger key={group.groupId} value={group.groupId}>
              {group.group ? text(group.group.labels, group.group.code) : group.groupId}
              {count > 0 ? <Badge variant="destructive" className="ml-1">{count}</Badge> : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {props.plan.map((group) => (
        <TabsContent key={group.groupId} value={group.groupId} className="grid">
          {group.fields.map((field) => {
            const owner = field.ownerDepth < props.depth ? props.chain[field.ownerDepth] : null;
            return (
              <AttributeValueField key={field.attributeId} attributeId={field.attributeId} attribute={field.attribute}
                required={field.requiredChannels.includes(props.scope.channel)} isAxis={field.isAxis}
                holder={props.holder} resolved={props.resolved} scope={props.scope} env={props.env} issues={props.issues}
                inheritedFrom={owner ? { id: owner.id, name: props.nameOf(owner) } : null}
                disabled={props.disabled} onHolder={props.onHolder} onOpen={props.onOpen} />
            );
          })}
        </TabsContent>
      ))}
    </Tabs>
  );
}
