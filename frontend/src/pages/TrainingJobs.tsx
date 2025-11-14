import React, { useState } from 'react';
import { Table, Button, Tag, Space, Card, Progress } from 'tdesign-react';
import { AddIcon, RefreshIcon } from 'tdesign-icons-react';

interface RLTrainingJob {
  id: string;
  environment: string;
  framework: 'Ray' | 'Horovod' | 'DeepSpeed';
  status: 'Running' | 'Completed' | 'Failed' | 'Pending';
  startTime: string;
  duration: string;
  avgReward: number | null;
  progress: number;
}

const TrainingJobs: React.FC = () => {
  const [jobs, setJobs] = useState<RLTrainingJob[]>([
    {
      id: 'job-d4a6f8',
      environment: 'cartpole-env-1',
      framework: 'Ray',
      status: 'Completed',
      startTime: '2025-11-14 10:30:00',
      duration: '45 min',
      avgReward: 245.8,
      progress: 100,
    },
    {
      id: 'job-e8b1c3',
      environment: 'custom-env-alpha',
      framework: 'Ray',
      status: 'Running',
      startTime: '2025-11-14 11:15:00',
      duration: '15 min',
      avgReward: 198.2,
      progress: 65,
    },
    {
      id: 'job-f1a9e7',
      environment: 'cartpole-env-1',
      framework: 'Horovod',
      status: 'Failed',
      startTime: '2025-11-14 09:00:00',
      duration: '1.2 hours',
      avgReward: null,
      progress: 42,
    },
    {
      id: 'job-g5h2k1',
      environment: 'custom-env-alpha',
      framework: 'DeepSpeed',
      status: 'Pending',
      startTime: '-',
      duration: '-',
      avgReward: null,
      progress: 0,
    },
  ]);

  const columns = [
    {
      colKey: 'id',
      title: 'Job ID',
      width: 120,
      cell: ({ row }: { row: RLTrainingJob }) => (
        <span style={{ fontWeight: '500', color: 'var(--tc-text-primary)' }}>{row.id}</span>
      ),
    },
    {
      colKey: 'status',
      title: 'Status',
      width: 120,
      cell: ({ row }: { row: RLTrainingJob }) => {
        const themeMap = {
          Running: 'primary',
          Completed: 'success',
          Failed: 'danger',
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
      colKey: 'environment',
      title: 'Environment',
      width: 180,
    },
    {
      colKey: 'framework',
      title: 'Framework',
      width: 120,
      cell: ({ row }: { row: RLTrainingJob }) => (
        <Tag variant="outline">{row.framework}</Tag>
      ),
    },
    {
      colKey: 'progress',
      title: 'Progress',
      width: 150,
      cell: ({ row }: { row: RLTrainingJob }) => (
        <Progress
          percentage={row.progress}
          theme={row.status === 'Failed' ? 'error' : row.status === 'Completed' ? 'success' : 'primary'}
          size="small"
        />
      ),
    },
    {
      colKey: 'avgReward',
      title: 'Avg. Reward',
      width: 120,
      cell: ({ row }: { row: RLTrainingJob }) => (
        <span style={{ fontWeight: '500' }}>
          {row.avgReward?.toFixed(2) ?? 'N/A'}
        </span>
      ),
    },
    {
      colKey: 'startTime',
      title: 'Start Time',
      width: 160,
    },
    {
      colKey: 'duration',
      title: 'Duration',
      width: 100,
    },
    {
      colKey: 'actions',
      title: 'Actions',
      width: 150,
      cell: ({ row }: { row: RLTrainingJob }) => (
        <Space size="small">
          <Button theme="primary" variant="text" size="small">
            View
          </Button>
          <Button
            theme="danger"
            variant="text"
            size="small"
            disabled={row.status !== 'Running'}
          >
            Stop
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Training Jobs"
      bordered={false}
      style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
      actions={
        <Space>
          <Button icon={<RefreshIcon />} variant="outline">
            Refresh
          </Button>
          <Button icon={<AddIcon />} theme="primary">
            Start New Training Job
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        data={jobs}
        columns={columns}
        stripe
        hover
        bordered={false}
        size="medium"
      />
    </Card>
  );
};

export default TrainingJobs;