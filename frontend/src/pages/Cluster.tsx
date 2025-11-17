import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, MessagePlugin, Empty, Row, Col, Statistic, Divider, Tag } from 'tdesign-react';
import { CloudIcon, RefreshIcon, SettingIcon, ServerIcon, CheckCircleIcon, ErrorCircleIcon } from 'tdesign-icons-react';
import ClusterConfigDialog from '../components/ClusterConfigDialog';

interface ClusterInfo {
  connected: boolean;
  clusterName: string;
  context: string;
  message: string;
}

interface ClusterStats {
  totalPods: number;
  runningPods: number;
  namespaces: number;
}

const Cluster: React.FC = () => {
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo>({
    connected: false,
    clusterName: '',
    context: '',
    message: 'Not connected to any cluster',
  });
  const [stats, setStats] = useState<ClusterStats>({
    totalPods: 0,
    runningPods: 0,
    namespaces: 0,
  });
  const [loading, setLoading] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);

  const fetchClusterInfo = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/cluster/status');
      const data = await response.json();
      setClusterInfo(data);
      
      if (data.connected) {
        await fetchClusterStats();
      }
    } catch (error) {
      console.error('Failed to fetch cluster info:', error);
    }
  }, []);

  const fetchClusterStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/cluster/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch cluster stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchClusterInfo();
  };

  const handleConnectSuccess = () => {
    fetchClusterInfo();
  };

  useEffect(() => {
    fetchClusterInfo();
  }, [fetchClusterInfo]);

  return (
    <div>
      <ClusterConfigDialog
        visible={dialogVisible}
        onClose={() => setDialogVisible(false)}
        onSuccess={handleConnectSuccess}
      />

      {!clusterInfo.connected ? (
        <Empty
          description={
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--tc-text-primary)', marginBottom: '8px' }}>
                No Cluster Connected
              </div>
              <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginBottom: '24px' }}>
                Connect to a Kubernetes cluster to view cluster information and manage resources
              </div>
              <Button theme="primary" size="large" icon={<SettingIcon />} onClick={() => setDialogVisible(true)}>
                Configure Cluster
              </Button>
            </div>
          }
        />
      ) : (
        <div>
          {/* Cluster Info Card */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CheckCircleIcon size="24px" style={{ color: '#00a870' }} />
                <span>Cluster Connected</span>
              </div>
            }
            actions={
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button icon={<RefreshIcon />} onClick={handleRefresh} loading={loading}>
                  Refresh
                </Button>
                <Button icon={<SettingIcon />} onClick={() => setDialogVisible(true)}>
                  Reconfigure
                </Button>
              </div>
            }
            bordered
            style={{ marginBottom: '24px' }}
          >
            <Row gutter={[24, 16]}>
              <Col span={6}>
                <div style={{ marginBottom: '8px', color: 'var(--tc-text-secondary)', fontSize: '13px' }}>
                  Cluster Name
                </div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--tc-text-primary)' }}>
                  {clusterInfo.clusterName || 'N/A'}
                </div>
              </Col>
              <Col span={6}>
                <div style={{ marginBottom: '8px', color: 'var(--tc-text-secondary)', fontSize: '13px' }}>
                  Context
                </div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--tc-text-primary)' }}>
                  {clusterInfo.context || 'N/A'}
                </div>
              </Col>
              <Col span={6}>
                <div style={{ marginBottom: '8px', color: 'var(--tc-text-secondary)', fontSize: '13px' }}>
                  Status
                </div>
                <Tag theme="success" variant="light">
                  Connected
                </Tag>
              </Col>
              <Col span={6}>
                <div style={{ marginBottom: '8px', color: 'var(--tc-text-secondary)', fontSize: '13px' }}>
                  API Version
                </div>
                <div style={{ fontSize: '16px', fontWeight: '500', color: 'var(--tc-text-primary)' }}>
                  v1.28+
                </div>
              </Col>
            </Row>
          </Card>

          {/* Cluster Statistics */}
          <Card title="Cluster Statistics" bordered>
            <Row gutter={[24, 24]}>
              <Col span={8}>
                <Card bordered style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: '#fff' }}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>Total Pods</span>}
                    value={stats.totalPods}
                    suffix={
                      <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)' }}>
                        / {stats.runningPods} Running
                      </span>
                    }
                    loading={loading}
                  />
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                    <CloudIcon size="24px" style={{ opacity: 0.8 }} />
                  </div>
                </Card>
              </Col>

              <Col span={8}>
                <Card bordered style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: '#fff' }}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>Namespaces</span>}
                    value={stats.namespaces}
                    loading={loading}
                  />
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>Active Namespaces</div>
                  </div>
                </Card>
              </Col>

              <Col span={8}>
                <Card bordered style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: '#fff' }}>
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>Pod Health Rate</span>}
                    value={stats.totalPods > 0 ? Math.round((stats.runningPods / stats.totalPods) * 100) : 0}
                    suffix="%"
                    loading={loading}
                  />
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                    <CheckCircleIcon size="24px" style={{ opacity: 0.8 }} />
                  </div>
                </Card>
              </Col>
            </Row>

            <Divider />

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--tc-text-secondary)', marginBottom: '8px' }}>
                    Pod Running Rate
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#00a870' }}>
                    {stats.totalPods > 0 ? ((stats.runningPods / stats.totalPods) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--tc-text-secondary)', marginBottom: '8px' }}>
                    Total Pods in Cluster
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#ed7b2f' }}>
                    {stats.totalPods}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Cluster;