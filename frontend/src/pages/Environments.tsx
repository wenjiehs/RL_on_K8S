import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, Card, MessagePlugin, Dialog, InputNumber } from 'tdesign-react';
import { AddIcon, RefreshIcon } from 'tdesign-icons-react';
import CreateEnvironmentDialog from '../components/CreateEnvironmentDialog';

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
  const [environments, setEnvironments] = useState<RLEnvironment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [scaleDialogVisible, setScaleDialogVisible] = useState(false);
  const [scaleEnv, setScaleEnv] = useState<RLEnvironment | null>(null);
  const [scaleReplicas, setScaleReplicas] = useState(1);

  const fetchEnvironments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/environments?namespace=default');
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
  }, []);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const handleDelete = async (env: RLEnvironment) => {
    const confirmed = await Dialog.confirm({
      header: 'Delete Environment',
      body: `Are you sure you want to delete environment "${env.name}"? This action cannot be undone.`,
      confirmBtn: 'Delete',
      cancelBtn: 'Cancel',
      theme: 'warning',
    });

    if (!confirmed) return;

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

  const columns = [
    {
      colKey: 'name',
      title: 'Environment Name',
      width: 200,
      cell: ({ row }: { row: RLEnvironment }) => (
        <span style={{ fontWeight: '500', color: 'var(--tc-text-primary)' }}>{row.name}</span>
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
        return (
          <Tag theme={themeMap[row.status] || 'default'} variant="light">
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
      width: 200,
      cell: ({ row }: { row: RLEnvironment }) => (
        <Space size="small">
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
      <Card
        title="Environment Management"
        bordered={false}
        style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
        actions={
          <Space>
            <Button icon={<RefreshIcon />} variant="outline" onClick={fetchEnvironments} loading={loading}>
              Refresh
            </Button>
            <Button icon={<AddIcon />} theme="primary" onClick={() => setShowCreateDialog(true)}>
              Create Environment
            </Button>
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

      <CreateEnvironmentDialog
        visible={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={fetchEnvironments}
      />

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
    </>
  );
};

export default Environments;