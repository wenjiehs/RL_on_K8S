import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, MessagePlugin, DialogPlugin, Select, Input, Card, Row, Col, Drawer } from 'tdesign-react';
import { AddIcon, RefreshIcon, DeleteIcon, FolderIcon, SearchIcon, BrowseIcon } from 'tdesign-icons-react';
import CreateDatasetDialog from './CreateDatasetDialog';
import FileBrowser from './FileBrowser';

// CFSDataset represents a dataset from CFS filesystem (no CRD dependency)
interface Dataset {
  id: string;
  name: string;
  experimentId: string;
  dataType: string;
  description: string;
  storagePath: string;
  size: number;
  fileCount: number;
  phase: string;
  mountedBy: string[];
  tags: Record<string, string>;
  createdAt: string;
  namespace: string;
}

interface DatasetStats {
  totalDatasets: number;
  totalSize: number;
  typeBreakdown: Record<string, number>;
  sizeBreakdown: Record<string, number>;
  recentUploads?: Dataset[];
}

interface DatasetListProps {
  namespace: string;
}

const DatasetList: React.FC<DatasetListProps> = ({ namespace }) => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filterDataType, setFilterDataType] = useState('');
  const [filterExperimentId, setFilterExperimentId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [browserVisible, setBrowserVisible] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);

  const dataTypeOptions = [
    { label: 'All Types', value: '' },
    { label: 'Raw Data', value: 'raw' },
    { label: 'Training Data', value: 'train' },
    { label: 'Evaluation Data', value: 'eval' },
    { label: 'Model Files', value: 'model' },
  ];

  const dataTypeColors: Record<string, string> = {
    raw: 'warning',
    train: 'primary',
    eval: 'success',
    model: 'purple',
  };

  const fetchDatasets = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch datasets from CFS filesystem (direct file system access, no CRD)
      const params = new URLSearchParams({ namespace });
      if (filterDataType) params.append('dataType', filterDataType);
      if (filterExperimentId) params.append('experimentId', filterExperimentId);

      const response = await fetch(`http://localhost:8080/api/datasets?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDatasets(data || []);
      } else {
        const error = await response.json();
        MessagePlugin.error(error.error || 'Failed to fetch datasets');
      }
    } catch (error) {
      console.error('Failed to fetch datasets:', error);
      MessagePlugin.error('Network error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [namespace, filterDataType, filterExperimentId]);

  const fetchStats = useCallback(async () => {
    try {
      // Fetch statistics from CFS filesystem
      const response = await fetch(`http://localhost:8080/api/datasets/stats?namespace=${namespace}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [namespace]);

  useEffect(() => {
    fetchDatasets();
    fetchStats();
  }, [fetchDatasets, fetchStats]);

  const handleDelete = (dataset: Dataset) => {
    DialogPlugin.confirm({
      header: 'Delete Dataset',
      body: `Are you sure you want to delete dataset "${dataset.name}"? This will permanently delete all files in the directory: ${dataset.storagePath}. This action cannot be undone.`,
      confirmBtn: 'Delete',
      cancelBtn: 'Cancel',
      theme: 'warning',
      onConfirm: async () => {
        try {
          // Delete dataset directory from CFS filesystem
          const response = await fetch(
            `http://localhost:8080/api/datasets/delete?experimentId=${dataset.experimentId}&dataType=${dataset.dataType}`,
            { method: 'DELETE' }
          );

          if (response.ok) {
            MessagePlugin.success(`Dataset ${dataset.name} deleted successfully`);
            fetchDatasets();
            fetchStats();
          } else {
            const error = await response.json();
            MessagePlugin.error(error.error || 'Failed to delete dataset');
          }
        } catch (error) {
          MessagePlugin.error('Network error: ' + (error as Error).message);
        }
      },
    });
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const filteredDatasets = datasets.filter((dataset) => {
    if (searchText && !dataset.name.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    return true;
  });

  const columns = [
    {
      colKey: 'name',
      title: 'Dataset Name',
      width: 200,
      cell: ({ row }: { row: Dataset }) => (
        <Space align="center">
          <FolderIcon style={{ color: 'var(--tc-brand-color)' }} />
          <span style={{ fontWeight: '500' }}>{row.name}</span>
        </Space>
      ),
    },
    {
      colKey: 'experimentId',
      title: 'Experiment ID',
      width: 150,
    },
    {
      colKey: 'dataType',
      title: 'Data Type',
      width: 120,
      cell: ({ row }: { row: Dataset }) => (
        <Tag theme={dataTypeColors[row.dataType] as any} variant="light">
          {row.dataType ? row.dataType.toUpperCase() : 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      colKey: 'size',
      title: 'Size',
      width: 100,
      cell: ({ row }: { row: Dataset }) => <span>{formatBytes(row.size)}</span>,
    },
    {
      colKey: 'fileCount',
      title: 'Files',
      width: 80,
      cell: ({ row }: { row: Dataset }) => <span>{row.fileCount}</span>,
    },
    {
      colKey: 'phase',
      title: 'Status',
      width: 100,
      cell: ({ row }: { row: Dataset }) => (
        <Tag theme={row.phase === 'Ready' ? 'success' : 'default'} variant="light">
          {row.phase}
        </Tag>
      ),
    },
    {
      colKey: 'mountedBy',
      title: 'Mounted By',
      width: 150,
      cell: ({ row }: { row: Dataset }) => (
        <span>{row.mountedBy && row.mountedBy.length > 0 ? row.mountedBy.join(', ') : '-'}</span>
      ),
    },
    {
      colKey: 'createdAt',
      title: 'Created At',
      width: 180,
      cell: ({ row }: { row: Dataset }) => (
        <span>{new Date(row.createdAt).toLocaleString()}</span>
      ),
    },
    {
      colKey: 'actions',
      title: 'Actions',
      width: 150,
      cell: ({ row }: { row: Dataset }) => (
        <Space size="small">
          <Button 
            theme="primary" 
            variant="text" 
            size="small"
            icon={<BrowseIcon />}
            onClick={() => {
              setSelectedDataset(row);
              setBrowserVisible(true);
            }}
          >
            Browse
          </Button>
          <Button
            theme="danger"
            variant="text"
            size="small"
            icon={<DeleteIcon />}
            onClick={() => handleDelete(row)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: '16px' }}>
        <Col span={3}>
          <Card bordered style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--tc-brand-color)' }}>
              {stats?.totalDatasets || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginTop: '4px' }}>
              Total Datasets
            </div>
          </Card>
        </Col>
        <Col span={3}>
          <Card bordered style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--tc-success-color)' }}>
              {formatBytes(stats?.totalSize || 0)}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginTop: '4px' }}>
              Total Storage
            </div>
          </Card>
        </Col>
        <Col span={3}>
          <Card bordered style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#E37318' }}>
              {stats?.typeBreakdown?.raw || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginTop: '4px' }}>
              Raw Data
            </div>
          </Card>
        </Col>
        <Col span={3}>
          <Card bordered style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: 'var(--tc-brand-color)' }}>
              {stats?.typeBreakdown?.train || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginTop: '4px' }}>
              Training Data
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filters and Actions */}
      <Card bordered={false} style={{ marginBottom: '16px' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Input
              placeholder="Search datasets..."
              value={searchText}
              onChange={(value) => setSearchText(value)}
              prefixIcon={<SearchIcon />}
              style={{ width: '250px' }}
              clearable
            />
            <Select
              value={filterDataType}
              onChange={(value) => setFilterDataType(value as string)}
              options={dataTypeOptions}
              style={{ width: '150px' }}
              placeholder="Filter by type"
            />
            <Input
              placeholder="Experiment ID"
              value={filterExperimentId}
              onChange={(value) => setFilterExperimentId(value)}
              style={{ width: '150px' }}
              clearable
            />
          </Space>
          <Space>
            <Button icon={<RefreshIcon />} variant="outline" onClick={fetchDatasets} loading={loading}>
              Refresh
            </Button>
            <Button icon={<AddIcon />} theme="primary" onClick={() => setShowCreateDialog(true)}>
              Create Dataset
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Datasets Table */}
      <Card bordered={false}>
        <Table
          rowKey="id"
          data={filteredDatasets}
          columns={columns}
          loading={loading}
          stripe
          hover
          bordered={false}
          size="medium"
          empty="No datasets found. Click 'Create Dataset' to get started."
        />
      </Card>

      <CreateDatasetDialog
        visible={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          fetchDatasets();
          fetchStats();
        }}
        namespace={namespace}
      />

      <Drawer
        visible={browserVisible}
        onClose={() => {
          setBrowserVisible(false);
          setSelectedDataset(null);
        }}
        header={selectedDataset ? `File Browser - ${selectedDataset.name}` : 'File Browser'}
        size="90%"
        destroyOnClose
      >
        <FileBrowser 
          namespace={namespace} 
          datasetPath={selectedDataset?.storagePath}
          datasetName={selectedDataset?.name}
        />
      </Drawer>
    </>
  );
};

export default DatasetList;