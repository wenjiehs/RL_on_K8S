import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Card, Space, MessagePlugin, Divider } from 'tdesign-react';
import { RefreshIcon, SettingIcon, CloudIcon } from 'tdesign-icons-react';
import ClusterConfigDialog from '../components/ClusterConfigDialog';

interface Node {
  name: string;
  status: string;
  roles: string;
  age: string;
  version: string;
}

const ClusterNodes: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [connected, setConnected] = useState(false);
  const [clusterInfo, setClusterInfo] = useState({ name: 'Not Connected', nodeCount: 0 });

  useEffect(() => {
    checkClusterStatus();
  }, []);

  const checkClusterStatus = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/cluster/status');
      const data = await response.json();
      setConnected(data.connected);
      if (data.connected) {
        fetchNodes();
      }
    } catch (error) {
      console.error('Failed to check cluster status:', error);
    }
  };

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/cluster/nodes');
      const data = await response.json();
      if (response.ok) {
        setNodes(data.nodes || []);
        setConnected(true);
        setClusterInfo({
          name: 'K8s Cluster',
          nodeCount: data.count || 0,
        });
      } else {
        MessagePlugin.error(data.error || 'Failed to fetch nodes');
        setConnected(false);
      }
    } catch (error) {
      MessagePlugin.error('Network error: ' + (error as Error).message);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionSuccess = (nodeList: Node[]) => {
    setNodes(nodeList);
    setConnected(true);
    setClusterInfo({
      name: 'K8s Cluster',
      nodeCount: nodeList.length,
    });
  };

  const columns = [
    {
      colKey: 'name',
      title: 'Node Name',
      width: 280,
      cell: ({ row }: { row: Node }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CloudIcon size="16px" style={{ color: 'var(--tc-primary)' }} />
          <span style={{ fontWeight: '500', color: 'var(--tc-text-primary)' }}>{row.name}</span>
        </div>
      ),
    },
    {
      colKey: 'status',
      title: 'Status',
      width: 120,
      cell: ({ row }: { row: Node }) => (
        <Tag theme={row.status === 'Ready' ? 'success' : 'danger'} variant="light">
          {row.status}
        </Tag>
      ),
    },
    {
      colKey: 'roles',
      title: 'Roles',
      width: 150,
      cell: ({ row }: { row: Node }) => (
        <Tag 
          theme={row.roles.includes('master') || row.roles.includes('control-plane') ? 'primary' : 'default'} 
          variant="outline"
        >
          {row.roles}
        </Tag>
      ),
    },
    {
      colKey: 'version',
      title: 'Kubelet Version',
      width: 150,
      cell: ({ row }: { row: Node }) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>{row.version}</span>
      ),
    },
    {
      colKey: 'age',
      title: 'Created At',
      ellipsis: true,
      cell: ({ row }: { row: Node }) => (
        <span style={{ color: 'var(--tc-text-secondary)', fontSize: '13px' }}>{row.age}</span>
      ),
    },
  ];

  return (
    <>
      {/* Cluster Info Card */}
      {connected && (
        <Card
          bordered={false}
          style={{ 
            borderRadius: '8px', 
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
            <div>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Connected Cluster</div>
              <div style={{ fontSize: '24px', fontWeight: '600' }}>{clusterInfo.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>Total Nodes</div>
              <div style={{ fontSize: '32px', fontWeight: '600' }}>{clusterInfo.nodeCount}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Nodes Table Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CloudIcon size="20px" />
            <span>Cluster Nodes</span>
          </div>
        }
        bordered={false}
        style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
        actions={
          <Space>
            {connected && (
              <Button icon={<RefreshIcon />} variant="outline" onClick={fetchNodes} loading={loading}>
                Refresh
              </Button>
            )}
            <Button icon={<SettingIcon />} theme="primary" onClick={() => setDialogVisible(true)}>
              {connected ? 'Reconfigure' : 'Configure Cluster'}
            </Button>
          </Space>
        }
      >
        {!connected ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
              color: 'var(--tc-text-secondary)',
              background: '#fafafa',
              borderRadius: '8px',
            }}
          >
            <CloudIcon size="64px" style={{ marginBottom: '24px', opacity: 0.15, color: 'var(--tc-primary)' }} />
            <p style={{ fontSize: '18px', marginBottom: '12px', fontWeight: '500', color: 'var(--tc-text-primary)' }}>
              No Cluster Connected
            </p>
            <p style={{ fontSize: '14px', marginBottom: '8px' }}>
              Connect to your Kubernetes cluster to view and manage nodes
            </p>
            <Divider style={{ margin: '24px auto', width: '200px' }} />
            <div style={{ fontSize: '13px', color: 'var(--tc-text-secondary)', marginBottom: '24px' }}>
              <p>You will need:</p>
              <p>• K8s API Server URL</p>
              <p>• Service Account Token</p>
            </div>
            <Button theme="primary" size="large" icon={<SettingIcon />} onClick={() => setDialogVisible(true)}>
              Configure Cluster Connection
            </Button>
          </div>
        ) : (
          <Table
            rowKey="name"
            data={nodes}
            columns={columns}
            stripe
            hover
            bordered={false}
            size="medium"
            loading={loading}
            empty="No nodes found in the cluster"
          />
        )}
      </Card>

      <ClusterConfigDialog
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        onSuccess={handleConnectionSuccess}
      />
    </>
  );
};

export default ClusterNodes;