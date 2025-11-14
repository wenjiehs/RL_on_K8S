import React from 'react';
import { Card, Row, Col, Button, Space, Tag } from 'tdesign-react';
import { AddIcon, ServerIcon, ControlPlatformIcon, DataIcon, ChartIcon } from 'tdesign-icons-react';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const statsCards = [
    { title: 'Running Environments', value: '8', change: '+2', trend: 'up', icon: <ServerIcon size="32px" />, color: '#0d6eff' },
    { title: 'Active Training Jobs', value: '12', change: '+5', trend: 'up', icon: <ControlPlatformIcon size="32px" />, color: '#00a870' },
    { title: 'Total Datasets', value: '45', change: '+8', trend: 'up', icon: <DataIcon size="32px" />, color: '#ed7b2f' },
    { title: 'Avg. Reward (24h)', value: '287.5', change: '+12.3%', trend: 'up', icon: <ChartIcon size="32px" />, color: '#0052d9' },
  ];

  const quickActions = [
    { label: 'Create Environment', icon: <ServerIcon />, action: () => navigate('/environments') },
    { label: 'Start Training Job', icon: <ControlPlatformIcon />, action: () => navigate('/training') },
    { label: 'Upload Dataset', icon: <DataIcon />, action: () => navigate('/data') },
    { label: 'View Monitoring', icon: <ChartIcon />, action: () => navigate('/monitoring') },
  ];

  const recentActivities = [
    { time: '2 mins ago', event: 'Training job job-e8b1c3 started', type: 'info' },
    { time: '15 mins ago', event: 'Environment cartpole-env-1 scaled to 5 replicas', type: 'success' },
    { time: '1 hour ago', event: 'Training job job-f1a9e7 failed: OOMKilled', type: 'error' },
    { time: '2 hours ago', event: 'Dataset lunar-lander-manual-set uploaded', type: 'info' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stats Cards */}
      <Row gutter={[16, 16]}>
        {statsCards.map((stat, index) => (
          <Col key={index} span={6}>
            <Card bordered style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginBottom: '8px' }}>
                    {stat.title}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--tc-text-primary)', marginBottom: '4px' }}>
                    {stat.value}
                  </div>
                  <Tag theme="success" variant="light" style={{ fontSize: '12px' }}>
                    {stat.change}
                  </Tag>
                </div>
                <div style={{ color: stat.color, opacity: 0.2 }}>
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Quick Actions */}
      <Card title="Quick Actions" bordered style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Space size="large">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              icon={action.icon}
              onClick={action.action}
              style={{ minWidth: '160px' }}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      </Card>

      {/* Recent Activities */}
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="Recent Activities" bordered style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {recentActivities.map((activity, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Tag
                    theme={activity.type === 'error' ? 'danger' : activity.type === 'success' ? 'success' : 'primary'}
                    variant="light"
                    style={{ minWidth: '60px', textAlign: 'center' }}
                  >
                    {activity.type}
                  </Tag>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: 'var(--tc-text-primary)' }}>{activity.event}</div>
                    <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)', marginTop: '4px' }}>
                      {activity.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="System Status" bordered style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--tc-text-secondary)' }}>Cluster Status</span>
                <Tag theme="success" variant="light">Healthy</Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--tc-text-secondary)' }}>CPU Usage</span>
                <span style={{ fontWeight: '500' }}>45%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--tc-text-secondary)' }}>Memory Usage</span>
                <span style={{ fontWeight: '500' }}>62%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--tc-text-secondary)' }}>Active Pods</span>
                <span style={{ fontWeight: '500' }}>28</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--tc-text-secondary)' }}>Storage Used</span>
                <span style={{ fontWeight: '500' }}>156 GB / 500 GB</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;