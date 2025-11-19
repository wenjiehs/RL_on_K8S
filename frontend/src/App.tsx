import { useState, useEffect } from 'react';
import './App.css';
import { Layout, Menu, Space, Tag, Button } from 'tdesign-react';
import {
  DashboardIcon,
  ServerIcon,
  ControlPlatformIcon,
  DataIcon,
  LinkIcon,
  RocketIcon,
  CloudIcon,
  CloseCircleIcon,
} from 'tdesign-icons-react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Dashboard, Environments, EnvironmentDetail, TrainingJobs, DataManagement, TrainingJobDetail } from './pages';
import Cluster from './pages/Cluster';
import TestTabs from './pages/TestTabs';
import ClusterConfigDialog from './components/ClusterConfigDialog';

interface ClusterStatus {
  connected: boolean;
  message: string;
  clusterName?: string;
  context?: string;
}

const AppContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.substring(1);
  const [activeMenu, setActiveMenu] = useState(currentPath || 'dashboard');
  const [clusterStatus, setClusterStatus] = useState<ClusterStatus>({
    connected: false,
    message: 'Not connected',
  });
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  const handleMenuChange = (value: string) => {
    setActiveMenu(value);
    navigate(`/${value}`);
  };

  const fetchClusterStatus = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/cluster/status');
      const data = await response.json();
      setClusterStatus(data);
    } catch (error) {
      console.error('Failed to fetch cluster status:', error);
      setClusterStatus({
        connected: false,
        message: 'Connection error',
      });
    }
  };

  useEffect(() => {
    // Fetch initial status
    fetchClusterStatus();

    // Poll status every 10 seconds
    const interval = setInterval(fetchClusterStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleConfigSuccess = () => {
    // Refresh cluster status after successful connection
    fetchClusterStatus();
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Aside className="rl-sidebar">
        <div className="rl-logo">
          <RocketIcon />
          <span>RL Web</span>
        </div>
        <Menu theme="dark" value={activeMenu} onChange={(v) => handleMenuChange(v as string)}>
          <Menu.MenuItem value="dashboard" icon={<DashboardIcon />}>
            Dashboard
          </Menu.MenuItem>
          <Menu.MenuItem value="training" icon={<ControlPlatformIcon />}>
            Training Jobs
          </Menu.MenuItem>
          <Menu.MenuItem value="environments" icon={<ServerIcon />}>
            Environments
          </Menu.MenuItem>
          <Menu.MenuItem value="data" icon={<DataIcon />}>
            Data Management
          </Menu.MenuItem>
          <Menu.MenuItem value="cluster" icon={<CloudIcon />}>
            Cluster
          </Menu.MenuItem>
        </Menu>
      </Layout.Aside>
      <Layout>
        <Layout.Header style={{ background: 'var(--tc-bg-component)', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid var(--tc-border-color)' }}>
          <Space align="center">
            <Tag theme={clusterStatus.connected ? 'success' : 'default'} variant="light">
              {clusterStatus.connected ? <LinkIcon /> : <CloseCircleIcon />}
              <span style={{ marginLeft: '4px' }}>
                {clusterStatus.connected ? 'Connected' : 'Not Connected'}
              </span>
            </Tag>
            {clusterStatus.connected && clusterStatus.clusterName && (
              <span style={{ color: 'var(--tc-text-secondary)', fontSize: '14px' }}>
                {clusterStatus.clusterName}
              </span>
            )}
            <Button 
              variant="outline" 
              icon={<CloudIcon />}
              onClick={() => setShowConfigDialog(true)}
            >
              {clusterStatus.connected ? 'Switch Cluster' : 'Configure Cluster'}
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ padding: '24px' }}>
          <div style={{ padding: 24, minHeight: 'calc(100vh - 64px - 48px - 70px)', background: 'var(--tc-bg-component)', borderRadius: '3px' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/training" element={<TrainingJobs />} />
              <Route path="/training/:id" element={<TrainingJobDetail />} />
              <Route path="/environments" element={<Environments />} />
              <Route path="/environments/:id" element={<EnvironmentDetail />} />
              <Route path="/data" element={<DataManagement />} />
              <Route path="/cluster" element={<Cluster />} />
              <Route path="/test-tabs" element={<TestTabs />} />
            </Routes>
          </div>
        </Layout.Content>
        <Layout.Footer style={{ textAlign: 'center', color: 'var(--tc-text-secondary)' }}>
          RL Web ©2025 Created by CodeBuddy
        </Layout.Footer>
      </Layout>

      <ClusterConfigDialog
        visible={showConfigDialog}
        onClose={() => setShowConfigDialog(false)}
        onSuccess={handleConfigSuccess}
      />
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;