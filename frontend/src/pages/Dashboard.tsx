import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Space, Tag, Loading, MessagePlugin } from 'tdesign-react';
import { ServerIcon, ControlPlatformIcon, DataIcon, RollbackIcon } from 'tdesign-icons-react';
import { useNavigate } from 'react-router-dom';

interface DashboardStats {
  totalEnvironments: number;
  runningEnvironments: number;
  totalTrainingJobs: number;
  runningTrainingJobs: number;
  completedTrainingJobs: number;
  failedTrainingJobs: number;
  totalPods: number;
  runningPods: number;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // 获取统计数据
  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      // 获取环境列表
      const envResponse = await fetch('http://localhost:8080/api/environments');
      const envData = await envResponse.json();
      
      // 获取训练任务列表
      const jobsResponse = await fetch('http://localhost:8080/api/training-jobs');
      const jobsData = await jobsResponse.json();
      
      // 获取集群统计
      const clusterResponse = await fetch('http://localhost:8080/api/cluster/stats');
      const clusterData = await clusterResponse.json();

      // 计算统计数据
      // API直接返回数组,不是包装在对象里
      const environments = Array.isArray(envData) ? envData : [];
      const runningEnvs = environments.filter((env: any) => env.status === 'Running').length;

      const jobs = Array.isArray(jobsData) ? jobsData : (jobsData.jobs || []);
      const runningJobs = jobs.filter((job: any) => job.status === 'running').length;
      const completedJobs = jobs.filter((job: any) => job.status === 'completed').length;
      const failedJobs = jobs.filter((job: any) => job.status === 'failed').length;

      setStats({
        totalEnvironments: environments.length,
        runningEnvironments: runningEnvs,
        totalTrainingJobs: jobs.length,
        runningTrainingJobs: runningJobs,
        completedTrainingJobs: completedJobs,
        failedTrainingJobs: failedJobs,
        totalPods: clusterData.totalPods || 0,
        runningPods: clusterData.runningPods || 0,
      });
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      MessagePlugin.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
    // 每30秒刷新一次
    const interval = setInterval(fetchDashboardStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const quickActions = [
    { 
      label: '创建环境', 
      icon: <ServerIcon />, 
      action: () => navigate('/environments'),
      theme: 'primary' as const
    },
    { 
      label: '创建训练任务', 
      icon: <ControlPlatformIcon />, 
      action: () => navigate('/training'),
      theme: 'success' as const
    },
    { 
      label: '查看数据集', 
      icon: <DataIcon />, 
      action: () => navigate('/data'),
      theme: 'warning' as const
    },
    { 
      label: '集群管理', 
      icon: <RollbackIcon />, 
      action: () => navigate('/cluster'),
      theme: 'default' as const
    },
  ];

  if (loading || !stats) {
    return (
      <div style={{ padding: '24px' }}>
        <Loading loading={true} text="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, marginBottom: '8px' }}>控制台概览</h2>
        <p style={{ margin: 0, color: 'var(--td-text-color-secondary)' }}>
          强化学习训练平台运行状态总览
        </p>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* 训练环境统计 */}
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card 
            bordered 
            hoverable
            style={{ 
              borderRadius: '8px', 
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/environments')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: 'var(--td-text-color-secondary)', marginBottom: '8px' }}>
                  训练环境
                </div>
                <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--td-text-color-primary)', marginBottom: '8px' }}>
                  {stats.totalEnvironments}
                </div>
                <Tag theme="success" variant="light" size="small">
                  运行中: {stats.runningEnvironments}
                </Tag>
              </div>
              <div style={{ color: '#0052D9', opacity: 0.15 }}>
                <ServerIcon size="48px" />
              </div>
            </div>
          </Card>
        </Col>

        {/* 训练任务统计 */}
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card 
            bordered 
            hoverable
            style={{ 
              borderRadius: '8px', 
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/training')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: 'var(--td-text-color-secondary)', marginBottom: '8px' }}>
                  训练任务
                </div>
                <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--td-text-color-primary)', marginBottom: '8px' }}>
                  {stats.totalTrainingJobs}
                </div>
                <Space size="small">
                  <Tag theme="primary" variant="light" size="small">
                    运行: {stats.runningTrainingJobs}
                  </Tag>
                  <Tag theme="success" variant="light" size="small">
                    完成: {stats.completedTrainingJobs}
                  </Tag>
                </Space>
              </div>
              <div style={{ color: '#00A870', opacity: 0.15 }}>
                <ControlPlatformIcon size="48px" />
              </div>
            </div>
          </Card>
        </Col>

        {/* 失败任务统计 */}
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card 
            bordered 
            hoverable
            style={{ 
              borderRadius: '8px', 
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/training')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: 'var(--td-text-color-secondary)', marginBottom: '8px' }}>
                  失败任务
                </div>
                <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--td-text-color-primary)', marginBottom: '8px' }}>
                  {stats.failedTrainingJobs}
                </div>
                <Tag theme="danger" variant="light" size="small">
                  需要处理
                </Tag>
              </div>
              <div style={{ color: '#E34D59', opacity: 0.15 }}>
                <ControlPlatformIcon size="48px" />
              </div>
            </div>
          </Card>
        </Col>

        {/* 集群Pod统计 */}
        <Col xs={24} sm={12} md={12} lg={6}>
          <Card 
            bordered 
            hoverable
            style={{ 
              borderRadius: '8px', 
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/cluster')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: 'var(--td-text-color-secondary)', marginBottom: '8px' }}>
                  集群Pod
                </div>
                <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--td-text-color-primary)', marginBottom: '8px' }}>
                  {stats.totalPods}
                </div>
                <Tag theme="success" variant="light" size="small">
                  运行中: {stats.runningPods}
                </Tag>
              </div>
              <div style={{ color: '#ED7B2F', opacity: 0.15 }}>
                <RollbackIcon size="48px" />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card 
        title="快速操作" 
        bordered 
        style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
      >
        <Row gutter={[16, 16]}>
          {quickActions.map((action, index) => (
            <Col key={index} xs={12} sm={6} md={6} lg={6}>
              <Button
                theme={action.theme}
                icon={action.icon}
                onClick={action.action}
                block
                size="large"
              >
                {action.label}
              </Button>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

export default Dashboard;