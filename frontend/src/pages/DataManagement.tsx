import React, { useState } from 'react';
import { Table, Button, Tag, Tabs, Card, Space } from 'tdesign-react';
import { AddIcon, CloudUploadIcon, Edit1Icon, RefreshIcon } from 'tdesign-icons-react';

interface Dataset {
  id: string;
  name: string;
  source: 'Sidecar' | 'Manual';
  version: string;
  createdAt: string;
  size: string;
  tags: string[];
}

interface AnnotationTask {
  id: string;
  dataset: string;
  type: 'Classification' | 'BoundingBox';
  status: 'Pending' | 'InProgress' | 'Completed';
  assignee: string;
  progress: number;
}

const DataManagement: React.FC = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([
    {
      id: 'ds-001',
      name: 'cartpole-exp-run-123',
      source: 'Sidecar',
      version: 'v1.0',
      createdAt: '2025-11-14 11:00',
      size: '1.2 GB',
      tags: ['PPO', 'raw-data'],
    },
    {
      id: 'ds-002',
      name: 'lunar-lander-manual-set',
      source: 'Manual',
      version: 'v2.1',
      createdAt: '2025-11-13 09:30',
      size: '500 MB',
      tags: ['DQN', 'annotated'],
    },
    {
      id: 'ds-003',
      name: 'bipedal-walker-exp-run-456',
      source: 'Sidecar',
      version: 'v1.1',
      createdAt: '2025-11-14 14:00',
      size: '3.5 GB',
      tags: ['SAC', 'raw-data'],
    },
  ]);

  const [annotationTasks, setAnnotationTasks] = useState<AnnotationTask[]>([
    {
      id: 'anno-001',
      dataset: 'ds-001',
      type: 'Classification',
      status: 'Completed',
      assignee: 'user1',
      progress: 100,
    },
    {
      id: 'anno-002',
      dataset: 'ds-003',
      type: 'BoundingBox',
      status: 'InProgress',
      assignee: 'user2',
      progress: 65,
    },
    {
      id: 'anno-003',
      dataset: 'ds-003',
      type: 'Classification',
      status: 'Pending',
      assignee: '-',
      progress: 0,
    },
  ]);

  const datasetColumns = [
    {
      colKey: 'name',
      title: 'Dataset Name',
      width: 220,
      cell: ({ row }: { row: Dataset }) => (
        <span style={{ fontWeight: '500', color: 'var(--tc-text-primary)' }}>{row.name}</span>
      ),
    },
    {
      colKey: 'version',
      title: 'Version',
      width: 100,
      cell: ({ row }: { row: Dataset }) => <Tag variant="outline">{row.version}</Tag>,
    },
    {
      colKey: 'source',
      title: 'Source',
      width: 100,
      cell: ({ row }: { row: Dataset }) => (
        <Tag theme={row.source === 'Sidecar' ? 'primary' : 'success'} variant="light">
          {row.source}
        </Tag>
      ),
    },
    { colKey: 'size', title: 'Size', width: 100 },
    { colKey: 'createdAt', title: 'Created At', width: 150 },
    {
      colKey: 'tags',
      title: 'Tags',
      cell: ({ row }: { row: Dataset }) => (
        <Space size="small">
          {row.tags.map((tag) => (
            <Tag key={tag} size="small">
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      colKey: 'actions',
      title: 'Actions',
      width: 180,
      cell: () => (
        <Space size="small">
          <Button theme="primary" variant="text" size="small">
            Details
          </Button>
          <Button theme="primary" variant="text" size="small">
            Annotate
          </Button>
        </Space>
      ),
    },
  ];

  const annotationColumns = [
    {
      colKey: 'id',
      title: 'Task ID',
      width: 120,
      cell: ({ row }: { row: AnnotationTask }) => (
        <span style={{ fontWeight: '500', color: 'var(--tc-text-primary)' }}>{row.id}</span>
      ),
    },
    { colKey: 'dataset', title: 'Dataset', width: 180 },
    {
      colKey: 'type',
      title: 'Type',
      width: 140,
      cell: ({ row }: { row: AnnotationTask }) => <Tag variant="outline">{row.type}</Tag>,
    },
    {
      colKey: 'status',
      title: 'Status',
      width: 120,
      cell: ({ row }: { row: AnnotationTask }) => {
        const themeMap = {
          InProgress: 'primary',
          Completed: 'success',
          Pending: 'warning',
        };
        return (
          <Tag theme={themeMap[row.status] as any} variant="light">
            {row.status}
          </Tag>
        );
      },
    },
    {
      colKey: 'progress',
      title: 'Progress',
      width: 100,
      cell: ({ row }: { row: AnnotationTask }) => <span style={{ fontWeight: '500' }}>{row.progress}%</span>,
    },
    { colKey: 'assignee', title: 'Assignee', width: 120 },
    {
      colKey: 'actions',
      title: 'Actions',
      width: 150,
      cell: ({ row }: { row: AnnotationTask }) => (
        <Button
          theme="primary"
          variant="text"
          size="small"
          icon={<Edit1Icon />}
          disabled={row.status !== 'Pending'}
        >
          Start Task
        </Button>
      ),
    },
  ];

  return (
    <Card
      bordered={false}
      style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
    >
      <Tabs defaultValue="1">
        <Tabs.TabPanel value="1" label="Dataset Management (MLflow)">
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <Space>
                <Button icon={<RefreshIcon />} variant="outline">
                  Refresh
                </Button>
                <Button icon={<CloudUploadIcon />} theme="primary">
                  Upload Dataset
                </Button>
              </Space>
            </div>
            <Table
              rowKey="id"
              data={datasets}
              columns={datasetColumns}
              stripe
              hover
              bordered={false}
              size="medium"
            />
          </div>
        </Tabs.TabPanel>
        <Tabs.TabPanel value="2" label="Data Annotation">
          <div style={{ padding: '16px 0' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <Space>
                <Button icon={<RefreshIcon />} variant="outline">
                  Refresh
                </Button>
                <Button icon={<AddIcon />} theme="primary">
                  Create Annotation Task
                </Button>
              </Space>
            </div>
            <Table
              rowKey="id"
              data={annotationTasks}
              columns={annotationColumns}
              stripe
              hover
              bordered={false}
              size="medium"
            />
          </div>
        </Tabs.TabPanel>
      </Tabs>
    </Card>
  );
};

export default DataManagement;