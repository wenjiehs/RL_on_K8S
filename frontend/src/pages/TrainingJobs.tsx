import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Tag, Space, Card, MessagePlugin, Dialog, Checkbox } from 'tdesign-react';
import { AddIcon, RefreshIcon, PlayCircleIcon, PauseCircleIcon, StopCircleIcon, DeleteIcon } from 'tdesign-icons-react';
import CreateTrainingJobDialog from '../components/CreateTrainingJobDialog';

interface TrainingJob {
  id: string;
  experimentName: string;
  algorithmType: string;
  environmentId: string;
  namespace: string;
  dataPath: string;
  status: string;
  hyperparameters: any;
  resourceConfig?: any;
  checkpointInterval: number;
  numIterations: number;
  currentIteration: number;
  codePath?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  progressPercent?: number;
  duration?: string;
  checkpointCount?: number;
}

const TrainingJobs: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null);
  const [keepCheckpoint, setKeepCheckpoint] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/training-jobs');
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch training jobs:', error);
      MessagePlugin.error('获取训练任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStartJob = async (job: TrainingJob) => {
    try {
      const response = await fetch(`http://localhost:8080/api/training-jobs/${job.id}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '启动失败');
      }

      MessagePlugin.success('训练任务已启动');
      fetchJobs();
    } catch (error: any) {
      console.error('Failed to start job:', error);
      MessagePlugin.error(error.message || '启动训练任务失败');
    }
  };

  const handlePauseJob = async (job: TrainingJob) => {
    try {
      const response = await fetch(`http://localhost:8080/api/training-jobs/${job.id}/pause`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '暂停失败');
      }

      MessagePlugin.success('训练任务已暂停');
      fetchJobs();
    } catch (error: any) {
      console.error('Failed to pause job:', error);
      MessagePlugin.error(error.message || '暂停训练任务失败');
    }
  };

  const handleStopJob = async (job: TrainingJob) => {
    try {
      const response = await fetch(`http://localhost:8080/api/training-jobs/${job.id}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keepCheckpoint: keepCheckpoint,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '终止失败');
      }

      MessagePlugin.success('训练任务已终止');
      fetchJobs();
    } catch (error: any) {
      console.error('Failed to stop job:', error);
      MessagePlugin.error(error.message || '终止训练任务失败');
    }
  };

  const handleDeleteJob = async () => {
    if (!selectedJob) return;

    try {
      const response = await fetch(
        `http://localhost:8080/api/training-jobs/${selectedJob.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      MessagePlugin.success('训练任务已删除');
      setDeleteDialogVisible(false);
      setSelectedJob(null);
      fetchJobs();
    } catch (error: any) {
      console.error('Failed to delete job:', error);
      MessagePlugin.error(error.message || '删除训练任务失败');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const getStatusTheme = (status: string) => {
    const themeMap: Record<string, any> = {
      pending: 'warning',
      running: 'primary',
      paused: 'default',
      completed: 'success',
      failed: 'danger',
      terminated: 'default',
    };
    return themeMap[status.toLowerCase()] || 'default';
  };

  const columns = [
    {
      colKey: 'experimentName',
      title: '实验名称',
      width: 180,
      cell: ({ row }: { row: TrainingJob }) => (
        <div>
          <div 
            style={{ 
              fontWeight: '500', 
              color: 'var(--td-brand-color)',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
            onClick={() => navigate(`/training/${row.id}`)}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
              e.currentTarget.style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
              e.currentTarget.style.opacity = '1';
            }}
          >
            {row.experimentName}
          </div>
          <div 
            style={{ 
              fontSize: '12px', 
              color: 'var(--tc-text-secondary)',
              cursor: 'pointer',
              fontFamily: 'monospace'
            }}
            onClick={() => navigate(`/training/${row.id}`)}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--td-brand-color)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--tc-text-secondary)';
            }}
          >
            {row.id}
          </div>
        </div>
      ),
    },
    {
      colKey: 'status',
      title: '状态',
      width: 100,
      cell: ({ row }: { row: TrainingJob }) => (
        <Tag theme={getStatusTheme(row.status)} variant="light">
          {row.status}
        </Tag>
      ),
    },
    {
      colKey: 'algorithmType',
      title: '算法',
      width: 100,
      cell: ({ row }: { row: TrainingJob }) => (
        <Tag variant="outline">{row.algorithmType}</Tag>
      ),
    },
    {
      colKey: 'environmentId',
      title: '环境ID',
      width: 150,
    },
    {
      colKey: 'dataPath',
      title: '数据路径',
      width: 200,
      ellipsis: true,
    },
    {
      colKey: 'createdAt',
      title: '创建时间',
      width: 160,
      cell: ({ row }: { row: TrainingJob }) => formatDate(row.createdAt),
    },
    {
      colKey: 'startedAt',
      title: '启动时间',
      width: 160,
      cell: ({ row }: { row: TrainingJob }) => formatDate(row.startedAt),
    },
    {
      colKey: 'actions',
      title: '操作',
      width: 200,
      fixed: 'right' as const,
      cell: ({ row }: { row: TrainingJob }) => (
        <Space size="small">
          <Button
            theme="primary"
            variant="text"
            size="small"
            onClick={() => navigate(`/training/${row.id}`)}
          >
            详情
          </Button>
          {row.status === 'pending' && (
            <Button
              theme="primary"
              variant="text"
              size="small"
              icon={<PlayCircleIcon />}
              onClick={() => handleStartJob(row)}
            >
              启动
            </Button>
          )}
          {row.status === 'running' && (
            <>
              <Button
                theme="warning"
                variant="text"
                size="small"
                icon={<PauseCircleIcon />}
                onClick={() => handlePauseJob(row)}
              >
                暂停
              </Button>
              <Button
                theme="danger"
                variant="text"
                size="small"
                icon={<StopCircleIcon />}
                onClick={() => handleStopJob(row)}
              >
                终止
              </Button>
            </>
          )}
          {row.status === 'paused' && (
            <Button
              theme="primary"
              variant="text"
              size="small"
              icon={<PlayCircleIcon />}
              onClick={() => {
                // Resume job logic here
                MessagePlugin.info('恢复功能暂未实现');
              }}
            >
              恢复
            </Button>
          )}
          <Button
            theme="danger"
            variant="text"
            size="small"
            icon={<DeleteIcon />}
            onClick={() => {
              setSelectedJob(row);
              setDeleteDialogVisible(true);
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title="训练任务"
        bordered={false}
        style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
        actions={
          <Space>
            <Button icon={<RefreshIcon />} variant="outline" onClick={fetchJobs}>
              刷新
            </Button>
            <Button icon={<AddIcon />} theme="primary" onClick={() => setShowCreateDialog(true)}>
              创建训练任务
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          data={jobs}
          columns={columns}
          loading={loading}
          stripe
          hover
          bordered={false}
          size="medium"
          empty="暂无训练任务"
        />
      </Card>

      <CreateTrainingJobDialog
        visible={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={fetchJobs}
      />

      <Dialog
        visible={deleteDialogVisible}
        header="删除训练任务"
        onClose={() => {
          setDeleteDialogVisible(false);
          setSelectedJob(null);
        }}
        onConfirm={handleDeleteJob}
        confirmBtn="删除"
        cancelBtn="取消"
      >
        <div style={{ marginBottom: 16 }}>
          确定要删除训练任务 <strong>{selectedJob?.experimentName}</strong> 吗？
        </div>
        <Checkbox
          checked={keepCheckpoint}
          onChange={setKeepCheckpoint}
        >
          保留Checkpoint（用于恢复训练）
        </Checkbox>
      </Dialog>
    </>
  );
};

export default TrainingJobs;