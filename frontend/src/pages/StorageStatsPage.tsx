import React, { useState } from 'react';
import { Card, Select } from 'tdesign-react';
import StorageStats from '../components/StorageStats';
import { useNamespaces } from '../hooks/useNamespaces';

const StorageStatsPage: React.FC = () => {
  const [selectedNamespace, setSelectedNamespace] = useState('default');
  
  // 使用自定义Hook获取动态命名空间
  const { namespaces: namespaceOptions, loading: namespacesLoading } = useNamespaces();

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
          loading={namespacesLoading}
          filterable
        />
      </div>
      
      <Card bordered={false}>
        <StorageStats namespace={selectedNamespace} />
      </Card>
    </div>
  );
};

export default StorageStatsPage;