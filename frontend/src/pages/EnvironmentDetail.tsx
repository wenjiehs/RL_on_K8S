import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Space, 
  Tag, 
  MessagePlugin, 
  Loading,
  Divider,
  Row,
  Col
} from 'tdesign-react';
import { 
  ArrowLeftIcon, 
  RefreshIcon, 
  LinkIcon,
  CheckCircleIcon,
  ErrorCircleIcon,
  TimeIcon
} from 'tdesign-icons-react';

interface EnvironmentDetail {
  id: string;
  name: string;
  framework: string;
  image: string;
  replicas: number;
  status: string;
  namespace: string;
  createdAt: string;
  rayVersion?: string;
  pythonVersion?: string;
  resources: {
    cpu: string;
    memory: string;
    gpu?: string;
    gpuType?: string;
  };
  storage: {
    persistentVolumePath?: string;
    size?: string;
  };
  network: {
    headNodeIP?: string;
    dashboardPort?: string;
    clientPort?: string;
  };
  nodes: {
    head: number;
    workers: number;
  };
}

interface DashboardURLResponse {
  url?: string;
  available: boolean;
  message: string;
}

const EnvironmentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<EnvironmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('');
  const [dashboardInfo, setDashboardInfo] = useState<DashboardURLResponse | null>(null);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const name = params.get('name') || id;
      const namespace = params.get('namespace') || 'default';
      const framework = params.get('framework') || 'ray';

      const response = await fetch(
        `http://localhost:8080/api/environments/detail?name=${name}&namespace=${namespace}&framework=${framework}`
      );

      if (response.ok) {
        const data = await response.json();
        setDetail(data);
        setCurrentStatus(data.status);
      } else {
        const error = await response.json();
        MessagePlugin.error(error.error || 'Failed to fetch environment details');
        navigate('/environments');
      }
    } catch (error) {
      console.error('Failed to fetch environment details:', error);
      MessagePlugin.error('Network error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    if (!detail) return;
    
    setStatusLoading(true);
    try {
      const response = await fetch(
        `http://localhost:8080/api/environments/status?name=${detail.name}&namespace=${detail.namespace}&framework=${detail.framework}`
      );

      if (response.ok) {
        const data = await response.json();
        setCurrentStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  const fetchDashboardURL = async () => {
    if (!detail || detail.framework !== 'ray') return;

    try {
      const response = await fetch(
        `http://localhost:8080/api/environments/dashboard-url?name=${detail.name}&namespace=${detail.namespace}`
      );

      if (response.ok) {
        const data = await response.json();
        setDashboardInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard URL:', error);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  useEffect(() => {
    if (!detail) return;

    // Fetch status immediately
    fetchStatus();
    
    // Fetch dashboard URL if Ray
    if (detail.framework === 'ray') {
      fetchDashboardURL();
    }

    // Poll status every 5 seconds
    const interval = setInterval(() => {
      fetchStatus();
      if (detail.framework === 'ray') {
        fetchDashboardURL();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [detail]);

  const handleConnectDashboard = () => {
    if (!dashboardInfo || !dashboardInfo.available) {
      MessagePlugin.warning(dashboardInfo?.message || 'Dashboard is not available');
      return;
    }

    if (dashboardInfo.url) {
      // Show instructions for port-forwarding
      MessagePlugin.info({
        content: `Dashboard URL: ${dashboardInfo.url}. Please use kubectl port-forward to access it locally.`,
        duration: 5000,
      });
      
      // Copy command to clipboard
      const portForwardCmd = `kubectl port-forward -n ${detail?.namespace} svc/${detail?.name}-head-svc 8265:8265`;
      navigator.clipboard.writeText(portForwardCmd);
      MessagePlugin.success('Port-forward command copied to clipboard!');
    }
  };

  const getStatusTheme = (status: string) => {
    const themeMap: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
      running: 'success',
      pending: 'warning',
      stopped: 'default',
      error: 'danger',
    };
    return themeMap[status] || 'default';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'running') return <CheckCircleIcon />;
    if (status === 'error') return <ErrorCircleIcon />;
    return <TimeIcon />;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Loading size="large" text="Loading environment details..." />
      </div>
    );
  }

  if (!detail) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Environment not found</p>
          <Button onClick={() => navigate('/environments')} style={{ marginTop: '16px' }}>
            Back to Environments
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card bordered={false}>
          <Space direction="vertical" size="medium" style={{ width: '100%' }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space size="large">
                <Button 
                  icon={<ArrowLeftIcon />} 
                  variant="outline" 
                  onClick={() => navigate('/environments')}
                >
                  Back
                </Button>
                <div>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>{detail.name}</h2>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--tc-text-secondary)', fontSize: '14px' }}>
                    Environment ID: {detail.id}
                  </p>
                </div>
              </Space>
              <Space>
                <Tag 
                  theme={getStatusTheme(currentStatus)} 
                  variant="light"
                  icon={getStatusIcon(currentStatus)}
                >
                  {currentStatus}
                </Tag>
                <Button 
                  icon={<RefreshIcon />} 
                  variant="outline" 
                  onClick={fetchDetail}
                  loading={statusLoading}
                >
                  Refresh
                </Button>
              </Space>
            </Space>
          </Space>
        </Card>

        {/* Basic Information */}
        <Card title="Basic Information" bordered={false}>
          <Row gutter={[24, 16]}>
            <Col span={6}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Name</div>
              <div style={{ fontWeight: '500' }}>{detail.name}</div>
            </Col>
            <Col span={6}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Framework</div>
              <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>{detail.framework}</div>
            </Col>
            <Col span={6}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Namespace</div>
              <div style={{ fontWeight: '500' }}>{detail.namespace}</div>
            </Col>
            <Col span={6}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Status</div>
              <Tag theme={getStatusTheme(currentStatus)} variant="light">
                {currentStatus}
              </Tag>
            </Col>
            <Col span={6}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Created At</div>
              <div style={{ fontWeight: '500' }}>{new Date(detail.createdAt).toLocaleString()}</div>
            </Col>
            <Col span={18}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Image</div>
              <code style={{ 
                background: 'var(--tc-bg-color-container)', 
                padding: '4px 12px', 
                borderRadius: '4px',
                fontSize: '13px',
                display: 'inline-block'
              }}>
                {detail.image}
              </code>
            </Col>
          </Row>
        </Card>

        {/* Configuration */}
        <Card title="Configuration" bordered={false}>
          <Row gutter={[24, 16]}>
            {detail.rayVersion && (
              <Col span={6}>
                <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Ray Version</div>
                <div style={{ fontWeight: '500' }}>{detail.rayVersion}</div>
              </Col>
            )}
            {detail.pythonVersion && (
              <Col span={6}>
                <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Python Version</div>
                <div style={{ fontWeight: '500' }}>{detail.pythonVersion}</div>
              </Col>
            )}
            <Col span={6}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>CPU Allocation</div>
              <div style={{ fontWeight: '500' }}>{detail.resources.cpu}</div>
            </Col>
            <Col span={6}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Memory Allocation</div>
              <div style={{ fontWeight: '500' }}>{detail.resources.memory}</div>
            </Col>
            {detail.resources.gpu && (
              <>
                <Col span={6}>
                  <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>GPU Allocation</div>
                  <div style={{ fontWeight: '500' }}>{detail.resources.gpu}</div>
                </Col>
                <Col span={6}>
                  <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>GPU Type</div>
                  <div style={{ fontWeight: '500' }}>{detail.resources.gpuType}</div>
                </Col>
              </>
            )}
          </Row>
        </Card>

        {/* Node Configuration */}
        <Card title="Node Configuration" bordered={false}>
          <Row gutter={[24, 16]}>
            <Col span={8}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Head Nodes</div>
              <div style={{ fontWeight: '500', fontSize: '20px' }}>{detail.nodes.head}</div>
            </Col>
            <Col span={8}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Worker Nodes</div>
              <div style={{ fontWeight: '500', fontSize: '20px' }}>{detail.nodes.workers}</div>
            </Col>
            <Col span={8}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Total Nodes</div>
              <div style={{ fontWeight: '500', fontSize: '20px' }}>{detail.nodes.head + detail.nodes.workers}</div>
            </Col>
          </Row>
        </Card>

        {/* Storage */}
        <Card title="Storage" bordered={false}>
          <Row gutter={[24, 16]}>
            <Col span={12}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Persistent Volume Path</div>
              <div style={{ fontWeight: '500' }}>{detail.storage.persistentVolumePath || 'N/A'}</div>
            </Col>
            <Col span={12}>
              <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Storage Size</div>
              <div style={{ fontWeight: '500' }}>{detail.storage.size || 'N/A'}</div>
            </Col>
          </Row>
        </Card>

        {/* Network (Ray only) */}
        {detail.framework === 'ray' && (
          <Card title="Network" bordered={false}>
            <Row gutter={[24, 16]}>
              <Col span={8}>
                <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Head Node IP</div>
                <div style={{ fontWeight: '500', fontFamily: 'monospace' }}>
                  {detail.network.headNodeIP || 'N/A'}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Dashboard Port</div>
                <div style={{ fontWeight: '500', fontFamily: 'monospace' }}>
                  {detail.network.dashboardPort || 'N/A'}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>Client Port</div>
                <div style={{ fontWeight: '500', fontFamily: 'monospace' }}>
                  {detail.network.clientPort || 'N/A'}
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {/* Ray Dashboard Connection */}
        {detail.framework === 'ray' && (
          <Card title="Ray Dashboard" bordered={false}>
            <Space direction="vertical" size="medium" style={{ width: '100%' }}>
              <div style={{ 
                padding: '16px', 
                background: currentStatus === 'running' 
                  ? 'var(--tc-success-color-1)' 
                  : 'var(--tc-warning-color-1)',
                borderRadius: '6px',
                border: `1px solid ${currentStatus === 'running' 
                  ? 'var(--tc-success-color-3)' 
                  : 'var(--tc-warning-color-3)'}`
              }}>
                <Space direction="vertical" size="small">
                  <div style={{ fontWeight: '500' }}>
                    {currentStatus === 'running' ? 'Dashboard Available' : 'Dashboard Not Available'}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)' }}>
                    {dashboardInfo?.message || 'Checking dashboard status...'}
                  </div>
                </Space>
              </div>

              <Divider />

              <div>
                <h4 style={{ marginTop: 0, marginBottom: '12px' }}>Access Instructions</h4>
                <ol style={{ paddingLeft: '20px', margin: 0, lineHeight: '1.8' }}>
                  <li>Ensure the Ray cluster is running</li>
                  <li>Click the button below to copy the port-forward command</li>
                  <li>Run the command in your terminal</li>
                  <li>Access the dashboard at <code>http://localhost:8265</code></li>
                </ol>
              </div>

              <Button 
                theme="primary" 
                icon={<LinkIcon />}
                onClick={handleConnectDashboard}
                disabled={currentStatus !== 'running'}
                block
              >
                {currentStatus === 'running' 
                  ? 'Copy Port-Forward Command' 
                  : 'Start Cluster to Enable Dashboard'}
              </Button>

              {dashboardInfo?.url && (
                <div style={{ 
                  marginTop: '12px', 
                  padding: '12px', 
                  background: 'var(--tc-bg-color-container)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'monospace'
                }}>
                  kubectl port-forward -n {detail.namespace} svc/{detail.name}-head-svc 8265:8265
                </div>
              )}
            </Space>
          </Card>
        )}
      </Space>
    </div>
  );
};

export default EnvironmentDetail;