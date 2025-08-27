import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InteractiveMapV1 from './InteractiveMapV1';
import InteractiveMapV2 from './InteractiveMapV2';
import InteractiveMapV3 from './InteractiveMapV3';

export default function InteractiveMapTabs() {
  return (
    <div className="w-full">
      <Tabs defaultValue="v1" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="v1">Версия 1</TabsTrigger>
          <TabsTrigger value="v2">Версия 2</TabsTrigger>
          <TabsTrigger value="v3">Версия 3</TabsTrigger>
        </TabsList>
        
        <TabsContent value="v1">
          <InteractiveMapV1 />
        </TabsContent>
        
        <TabsContent value="v2">
          <InteractiveMapV2 />
        </TabsContent>
        
        <TabsContent value="v3">
          <InteractiveMapV3 />
        </TabsContent>
      </Tabs>
    </div>
  );
}