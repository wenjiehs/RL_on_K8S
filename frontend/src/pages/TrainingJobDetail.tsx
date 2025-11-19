import React, { useState, useEffect } from 'react';
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
  logs: [
    { time: '2025-11-19 11:45:23', level: 'INFO', content: 'Epoch 1/10 started' },
    { time: '2025-11-19 11:45:24', level: 'INFO', content: 'Loss: 0.45' },
    { time: '2025-11-19 11:45:25', level: 'INFO', content: 'Accuracy: 0.82' },
    { time: '2025-11-19 11:45:26', level: 'WARN', content: 'GPU memory usage high: 95%' }
  ],
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
  const [jobData, setJobData] = useState(mockJobData);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [logType, setLogType] = useState('training');
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
    
    // 模拟状态更新
    if (action === '启动') {
      setJobData(prev => ({ ...prev, status: 'running' }));
    } else if (action === '暂停') {
      setJobData(prev => ({ ...prev, status: 'paused' }));
    } else if (action === '停止') {
      setJobData(prev => ({ ...prev, status: 'stopped' }));
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      // 模拟数据更新
      setJobData(prev => ({
        ...prev,
        progressPercent: Math.min(100, prev.progressPercent + 1),
        currentIteration: Math.min(prev.numIterations, prev.currentIteration + 10),
        updatedAt: new Date().toLocaleString('zh-CN')
      }));
      setLoading(false);
      MessagePlugin.success('数据已刷新');
    }, 1000);
  };

  // 计算运行时长
  const calculateRunningTime = () => {
    const start = new Date(jobData.startedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}小时${minutes}分钟`;
  };

  // 响应式断点 - 使用window.innerWidth作为替代方案
  const [screenSize, setScreenSize] = useState('desktop');
  
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
                  <Col>训练进度:</Col>
                  <Col>{jobData.progressPercent}%</Col>
                </Row>
                <Progress 
                  percent={jobData.progressPercent} 
                  status="active"
                  label={`${jobData.currentIteration}/${jobData.numIterations} iterations`}
                />
                <Row justify="space-between">
                  <Col>开始时间:</Col>
                  <Col>{jobData.startedAt}</Col>
                </Row>
              </Space>
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card title="资源使用情况" bordered={false}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <div style={{ marginBottom: 4 }}>CPU使用率: {jobData.resources.cpuUsage}%</div>
                  <Progress percent={jobData.resources.cpuUsage} theme="normal" />
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}>
                    内存使用率: {jobData.resources.memoryUsage}% 
                    ({jobData.resources.memoryUsed}/{jobData.resources.memoryTotal} GB)
                  </div>
                  <Progress percent={jobData.resources.memoryUsage} theme="normal" />
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}>GPU使用率:</div>
                  {jobData.resources.gpuUsage.map((usage, index) => (
                    <div key={index} style={{ marginBottom: 4 }}>
                      GPU {index}: {usage}%
                      <Progress percent={usage} theme="normal" size="small" />
                    </div>
                  ))}
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
                      <span className="info-value">{jobData.environment.id}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">环境名称:</span>
                      <span className="info-value">{jobData.environment.name}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">容器镜像:</span>
                      <span className="info-value">{jobData.environment.image}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">输出目录:</span>
                      <span className="info-value">{jobData.environment.outputDirectory}</span>
                    </div>
                  </Space>
                </Col>
                
                <Col xs={24} md={12}>
                  <h4>资源配置</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className="info-item">
                      <span className="info-label">CPU:</span>
                      <span className="info-value">{jobData.environment.cpu} 核</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">内存:</span>
                      <span className="info-value">{jobData.environment.memory} GB</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">GPU:</span>
                      <span className="info-value">{jobData.environment.gpu} 张</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">RDMA:</span>
                      <span className="info-value">{jobData.environment.enableRDMA ? '已启用' : '已关闭'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">调试模式:</span>
                      <span className="info-value">{jobData.environment.debugMode ? '已开启' : '已关闭'}</span>
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
                      <span className="info-value">{jobData.dataset.name}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">数据集路径:</span>
                      <span className="info-value">{jobData.dataset.path}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">数据集状态:</span>
                      <span className="info-value">
                        {jobData.dataset.mounted ? 
                          <Tag theme="success" icon={<CheckCircleIcon />}>已挂载</Tag> : 
                          <Tag theme="danger" icon={<ErrorCircleIcon />}>未挂载</Tag>
                        }
                      </span>
                    </div>
                  </Space>
                </Col>
                
                <Col xs={24} md={12}>
                  <h4>数据集统计</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className="info-item">
                      <span className="info-label">总样本数:</span>
                      <span className="info-value">{jobData.dataset.totalSamples.toLocaleString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">训练集:</span>
                      <span className="info-value">{jobData.dataset.trainSamples.toLocaleString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">验证集:</span>
                      <span className="info-value">{jobData.dataset.valSamples.toLocaleString()}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">测试集:</span>
                      <span className="info-value">{jobData.dataset.testSamples.toLocaleString()}</span>
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
                      <Row justify="space-between">
                        <Col>
                          <Space>
                            <span><strong>文件名:</strong> {jobData.script.filename}</span>
                            <span><strong>大小:</strong> {jobData.script.size}</span>
                            <span><strong>上传时间:</strong> {jobData.script.uploadTime}</span>
                          </Space>
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
                        {jobData.script.content}
                      </pre>
                    </Space>
                  </Card>
                </Col>
              </Row>
            </Tabs.TabPanel>
          </Tabs>
        </Card>

        {/* 训练指标可视化 */}
        <div style={{ marginTop: 16 }}>
          <TrainingMetricsChart data={jobData.metrics} />
        </div>

        {/* 日志查看 */}
        <Card title="日志查看" style={{ marginTop: 16 }} bordered={false}>
          <Space style={{ marginBottom: 16 }}>
            <Button 
              theme={logType === 'training' ? 'primary' : 'default'}
              onClick={() => setLogType('training')}
            >
              训练日志
            </Button>
            <Button 
              theme={logType === 'error' ? 'primary' : 'default'}
              onClick={() => setLogType('error')}
            >
              错误日志
            </Button>
            <Button 
              theme={logType === 'system' ? 'primary' : 'default'}
              onClick={() => setLogType('system')}
            >
              系统日志
            </Button>
          </Space>
          
          <div style={{ 
            background: '#f5f5f5', 
            padding: '12px', 
            borderRadius: '4px',
            height: '300px',
            overflow: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            {jobData.logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
                <span style={{ color: '#666' }}>{log.time}</span>
                <span style={{ 
                  marginLeft: '8px',
                  color: log.level === 'ERROR' ? '#f5222d' : log.level === 'WARN' ? '#fa8c16' : '#52c41a'
                }}>
                  [{log.level}]
                </span>
                <span style={{ marginLeft: '8px' }}>{log.content}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* 检查点管理和操作历史 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title="模型检查点" bordered={false}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <span>检查点间隔: 100 iterations</span>
                  <Divider layout="vertical" />
                  <span>已保存检查点: {jobData.checkpoints.length} 个</span>
                </div>
                
                {jobData.checkpoints.map((checkpoint, index) => (
                  <Card key={index} size="small">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Row justify="space-between" align="middle">
                        <Col>
                          <Space>
                            {checkpoint.isLatest && <Tag theme="primary">最新</Tag>}
                            <strong>{checkpoint.id}</strong>
                          </Space>
                        </Col>
                        <Col>
                          <Space>
                            <Button size="small" onClick={() => MessagePlugin.info('下载检查点（模拟）')}>
                              下载
                            </Button>
                            <Button size="small" onClick={() => MessagePlugin.info('恢复训练（模拟）')}>
                              恢复
                            </Button>
                            <Button size="small" theme="danger" onClick={() => MessagePlugin.info('删除检查点（模拟）')}>
                              删除
                            </Button>
                          </Space>
                        </Col>
                      </Row>
                      <Row>
                        <Col span={8}>
                          <span className="info-label">时间:</span>
                          <span className="info-value">{checkpoint.time}</span>
                        </Col>
                        <Col span={8}>
                          <span className="info-label">大小:</span>
                          <span className="info-value">{checkpoint.size}</span>
                        </Col>
                        <Col span={8}>
                          <span className="info-label">Loss:</span>
                          <span className="info-value">{checkpoint.loss}</span>
                        </Col>
                      </Row>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card title="操作历史" bordered={false}>
              <Timeline>
                {jobData.events.map((event, index) => (
                  <Timeline.Item key={index}>
                    <Space direction="vertical" size="small">
                      <div>
                        <strong>{event.action}</strong>
                        <Tag theme="success" size="small" style={{ marginLeft: '8px' }}>
                          {event.result}
                        </Tag>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {event.user} · {event.time}
                      </div>
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </Col>
        </Row>

        {/* Kubernetes资源信息 */}
        <Card title="Kubernetes资源" style={{ marginTop: 16 }} bordered={false}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">Namespace:</span>
                <span className="info-value">{jobData.k8sResources.namespace}</span>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">Pod名称:</span>
                <span className="info-value">{jobData.k8sResources.podName}</span>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">Pod状态:</span>
                <span className="info-value">
                  <Tag theme="success" icon={<CheckCircleIcon />}>
                    {jobData.k8sResources.podStatus}
                  </Tag>
                </span>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">节点:</span>
                <span className="info-value">{jobData.k8sResources.node}</span>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">Service:</span>
                <span className="info-value">{jobData.k8sResources.service}</span>
              </div>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <div className="info-item">
                <span className="info-label">PVC:</span>
                <span className="info-value">{jobData.k8sResources.pvc}</span>
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