import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Tag, Space, Card, MessagePlugin, Dialog, DialogPlugin, InputNumber, Select } from 'tdesign-react';
import { AddIcon, RefreshIcon, TerminalIcon } from 'tdesign-icons-react';
import CreateEnvironmentDialog from '../components/CreateEnvironmentDialog';
import WebTerminal from '../components/WebTerminal';

interface RLEnvironment {
  id: string;
  name: string;
  image: string;
  framework: string;
  status: string;
  replicas: number;
  namespace: string;
  createdAt: string;
}

const Environments: React.FC = () => {
  const navigate = useNavigate();
  const [environments, setEnvironments] = useState<RLEnvironment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Debug: 添加调试日志
  const handleCreateClick = () => {
    console.log('Create Environment button clicked!');
    console.log('showCreateDialog before:', showCreateDialog);
    setShowCreateDialog(true);
    console.log('showCreateDialog after:', showCreateDialog);
  };
  const [scaleDialogVisible, setScaleDialogVisible] = useState(false);
  const [scaleEnv, setScaleEnv] = useState<RLEnvironment | null>(null);
  const [scaleReplicas, setScaleReplicas] = useState(1);
  const [selectedNamespace, setSelectedNamespace] = useState('default');
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [terminalEnv, setTerminalEnv] = useState<RLEnvironment | null>(null);

  const namespaceOptions = [
    { label: 'default', value: 'default' },
    { label: 'ray-test', value: 'ray-test' },
  ];

  const fetchEnvironments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/environments?namespace=${selectedNamespace}`);
      if (response.ok) {
        const data = await response.json();
        setEnvironments(data || []);
      } else {
        const error = await response.json();
        MessagePlugin.error(error.error || 'Failed to fetch environments');
      }
    } catch (error) {
      console.error('Failed to fetch environments:', error);
      MessagePlugin.error('Network error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedNamespace]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments, selectedNamespace]);

  const handleDelete = (env: RLEnvironment) => {
    DialogPlugin.confirm({
      header: 'Delete Environment',
      body: `Are you sure you want to delete environment "${env.name}"? This action cannot be undone.`,
      confirmBtn: 'Delete',
      cancelBtn: 'Cancel',
      theme: 'warning',
      onConfirm: async () => {
        try {
          const response = await fetch(
            `http://localhost:8080/api/environments/delete?name=${env.name}&namespace=${env.namespace}&framework=${env.framework}`,
            {
              method: 'DELETE',
            }
          );

          if (response.ok) {
            MessagePlugin.success(`Environment ${env.name} deleted successfully`);
            fetchEnvironments();
          } else {
            const error = await response.json();
            MessagePlugin.error(error.error || 'Failed to delete environment');
          }
        } catch (error) {
          MessagePlugin.error('Network error: ' + (error as Error).message);
        }
      },
    });
  };

  const handleScale = (env: RLEnvironment) => {
    setScaleEnv(env);
    setScaleReplicas(env.replicas);
    setScaleDialogVisible(true);
  };

  const handleScaleSubmit = async () => {
    if (!scaleEnv) return;

    try {
      const response = await fetch(
        `http://localhost:8080/api/environments/scale?name=${scaleEnv.name}&namespace=${scaleEnv.namespace}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            replicas: scaleReplicas,
          }),
        }
      );

      if (response.ok) {
        MessagePlugin.success(`Environment ${scaleEnv.name} scaled to ${scaleReplicas} replicas`);
        setScaleDialogVisible(false);
        fetchEnvironments();
      } else {
        const error = await response.json();
        MessagePlugin.error(error.error || 'Failed to scale environment');
      }
    } catch (error) {
      MessagePlugin.error('Network error: ' + (error as Error).message);
    }
  };

  const handleViewDetail = (env: RLEnvironment) => {
    navigate(`/environments/${env.id}?name=${env.name}&namespace=${env.namespace}&framework=${env.framework}`);
  };

  const handleConnectTerminal = (env: RLEnvironment) => {
    if (env.status !== 'running') {
      MessagePlugin.warning('Only running environments can be connected');
      return;
    }
    if (env.framework !== 'ray') {
      MessagePlugin.warning('Terminal connection is only available for Ray environments');
      return;
    }
    setTerminalEnv(env);
    setTerminalVisible(true);
  };



  const columns = [
    {
      colKey: 'name',
      title: 'Environment Name',
      width: 200,
      cell: ({ row }: { row: RLEnvironment }) => (
        <span 
          style={{ 
            fontWeight: '500', 
            color: 'var(--tc-brand-color)', 
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
          onClick={() => handleViewDetail(row)}
        >
          {row.name}
        </span>
      ),
    },
    {
      colKey: 'status',
      title: 'Status',
      width: 120,
      cell: ({ row }: { row: RLEnvironment }) => {
        const themeMap: Record<string, string> = {
          running: 'success',
          pending: 'warning',
          stopped: 'default',
          error: 'danger',
        };
        const theme = themeMap[row.status] as 'default' | 'warning' | 'danger' | 'success' | 'primary' | undefined;
        return (
          <Tag theme={theme || 'default'} variant="light">
            {row.status}
          </Tag>
        );
      },
    },
    {
      colKey: 'framework',
      title: 'Framework',
      width: 120,
      cell: ({ row }: { row: RLEnvironment }) => (
        <span style={{ textTransform: 'capitalize' }}>{row.framework || 'N/A'}</span>
      ),
    },
    {
      colKey: 'image',
      title: 'Image',
      ellipsis: true,
    },
    {
      colKey: 'replicas',
      title: 'Replicas',
      width: 100,
      cell: ({ row }: { row: RLEnvironment }) => (
        <span style={{ fontWeight: '500' }}>{row.replicas}</span>
      ),
    },
    {
      colKey: 'namespace',
      title: 'Namespace',
      width: 120,
    },
    {
      colKey: 'createdAt',
      title: 'Created At',
      width: 180,
      cell: ({ row }: { row: RLEnvironment }) => (
        <span>{new Date(row.createdAt).toLocaleString()}</span>
      ),
    },
    {
      colKey: 'actions',
      title: 'Actions',
      width: 280,
      cell: ({ row }: { row: RLEnvironment }) => (
        <Space size="small">
          {row.framework === 'ray' && (
            <Button 
              theme="primary" 
              variant="text" 
              size="small" 
              icon={<TerminalIcon />}
              onClick={() => handleConnectTerminal(row)}
              disabled={row.status !== 'running'}
            >
              Terminal
            </Button>
          )}
          <Button theme="primary" variant="text" size="small" onClick={() => handleScale(row)}>
            Scale
          </Button>
          <Button theme="danger" variant="text" size="small" onClick={() => handleDelete(row)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Environment Management</h2>
      </div>

      <Card
        bordered={false}
        style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
        actions={
          <Space>
            <Select
              value={selectedNamespace}
              onChange={(value) => setSelectedNamespace(value as string)}
              options={namespaceOptions}
              style={{ width: '150px' }}
              placeholder="Select Namespace"
            />
            <Button icon={<RefreshIcon />} variant="outline" onClick={fetchEnvironments} loading={loading}>
              Refresh
            </Button>
            <Button icon={<AddIcon />} theme="primary" onClick={handleCreateClick}>
              Create Environment
            </Button>
            <CreateEnvironmentDialog 
              visible={showCreateDialog}
              onClose={() => setShowCreateDialog(false)}
              onSuccess={() => {
                setShowCreateDialog(false);
                fetchEnvironments();
              }}
            />
          </Space>
        }
      >
        <Table
          rowKey="id"
          data={environments}
          columns={columns}
          loading={loading}
          stripe
          hover
          bordered={false}
          size="medium"
          empty="No environments found. Click 'Create Environment' to get started."
        />
      </Card>

      <Dialog
        visible={scaleDialogVisible}
        header="Scale Environment"
        onClose={() => setScaleDialogVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setScaleDialogVisible(false)}>Cancel</Button>
            <Button theme="primary" onClick={handleScaleSubmit}>
              Scale
            </Button>
          </Space>
        }
        width={400}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500' }}>
            Environment: {scaleEnv?.name}
          </div>
          <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--tc-text-secondary)' }}>
            Current replicas: {scaleEnv?.replicas}
          </div>
          <div style={{ marginBottom: '8px', fontWeight: '500' }}>New Replicas:</div>
          <InputNumber
            value={scaleReplicas}
            onChange={(value) => setScaleReplicas(value as number)}
            min={0}
            max={100}
            style={{ width: '100%' }}
          />
        </div>
      </Dialog>

      {terminalEnv && (
        <WebTerminal
          visible={terminalVisible}
          onClose={() => {
            setTerminalVisible(false);
            setTerminalEnv(null);
          }}
          envName={terminalEnv.name}
          namespace={terminalEnv.namespace}
        />
      )}


    </>
  );
};

export default Environments;