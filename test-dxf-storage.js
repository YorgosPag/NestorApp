// Test script for DXF Storage functionality (Phase 4)
import { DxfFirestoreService } from './src/subapps/dxf-viewer/services/dxf-firestore.service.ts';

const testScene = {
  entities: [
    {
      id: 'line_001',
      type: 'line',
      layer: 'Layer1',
      color: '#FF0000',
      visible: true,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 }
    },
    {
      id: 'circle_001',
      type: 'circle',
      layer: 'Layer1',
      color: '#00FF00',
      visible: true,
      center: { x: 50, y: 50 },
      radius: 25
    }
  ],
  layers: {
    'Layer1': {
      name: 'Layer1',
      color: '#FFFFFF',
      visible: true,
      locked: false
    }
  },
  bounds: {
    min: { x: 0, y: 0 },
    max: { x: 100, y: 100 }
  },
  units: 'mm'
};

async function testDxfStorage() {
  console.log('🧪 Testing DXF Storage functionality...');

  const testFileName = 'test-phase4-storage.dxf';
  const fileId = DxfFirestoreService.generateFileId(testFileName);

  try {
    // Test save to Storage
    console.log('📤 Testing save to Storage...');
    const saveSuccess = await DxfFirestoreService.saveToStorage(fileId, testFileName, testScene);

    if (saveSuccess) {
      console.log('✅ Save to Storage successful!');

      // Test load from Storage
      console.log('📥 Testing load from Storage...');
      const loadResult = await DxfFirestoreService.loadFromStorage(fileId);

      if (loadResult) {
        console.log('✅ Load from Storage successful!');
        console.log('📊 Loaded scene stats:', {
          entities: loadResult.scene.entities.length,
          layers: Object.keys(loadResult.scene.layers).length,
          version: loadResult.version
        });
      } else {
        console.error('❌ Load from Storage failed!');
      }

      // Test V2 auto-save
      console.log('🔄 Testing V2 auto-save...');
      const autoSaveSuccess = await DxfFirestoreService.autoSaveV2(fileId, testFileName, testScene);

      if (autoSaveSuccess) {
        console.log('✅ V2 auto-save successful!');
      } else {
        console.error('❌ V2 auto-save failed!');
      }

    } else {
      console.error('❌ Save to Storage failed!');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run test
testDxfStorage().then(() => {
  console.log('🧪 Test complete!');
}).catch(error => {
  console.error('💥 Test crashed:', error);
});