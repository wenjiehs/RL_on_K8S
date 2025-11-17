import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, MessagePlugin, Loading } from 'tdesign-react';
import { FolderIcon, FileIcon } from 'tdesign-icons-react';

// Statistics from CFS filesystem (no CRD dependency)
interface DatasetStats {
  totalDatasets: number;
  totalSize: number;
  typeBreakdown: Record<string, number>;
  sizeBreakdown: Record<string, number>;
  recentUploads: Array<{
    name: string;
    experimentId: string;
    dataType: string;
    size: number;
    createdAt: string;
  }>;
}

interface StorageStatsProps {
  namespace: string;
}

const StorageStats: React.FC<StorageStatsProps> = ({ namespace }) => {
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch statistics from CFS filesystem (direct file system access, no CRD)
      const response = await fetch(`http://localhost:8080/api/datasets/stats?namespace=${namespace}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        const error = await response.json();
        MessagePlugin.error(error.error || 'Failed to fetch statistics');
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
      MessagePlugin.error('Network error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const dataTypeColors: Record<string, string> = {
    raw: '#E37318',
    train: '#0052D9',
    eval: '#00A870',
    model: '#834EC2',
  };

  const dataTypeLabels: Record<string, string> = {
    raw: 'Raw Data',
    train: 'Training Data',
    eval: 'Evaluation Data',
    model: 'Model Files',
  };

  if (loading) {
    return (
      <Card bordered={false}>
        <Loading text="Loading statistics..." />
      </Card>
    );
  }

  return (
    <>
      {/* Overview Cards */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card bordered style={{ textAlign: 'center', height: '140px' }}>
            <FolderIcon size="32px" style={{ color: 'var(--tc-brand-color)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--tc-brand-color)' }}>
              {stats?.totalDatasets || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginTop: '8px' }}>
              Total Datasets
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered style={{ textAlign: 'center', height: '140px' }}>
            <FileIcon size="32px" style={{ color: 'var(--tc-success-color)', marginBottom: '12px' }} />
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--tc-success-color)' }}>
              {formatBytes(stats?.totalSize || 0)}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginTop: '8px' }}>
              Total Storage Used
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered style={{ textAlign: 'center', height: '140px' }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: '#E37318', marginTop: '20px' }}>
              {stats?.typeBreakdown?.raw || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginTop: '8px' }}>
              Raw Datasets
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tc-text-placeholder)', marginTop: '4px' }}>
              {formatBytes(stats?.sizeBreakdown?.raw || 0)}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered style={{ textAlign: 'center', height: '140px' }}>
            <div style={{ fontSize: '28px', fontWeight: '600', color: 'var(--tc-brand-color)', marginTop: '20px' }}>
              {stats?.typeBreakdown?.train || 0}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tc-text-secondary)', marginTop: '8px' }}>
              Training Datasets
            </div>
            <div style={{ fontSize: '12px', color: 'var(--tc-text-placeholder)', marginTop: '4px' }}>
              {formatBytes(stats?.sizeBreakdown?.train || 0)}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Data Type Breakdown */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Storage by Data Type" bordered={false}>
            <div style={{ padding: '20px' }}>
              {Object.entries(stats?.sizeBreakdown || {}).map(([type, size]) => {
                const percentage = stats?.totalSize ? (size / stats.totalSize) * 100 : 0;
                return (
                  <div key={type} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '500' }}>{dataTypeLabels[type] || type}</span>
                      <span style={{ color: 'var(--tc-text-secondary)' }}>{formatBytes(size)}</span>
                    </div>
                    <div style={{ 
                      height: '8px', 
                      backgroundColor: 'var(--tc-bg-color-container)', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${percentage}%`, 
                        backgroundColor: dataTypeColors[type] || 'var(--tc-brand-color)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Dataset Count by Type" bordered={false}>
            <div style={{ padding: '20px' }}>
              {Object.entries(stats?.typeBreakdown || {}).map(([type, count]) => {
                const total = stats?.totalDatasets || 1;
                const percentage = (count / total) * 100;
                return (
                  <div key={type} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '500' }}>{dataTypeLabels[type] || type}</span>
                      <span style={{ color: 'var(--tc-text-secondary)' }}>{count} datasets</span>
                    </div>
                    <div style={{ 
                      height: '8px', 
                      backgroundColor: 'var(--tc-bg-color-container)', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${percentage}%`, 
                        backgroundColor: dataTypeColors[type] || 'var(--tc-brand-color)',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Uploads */}
      <Card title="Recent Uploads" bordered={false}>
        {stats?.recentUploads && stats.recentUploads.length > 0 ? (
          <div style={{ padding: '12px 0' }}>
            {stats.recentUploads.map((dataset, index) => (
              <div 
                key={index} 
                style={{ 
                  padding: '12px 16px', 
                  borderBottom: index < stats.recentUploads.length - 1 ? '1px solid var(--tc-border-color)' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>{dataset.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)' }}>
                    Experiment: {dataset.experimentId} • Type: {dataset.dataType.toUpperCase()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '500', color: 'var(--tc-brand-color)' }}>
                    {formatBytes(dataset.size)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)', marginTop: '4px' }}>
                    {new Date(dataset.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--tc-text-secondary)' }}>
            No recent uploads
          </div>
        )}
      </Card>
    </>
  );
};

export default StorageStats;