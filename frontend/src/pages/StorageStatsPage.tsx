import React, { useState } from 'react';
import { Card, Select } from 'tdesign-react';
import StorageStats from '../components/StorageStats';

const StorageStatsPage: React.FC = () => {
  const [selectedNamespace, setSelectedNamespace] = useState('default');

  const namespaceOptions = [
    { label: 'default', value: 'default' },
    { label: 'ray-test', value: 'ray-test' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Storage Statistics</h2>
        <Select
          value={selectedNamespace}
          onChange={(value) => setSelectedNamespace(value as string)}
          options={namespaceOptions}
          style={{ width: '200px' }}
          placeholder="Select Namespace"
        />
      </div>
      
      <Card bordered={false}>
        <StorageStats namespace={selectedNamespace} />
      </Card>
    </div>
  );
};

export default StorageStatsPage;