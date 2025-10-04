'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContractsTabContent } from './documents/ContractsTabContent';
import { MiscellaneousTabContent } from './documents/MiscellaneousTabContent';

export function DocumentsProjectTab() {
  return (
    <Tabs defaultValue="contracts" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contracts">Συμβόλαια</TabsTrigger>
            <TabsTrigger value="miscellaneous">Διάφορα Έγγραφα</TabsTrigger>
        </TabsList>
        <TabsContent value="contracts" className="pt-4">
            <ContractsTabContent />
        </TabsContent>
        <TabsContent value="miscellaneous" className="pt-4">
            <MiscellaneousTabContent />
        </TabsContent>
    </Tabs>
  );
}
