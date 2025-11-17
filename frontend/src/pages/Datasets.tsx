import React, { useState } from 'react';
import { Card, Select } from 'tdesign-react';
import DatasetList from '../components/DatasetList';

const Datasets: React.FC = () => {
  const [selectedNamespace, setSelectedNamespace] = useState('default');

  const namespaceOptions = [
    { label: 'default', value: 'default' },
    { label: 'ray-test', value: 'ray-test' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>Dataset Management</h2>
        <Select
          value={selectedNamespace}
          onChange={(value) => setSelectedNamespace(value as string)}
          options={namespaceOptions}
          style={{ width: '200px' }}
          placeholder="Select Namespace"
        />
      </div>
      
      <Card bordered={false}>
        <DatasetList namespace={selectedNamespace} />
      </Card>
    </div>
  );
};

export default Datasets;