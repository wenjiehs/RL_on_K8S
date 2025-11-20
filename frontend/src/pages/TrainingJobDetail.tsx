import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Card, 
  Tabs, 
  Button, 
  Tag, 
  Space, 
  Row, 
  Col,
  Progress,
  Statistic,
  Table,
  Timeline,
  Dialog,
  MessagePlugin,
  Divider,
  Loading,
  Alert
} from 'tdesign-react';
import TrainingMetricsChart from '../components/TrainingMetricsChart';
import TrainingJobLogs from '../components/TrainingJobLogs';
import BackButton from '../components/BackButton';
import { 
  PlayIcon, 
  PauseIcon, 
  StopIcon, 
  DeleteIcon, 
  CopyIcon,
  DownloadIcon,
  RefreshIcon,
  TimeIcon,
  CheckCircleIcon,
  ErrorCircleIcon,
  CloseCircleIcon,
  InfoCircleIcon
} from 'tdesign-icons-react';



// 模拟数据
const mockJobData = {
  id: 'job-001',
  name: 'llama-dpo-training-001',
  description: '基于LLaMA模型的DPO训练任务',
  status: 'running',
  baseModel: 'LLaMA-7B',
  trainingType: '强化学习',
  trainingMethod: 'RLHF_DPO',
  createdAt: '2025-11-19 10:30:00',
  updatedAt: '2025-11-19 11:45:00',
  startedAt: '2025-11-19 09:00:00',
  progressPercent: 65,
  currentIteration: 650,
  numIterations: 1000,
  environment: {
    id: 'env-pytorch-001',
    name: 'PyTorch 2.1 训练环境',
    image: 'pytorch/pytorch:2.1.0-cuda11.8',
    cpu: 8,
    memory: 32,
    gpu: 2,
    enableRDMA: true,
    debugMode: false,
    outputDirectory: '/mnt/cfs/outputs/job-001'
  },
  dataset: {
    name: 'OpenAssistant Conversations',
    path: '/mnt/cfs/datasets/openassistant',
    totalSamples: 10000,
    trainSamples: 8000,
    valSamples: 1000,
    testSamples: 1000,
    mounted: true
  },
  script: {
    filename: 'train.sh',
    size: '2.5 KB',
    uploadTime: '2025-11-19 10:30:00',
    content: '#!/bin/bash\necho "Starting training..."\npython train.py --config config.yaml'
  },
  resources: {
    cpuUsage: 78,
    memoryUsage: 68,
    memoryUsed: 21.8,
    memoryTotal: 32,
    gpuUsage: [95, 92],
    gpuMemory: [14.2, 13.8],
    gpuMemoryTotal: 16
  },
  checkpoints: [
    {
      id: 'checkpoint-600',
      time: '2025-11-19 11:40:00',
      size: '2.3 GB',
      loss: 0.42,
      isLatest: true
    },
    {
      id: 'checkpoint-500',
      time: '2025-11-19 11:20:00',
      size: '2.3 GB',
      loss: 0.48,
      isLatest: false
    }
  ],
  metrics: {
    loss: [0.8, 0.75, 0.68, 0.62, 0.58, 0.52, 0.48, 0.45, 0.42],
    accuracy: [0.65, 0.68, 0.72, 0.75, 0.78, 0.81, 0.84, 0.86, 0.88],
    iterations: [100, 200, 300, 400, 500, 600, 700, 800, 900]
  },

  events: [
    { time: '2025-11-19 11:45:00', user: '用户A', action: '暂停任务', result: '成功' },
    { time: '2025-11-19 11:30:00', user: '用户A', action: '恢复任务', result: '成功' },
    { time: '2025-11-19 10:00:00', user: '用户A', action: '启动任务', result: '成功' },
    { time: '2025-11-19 09:30:00', user: '用户A', action: '创建任务', result: '成功' }
  ],
  k8sResources: {
    namespace: 'default',
    podName: 'training-job-001-worker-0',
    podStatus: 'Running',
    node: 'k8s-node-gpu-01',
    service: 'training-job-001-svc',
    pvc: 'cfs-dataset-pvc',
    configMap: 'training-job-001-config'
  }
};

const TrainingJobDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [jobData, setJobData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('basic');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);

  // 状态标签配置
  const getStatusTag = (status: string) => {
    const statusConfig = {
      pending: { theme: 'default', icon: <TimeIcon />, text: '待启动' },
      running: { theme: 'primary', icon: <PlayIcon />, text: '运行中' },
      paused: { theme: 'warning', icon: <PauseIcon />, text: '已暂停' },
      completed: { theme: 'success', icon: <CheckCircleIcon />, text: '已完成' },
      failed: { theme: 'danger', icon: <ErrorCircleIcon />, text: '失败' },
      stopped: { theme: 'default', icon: <StopIcon />, text: '已停止' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag theme={config.theme} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 操作按钮处理
  const handleAction = (action: string) => {
    MessagePlugin.info(`执行${action}操作（模拟）`);
  };

  // 刷新数据
  const handleRefresh = () => {
    setLoading(true);
    // 重新获取数据
    const fetchJobData = async () => {
      try {
        const response = await fetch(`http://localhost:8080/api/training-jobs/detail?id=${id}`);
        if (response.ok) {
          const data = await response.json();
          setJobData(data);
          MessagePlugin.success('数据已刷新');
        } else {
          MessagePlugin.error('刷新数据失败');
        }
      } catch (error) {
        console.error('Failed to refresh job data:', error);
        MessagePlugin.error('刷新数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchJobData();
  };

  // 计算运行时长
  const calculateRunningTime = () => {
    if (!jobData || !jobData.createdAt) return '0小时0分钟';
    const start = new Date(jobData.createdAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时${minutes}分钟`;
  };

  // 响应式断点 - 使用window.innerWidth作为替代方案
  const [screenSize, setScreenSize] = useState('desktop');

  // 获取训练任务数据
  useEffect(() => {
    if (!id) return;

    const fetchJobData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8080/api/training-jobs/detail?id=${id}`);
        if (response.ok) {
          const data = await response.json();
          setJobData(data);
        } else {
          MessagePlugin.error('获取训练任务详情失败');
        }
      } catch (error) {
        console.error('Failed to fetch job data:', error);
        MessagePlugin.error('获取训练任务详情失败');
      } finally {
        setLoading(false);
      }
    };

    fetchJobData();
  }, [id]);
  
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setScreenSize('mobile');
      } else if (width < 992) {
        setScreenSize('tablet');
      } else {
        setScreenSize('desktop');
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading || !jobData) {
    return (
      <div className="training-job-detail">
        <BackButton to="/training" text="返回训练任务列表" />
        <Loading loading={true} showOverlay>
          <div style={{ height: '400px' }}></div>
        </Loading>
      </div>
    );
  }

  return (
    <div className="training-job-detail">
      <BackButton to="/training" text="返回训练任务列表" />
      <Loading loading={loading} showOverlay>
        {/* 页面头部 */}
        <Card className="page-header" bordered={false}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space direction="vertical" size="small">
                <Space align="center">
                  <h2 style={{ margin: 0 }}>{jobData.name}</h2>
                  {getStatusTag(jobData.status)}
                </Space>
                <Space>
                  <span>任务ID: {jobData.id}</span>
                  <Button variant="text" size="small" icon={<CopyIcon />}>
                    复制
                  </Button>
                </Space>
                <p style={{ margin: 0, color: '#666' }}>{jobData.description}</p>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button 
                  theme="primary" 
                  icon={<PlayIcon />}
                  disabled={jobData.status === 'running'}
                  onClick={() => handleAction('启动')}
                >
                  启动
                </Button>
                <Button 
                  theme="warning" 
                  icon={<PauseIcon />}
                  disabled={jobData.status !== 'running'}
                  onClick={() => handleAction('暂停')}
                >
                  暂停
                </Button>
                <Button 
                  theme="default" 
                  icon={<StopIcon />}
                  disabled={jobData.status !== 'running' && jobData.status !== 'paused'}
                  onClick={() => handleAction('停止')}
                >
                  停止
                </Button>
                <Button 
                  theme="danger" 
                  icon={<DeleteIcon />}
                  onClick={() => setShowDeleteModal(true)}
                >
                  删除
                </Button>
                <Button 
                  theme="default" 
                  icon={<CopyIcon />}
                  onClick={() => setShowCloneModal(true)}
                >
                  克隆
                </Button>
                <Button 
                  theme="default" 
                  icon={<DownloadIcon />}
                  onClick={() => MessagePlugin.info('导出配置（模拟）')}
                >
                  导出
                </Button>
                <Button 
                  theme="default" 
                  icon={<RefreshIcon />}
                  onClick={handleRefresh}
                >
                  刷新
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 实时状态监控 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12}>
            <Card title="运行状态" bordered={false}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row justify="space-between">
                  <Col>运行时长:</Col>
                  <Col>{calculateRunningTime()}</Col>
                </Row>
                <Row justify="space-between">
                  <Col>任务状态:</Col>
                  <Col>{jobData.status}</Col>
                </Row>
                <Row justify="space-between">
                  <Col>创建时间:</Col>
                  <Col>{jobData.createdAt}</Col>
                </Row>
              </Space>
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="资源配置" bordered={false}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <div style={{ marginBottom: 4 }}>CPU核数: {jobData.cpu || 0}</div>
                  <Progress percent={75} theme="normal" />
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}>
                    内存: {jobData.memory || 0}GB
                  </div>
                  <Progress percent={60} theme="normal" />
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}>GPU数量: {jobData.gpu || 0}</div>
                  <Progress percent={80} theme="normal" size="small" />
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 配置信息 */}
        <Card style={{ marginTop: 16 }} bordered={false}>
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value as string)}>
            <Tabs.TabPanel value="basic" label="基础配置">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={8}>
                  <div className="info-item">
                    <span className="info-label">任务名称:</span>
                    <span className="info-value">{jobData.name}</span>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div className="info-item">
                    <span className="info-label">基座模型:</span>
                    <span className="info-value">{jobData.baseModel}</span>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div className="info-item">
                    <span className="info-label">训练类型:</span>
                    <span className="info-value">{jobData.trainingType}</span>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div className="info-item">
                    <span className="info-label">训练方式:</span>
                    <span className="info-value">{jobData.trainingMethod}</span>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div className="info-item">
                    <span className="info-label">创建时间:</span>
                    <span className="info-value">{jobData.createdAt}</span>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <div className="info-item">
                    <span className="info-label">更新时间:</span>
                    <span className="info-value">{jobData.updatedAt}</span>
                  </div>
                </Col>
              </Row>
            </Tabs.TabPanel>
            
            <Tabs.TabPanel value="environment" label="环境配置">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <h4>运行环境</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className="info-item">
                      <span className="info-label">环境ID:</span>
                      <span className="info-value">{jobData.environmentId}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">命名空间:</span>
                      <span className="info-value">{jobData.namespace}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">容器镜像:</span>
                      <span className="info-value">{jobData.image}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">输出目录:</span>
                      <span className="info-value">{jobData.outputDirectory}</span>
                    </div>
                  </Space>
                </Col>
                
                <Col xs={24} md={12}>
                  <h4>资源配置</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className="info-item">
                      <span className="info-label">CPU:</span>
                      <span className="info-value">{jobData.cpu} 核</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">内存:</span>
                      <span className="info-value">{jobData.memory} GB</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">GPU:</span>
                      <span className="info-value">{jobData.gpu} 张</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">RDMA:</span>
                      <span className="info-value">{jobData.enableRDMA ? '已启用' : '已关闭'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">调试模式:</span>
                      <span className="info-value">{jobData.debugMode ? '已开启' : '已关闭'}</span>
                    </div>
                  </Space>
                </Col>
              </Row>
            </Tabs.TabPanel>
            
            <Tabs.TabPanel value="dataset" label="数据集配置">
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <h4>数据集信息</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className="info-item">
                      <span className="info-label">DPO数据集:</span>
                      <span className="info-value">{jobData.dpoDataset}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">数据集路径:</span>
                      <span className="info-value">{jobData.dataPath}</span>
                    </div>
                  </Space>
                </Col>
                
                <Col xs={24} md={12}>
                  <h4>数据集信息</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className="info-item">
                      <span className="info-label">算法类型:</span>
                      <span className="info-value">{jobData.algorithmType}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">启动脚本:</span>
                      <span className="info-value">{jobData.startupScript ? '已配置' : '未配置'}</span>
                    </div>
                  </Space>
                </Col>
              </Row>
            </Tabs.TabPanel>
            
            <Tabs.TabPanel value="script" label="训练脚本">
              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <h4>启动脚本</h4>
                  <Card size="small">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {jobData.startupScript ? (
                        <>
                          <Row justify="space-between">
                            <Col>
                              <span><strong>脚本状态:</strong> 已配置</span>
                            </Col>
                            <Col>
                              <Space>
                                <Button size="small" onClick={() => MessagePlugin.info('查看内容（模拟）')}>
                                  查看内容
                                </Button>
                                <Button size="small" icon={<DownloadIcon />} onClick={() => MessagePlugin.info('下载（模拟）')}>
                                  下载
                                </Button>
                              </Space>
                            </Col>
                          </Row>
                          <Divider />
                          <pre style={{ 
                            background: '#f5f5f5', 
                            padding: '12px', 
                            borderRadius: '4px',
                            fontSize: '12px',
                            overflow: 'auto',
                            maxHeight: '200px'
                          }}>
                            {jobData.startupScript}
                          </pre>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                          未配置启动脚本
                        </div>
                      )}
                    </Space>
                  </Card>
                </Col>
              </Row>
            </Tabs.TabPanel>
            
          </Tabs>
        </Card>

        {/* 训练监控区域 - 包含指标和日志 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} xl={14}>
            {/* 训练日志 - 主要模块 */}
            <Card 
              title={
                <Space>
                  <span>📋 训练日志</span>
                  <Tag theme={jobData.status === 'running' ? 'primary' : 'default'} size="small">
                    {jobData.status === 'running' ? '实时监控中' : '历史查看'}
                  </Tag>
                </Space>
              } 
              bordered={false}
              style={{ minHeight: '600px' }}
            >
              <TrainingJobLogs jobId={jobData.id} jobStatus={jobData.status} />
            </Card>
          </Col>
          
          <Col xs={24} xl={10}>
            {/* 训练指标可视化 - 侧边栏 */}
            <Card 
              title="📊 训练指标" 
              bordered={false}
              style={{ minHeight: '600px' }}
            >
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                训练指标图表开发中...
              </div>
            </Card>
          </Col>
        </Row>

        {/* 底部管理区域 - 检查点和操作历史 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <span>💾 模型检查点</span>
                  <Tag theme="default" size="small">
                    检查点管理
                  </Tag>
                </Space>
              } 
              bordered={false}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  检查点功能开发中...
                </div>
              </Space>
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <span>📝 操作历史</span>
                  <Tag theme="default" size="small">
                    任务操作记录
                  </Tag>
                </Space>
              } 
              bordered={false}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                  操作历史功能开发中...
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Kubernetes资源信息 */}
        <Card 
          title={
            <Space>
              <span>☸️ Kubernetes资源</span>
              <Tag theme="success" size="small" icon={<CheckCircleIcon />}>
                环境信息
              </Tag>
            </Space>
          } 
          style={{ marginTop: 16 }} 
          bordered={false}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">命名空间:</span>
                <span className="info-value">{jobData.namespace}</span>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">环境ID:</span>
                <span className="info-value">{jobData.environmentId}</span>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">任务状态:</span>
                <span className="info-value">
                  <Tag theme={jobData.status === 'running' ? 'primary' : 'default'} icon={<CheckCircleIcon />}>
                    {jobData.status}
                  </Tag>
                </span>
              </div>
            </Col>
          </Row>
        </Card>
      </Loading>

      {/* 删除确认弹窗 */}
      <Dialog
        visible={showDeleteModal}
        header="确认删除"
        body={`确定要删除任务 "${jobData.name}" 吗？此操作不可恢复。`}
        confirmBtn="删除"
        cancelBtn="取消"
        onConfirm={() => {
          MessagePlugin.success('任务已删除（模拟）');
          setShowDeleteModal(false);
        }}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* 克隆任务弹窗 */}
      <Dialog
        visible={showCloneModal}
        header="克隆任务"
        body={`确定要基于任务 "${jobData.name}" 创建新任务吗？`}
        confirmBtn="克隆"
        cancelBtn="取消"
        onConfirm={() => {
          MessagePlugin.success('任务已克隆（模拟）');
          setShowCloneModal(false);
        }}
        onCancel={() => setShowCloneModal(false)}
      />

      <style jsx>{`
        .training-job-detail {
          padding: 16px;
          background: #f5f5f5;
          min-height: 100vh;
        }
        
        .page-header {
          margin-bottom: 16px;
        }
        
        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .info-item:last-child {
          border-bottom: none;
        }
        
        .info-label {
          font-weight: 500;
          color: #666;
          min-width: 100px;
        }
        
        .info-value {
          color: #333;
          flex: 1;
          text-align: right;
        }
        
        @media (max-width: 768px) {
          .training-job-detail {
            padding: 8px;
          }
          
          .info-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          
          .info-value {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default TrainingJobDetail;