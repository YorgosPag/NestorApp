
'use client';

import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContactsList } from './ContactsList';

export function ContactsTab() {
  const [filterType, setFilterType] = useState('all');
  
  return (
    <div className="bg-white dark:bg-card rounded-lg shadow">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Επαφές</h2>
            <Tabs value={filterType} onValueChange={setFilterType}>
              <TabsList className="w-auto">
                {['all', 'customers', 'suppliers', 'agents'].map(type => (
                  <TabsTrigger
                    key={type}
                    value={type}
                    className="text-xs data-[state=active]:bg-orange-500 data-[state=active]:text-white hover:bg-orange-100 hover:text-orange-700"
                  >
                    {type === 'all' ? 'Όλες' :
                     type === 'customers' ? 'Πελάτες' :
                     type === 'suppliers' ? 'Προμηθευτές' : 'Μεσίτες'}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Αναζήτηση επαφών..."
                className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Νέα Επαφή
            </button>
          </div>
        </div>
      </div>

      <ContactsList />
    </div>
  );
}
