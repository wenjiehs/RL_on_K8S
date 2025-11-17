import React, { useState } from 'react';
import { Card, Select, Tabs } from 'tdesign-react';
import { DataIcon, ChartIcon } from 'tdesign-icons-react';
import DatasetList from '../components/DatasetList';
import StorageStats from '../components/StorageStats';

const DataManagement: React.FC = () => {
  const [selectedNamespace, setSelectedNamespace] = useState('default');
  const [activeTab, setActiveTab] = useState('datasets');

  const namespaceOptions = [
    { label: 'default', value: 'default' },
    { label: 'ray-test', value: 'ray-test' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Data Management</h2>
        <Select
          value={selectedNamespace}
          onChange={(value) => setSelectedNamespace(value as string)}
          options={namespaceOptions}
          style={{ width: '200px' }}
          placeholder="Select Namespace"
        />
      </div>
      
      <Card bordered={false}>
        <Tabs 
          value={activeTab} 
          onChange={(value) => setActiveTab(value as string)}
          theme="card"
        >
          <Tabs.TabPanel 
            value="datasets" 
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DataIcon />
                <span>Datasets</span>
              </span>
            }
          >
            <div style={{ padding: '16px 0' }}>
              <DatasetList namespace={selectedNamespace} />
            </div>
          </Tabs.TabPanel>
          
          <Tabs.TabPanel 
            value="statistics" 
            label={
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ChartIcon />
                <span>Storage Statistics</span>
              </span>
            }
          >
            <div style={{ padding: '16px 0' }}>
              <StorageStats namespace={selectedNamespace} />
            </div>
          </Tabs.TabPanel>
        </Tabs>
      </Card>
    </div>
  );
};

export default DataManagement;