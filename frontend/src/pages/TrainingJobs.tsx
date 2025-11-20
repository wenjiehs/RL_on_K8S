import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Tag, Space, Card, MessagePlugin, Dialog, Checkbox, Textarea } from 'tdesign-react';
import { AddIcon, RefreshIcon, PlayCircleIcon, PauseCircleIcon, StopCircleIcon, DeleteIcon, CodeIcon } from 'tdesign-icons-react';
import CreateTrainingJobDialog from '../components/CreateTrainingJobDialog';

interface TrainingJob {
  id: string;
  experimentName: string;
  description?: string;
  baseModel: string;
  trainingType: string;
  trainingMethod: string;
  algorithmType: string;
  status: string;
  
  // 环境配置
  environmentMode: string;
  namespace: string;
  createNamespace?: string;
  environmentId: string;
  
  // 资源配置
  cpu: number;
  memory: number;
  gpu: number;
  image: string;
  enableRDMA: boolean;
  debugMode: boolean;
  outputDirectory: string;
  
  // 数据集
  dpoDataset: string;
  dataPath: string;
  startupScript?: string;
  dependencyFiles?: string[];
  
  // 时间信息
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // 兼容旧字段
  hyperparameters?: any;
  resourceConfig?: any;
  checkpointInterval?: number;
  numIterations?: number;
  currentIteration?: number;
  codePath?: string;
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
  
  // 预览命令相关状态
  const [previewDialogVisible, setPreviewDialogVisible] = useState(false);
  const [previewCommand, setPreviewCommand] = useState('');
  const [previewJobName, setPreviewJobName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

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
      const response = await fetch('http://localhost:8080/api/training-jobs/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: job.id }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '启动失败');
      }

      MessagePlugin.success(`训练任务已启动: ${result.podName || ''}`);
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

  // 预览训练命令
  const handlePreviewCommand = async (job: TrainingJob) => {
    setLoadingPreview(true);
    try {
      const response = await fetch('http://localhost:8080/api/training-jobs/preview-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId: job.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '获取命令预览失败');
      }

      const data = await response.json();
      setPreviewCommand(data.command);
      setPreviewJobName(data.jobName);
      setPreviewDialogVisible(true);
    } catch (error: any) {
      console.error('Failed to preview command:', error);
      MessagePlugin.error(error.message || '获取命令预览失败');
    } finally {
      setLoadingPreview(false);
    }
  };

  // 复制命令到剪贴板
  const handleCopyCommand = () => {
    navigator.clipboard.writeText(previewCommand);
    MessagePlugin.success('命令已复制到剪贴板');
  };

  // 自定义操作按钮组件
  const ActionButtons: React.FC<{ job: TrainingJob }> = ({ job }) => {
    // 添加响应式样式处理
    React.useEffect(() => {
      const style = document.createElement('style');
      style.textContent = `
        .action-buttons-container {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          max-width: 280px;
          justify-content: flex-start;
          align-items: flex-start;
          align-content: flex-start;
        }
        
        .action-buttons-container .t-button {
          min-width: 60px;
          height: 28px;
          font-size: 12px;
          padding: 0 8px;
          margin: 0;
          flex-shrink: 0;
        }
        
        @media (max-width: 1200px) {
          .action-buttons-container {
            max-width: 240px;
            gap: 3px;
          }
          .action-buttons-container .t-button {
            min-width: 55px;
            height: 26px;
            font-size: 11px;
            padding: 0 6px;
          }
        }
        
        @media (max-width: 768px) {
          .action-buttons-container {
            max-width: 200px;
            gap: 2px;
          }
          .action-buttons-container .t-button {
            min-width: 50px;
            height: 24px;
            font-size: 10px;
            padding: 0 4px;
          }
          .action-buttons-container .t-button .t-icon {
            font-size: 12px !important;
          }
        }
      `;
      document.head.appendChild(style);
      
      return () => {
        document.head.removeChild(style);
      };
    }, []);

    return (
      <div className="action-buttons-container">
        {/* 预览命令按钮 - 始终显示 */}
        <Button
          theme="default"
          variant="text"
          size="small"
          icon={<CodeIcon />}
          onClick={() => handlePreviewCommand(job)}
          loading={loadingPreview}
        >
          预览
        </Button>

        {/* 状态相关按钮 */}
        {job.status === 'pending' && (
          <Button
            theme="success"
            variant="text"
            size="small"
            icon={<PlayCircleIcon />}
            onClick={() => handleStartJob(job)}
          >
            启动
          </Button>
        )}

        {job.status === 'running' && (
          <>
            <Button
              theme="warning"
              variant="text"
              size="small"
              icon={<PauseCircleIcon />}
              onClick={() => handlePauseJob(job)}
            >
              暂停
            </Button>
            <Button
              theme="danger"
              variant="text"
              size="small"
              icon={<StopCircleIcon />}
              onClick={() => handleStopJob(job)}
            >
              终止
            </Button>
          </>
        )}

        {job.status === 'paused' && (
          <Button
            theme="primary"
            variant="text"
            size="small"
            icon={<PlayCircleIcon />}
            onClick={() => {
              MessagePlugin.info('恢复功能暂未实现');
            }}
          >
            恢复
          </Button>
        )}

        {/* 删除按钮 - 始终显示 */}
        <Button
          theme="danger"
          variant="text"
          size="small"
          icon={<DeleteIcon />}
          onClick={() => {
            setSelectedJob(job);
            setDeleteDialogVisible(true);
          }}
        >
          删除
        </Button>
      </div>
    );
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

  const getEnvironmentModeText = (mode: string) => {
    return mode === 'select-existing' ? '选择已有' : '自动创建';
  };

  const getEnvironmentModeTheme = (mode: string) => {
    return mode === 'select-existing' ? 'primary' : 'success';
  };

  const columns = [
    {
      colKey: 'experimentName',
      title: '任务名称',
      width: 200,
      fixed: 'left' as const,
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
      colKey: 'environmentId',
      title: '环境名称',
      width: 150,
      cell: ({ row }: { row: TrainingJob }) => (
        <div>
          <div 
            style={{ 
              fontWeight: '500', 
              color: 'var(--td-brand-color)',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
            onClick={() => {
              if (row.environmentId) {
                navigate(`/environments/${row.environmentId}?name=${row.environmentId}&namespace=${row.namespace || row.createNamespace}&framework=ray`);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
              e.currentTarget.style.opacity = '0.8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
              e.currentTarget.style.opacity = '1';
            }}
          >
            {row.environmentId || '-'}
          </div>
          {row.environmentMode && (
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--tc-text-secondary)',
              marginTop: '2px'
            }}>
              {getEnvironmentModeText(row.environmentMode)}
            </div>
          )}
        </div>
      ),
    },
    {
      colKey: 'namespace',
      title: '命名空间',
      width: 120,
      cell: ({ row }: { row: TrainingJob }) => (
        <span>{row.namespace || row.createNamespace || '-'}</span>
      ),
    },
    {
      colKey: 'baseModel',
      title: '基础模型',
      width: 150,
      ellipsis: true,
    },
    {
      colKey: 'trainingMethod',
      title: '训练方法',
      width: 100,
      cell: ({ row }: { row: TrainingJob }) => (
        <Tag variant="outline">{row.trainingMethod}</Tag>
      ),
    },
    {
      colKey: 'resources',
      title: '资源配置',
      width: 150,
      cell: ({ row }: { row: TrainingJob }) => (
        <div style={{ fontSize: '12px' }}>
          <div>CPU: {row.cpu} 核</div>
          <div>内存: {row.memory} GB</div>
          {row.gpu > 0 && <div>GPU: {row.gpu} 卡</div>}
        </div>
      ),
    },
    {
      colKey: 'createdAt',
      title: '创建时间',
      width: 160,
      cell: ({ row }: { row: TrainingJob }) => formatDate(row.createdAt),
    },
    {
      colKey: 'actions',
      title: '操作',
      width: 300,
      fixed: 'right' as const,
      cell: ({ row }: { row: TrainingJob }) => <ActionButtons job={row} />,
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

      {/* 预览命令对话框 */}
      <Dialog
        visible={previewDialogVisible}
        header={`训练命令预览 - ${previewJobName}`}
        onClose={() => setPreviewDialogVisible(false)}
        width="800px"
        footer={
          <Space>
            <Button onClick={handleCopyCommand} theme="primary">
              复制命令
            </Button>
            <Button onClick={() => setPreviewDialogVisible(false)}>
              关闭
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <p style={{ color: 'var(--td-text-color-secondary)', marginBottom: '8px' }}>
            以下是根据训练任务配置生成的VERL训练命令：
          </p>
          <Textarea
            value={previewCommand}
            readonly
            autosize={{ minRows: 15, maxRows: 30 }}
            style={{
              fontFamily: 'monospace',
              fontSize: '12px',
              backgroundColor: 'var(--td-bg-color-container)',
            }}
          />
        </div>
        <div style={{ 
          padding: '12px', 
          backgroundColor: 'var(--td-warning-color-1)', 
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <strong>提示：</strong>此命令将在Ray head pod上执行。请确保：
          <ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '20px' }}>
            <li>数据集路径正确且可访问</li>
            <li>模型路径正确且可访问</li>
            <li>输出目录有写入权限</li>
            <li>GPU资源配置符合实际需求</li>
          </ul>
        </div>
      </Dialog>
    </>
  );
};

export default TrainingJobs;