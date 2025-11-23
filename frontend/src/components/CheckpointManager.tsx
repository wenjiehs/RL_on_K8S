import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  MessagePlugin,
  Dialog,
  Loading,
  Empty
} from 'tdesign-react';
import {
  DownloadIcon,
  DeleteIcon,
  RefreshIcon,
  SaveIcon,
  TimeIcon
} from 'tdesign-icons-react';

interface Checkpoint {
  name: string;
  path: string;
  size: number;
  sizeStr: string;
  step: number;
  loss: number;
  timestamp: string;
}

interface CheckpointManagerProps {
  jobId: string;
  jobStatus: string;
}

const CheckpointManager: React.FC<CheckpointManagerProps> = ({ jobId, jobStatus }) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<Checkpoint | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // 检测屏幕尺寸
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 获取checkpoint列表
  const fetchCheckpoints = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/training-jobs/checkpoints?id=${jobId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCheckpoints(data.checkpoints || []);
        } else {
          MessagePlugin.error(data.error || '获取checkpoint列表失败');
        }
      } else {
        MessagePlugin.error('获取checkpoint列表失败');
      }
    } catch (error) {
      console.error('Failed to fetch checkpoints:', error);
      MessagePlugin.error('获取checkpoint列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 下载checkpoint
  const handleDownload = async (checkpoint: Checkpoint) => {
    setDownloading(checkpoint.name);
    try {
      const url = `http://localhost:8080/api/training-jobs/checkpoint/download?id=${jobId}&path=${encodeURIComponent(checkpoint.path)}`;
      
      // 使用fetch下载，支持更好的错误处理和跨域场景
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`下载失败: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      // 获取文件内容为Blob
      const blob = await response.blob();
      
      // 从响应头获取建议的文件名，如果没有则使用checkpoint名称
      const contentDisposition = response.headers.get('Content-Disposition');
      let downloadFilename = checkpoint.name;
      
      if (contentDisposition) {
        // 解析 Content-Disposition: attachment; filename="xxx.tar.gz"
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          downloadFilename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      // 创建临时URL并触发下载
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 释放URL对象，避免内存泄漏
      window.URL.revokeObjectURL(downloadUrl);
      
      MessagePlugin.success(`下载 ${downloadFilename} 成功`);
    } catch (error) {
      console.error('Failed to download checkpoint:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      MessagePlugin.error(`下载checkpoint失败: ${errorMessage}`);
    } finally {
      setDownloading(null);
    }
  };

  // 删除checkpoint
  const handleDelete = async () => {
    if (!selectedCheckpoint) return;

    try {
      const response = await fetch(
        `http://localhost:8080/api/training-jobs/checkpoint/delete?id=${jobId}&path=${encodeURIComponent(selectedCheckpoint.path)}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          MessagePlugin.success('删除checkpoint成功');
          fetchCheckpoints(); // 刷新列表
        } else {
          MessagePlugin.error(data.error || '删除checkpoint失败');
        }
      } else {
        MessagePlugin.error('删除checkpoint失败');
      }
    } catch (error) {
      console.error('Failed to delete checkpoint:', error);
      MessagePlugin.error('删除checkpoint失败');
    } finally {
      setDeleteDialogVisible(false);
      setSelectedCheckpoint(null);
    }
  };

  // 确认删除
  const confirmDelete = (checkpoint: Checkpoint) => {
    setSelectedCheckpoint(checkpoint);
    setDeleteDialogVisible(true);
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  // 表格列定义 - 桌面端
  const desktopColumns = [
    {
      colKey: 'name',
      title: 'Checkpoint名称',
      width: 250,
      cell: ({ row }: { row: Checkpoint }) => (
        <Space>
          <SaveIcon style={{ color: '#0052D9' }} />
          <span style={{ fontFamily: 'monospace' }}>{row.name}</span>
        </Space>
      )
    },
    {
      colKey: 'step',
      title: '训练步数',
      width: 120,
      cell: ({ row }: { row: Checkpoint }) => (
        <Tag theme="primary" variant="light">
          {row.step > 0 ? `Step ${row.step}` : '-'}
        </Tag>
      )
    },
    {
      colKey: 'loss',
      title: 'Loss',
      width: 100,
      cell: ({ row }: { row: Checkpoint }) => (
        <span style={{ fontFamily: 'monospace' }}>
          {row.loss > 0 ? row.loss.toFixed(4) : '-'}
        </span>
      )
    },
    {
      colKey: 'size',
      title: '文件大小',
      width: 120,
      cell: ({ row }: { row: Checkpoint }) => (
        <span style={{ color: '#666' }}>{row.sizeStr}</span>
      )
    },
    {
      colKey: 'timestamp',
      title: '创建时间',
      width: 180,
      cell: ({ row }: { row: Checkpoint }) => (
        <Space size="small">
          <TimeIcon style={{ color: '#999', fontSize: '14px' }} />
          <span style={{ fontSize: '13px', color: '#666' }}>
            {formatTime(row.timestamp)}
          </span>
        </Space>
      )
    },
    {
      colKey: 'operation',
      title: '操作',
      width: 150,
      fixed: 'right' as const,
      cell: ({ row }: { row: Checkpoint }) => (
        <Space>
          <Button
            size="small"
            theme="primary"
            variant="outline"
            icon={<DownloadIcon />}
            loading={downloading === row.name}
            onClick={() => handleDownload(row)}
          >
            下载
          </Button>
          <Button
            size="small"
            theme="danger"
            variant="outline"
            icon={<DeleteIcon />}
            onClick={() => confirmDelete(row)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  // 表格列定义 - 移动端（简化版）
  const mobileColumns = [
    {
      colKey: 'name',
      title: 'Checkpoint信息',
      cell: ({ row }: { row: Checkpoint }) => (
        <div style={{ padding: '8px 0' }}>
          <div style={{ marginBottom: '8px' }}>
            <Space>
              <SaveIcon style={{ color: '#0052D9' }} />
              <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{row.name}</span>
            </Space>
          </div>
          <Space direction="vertical" size="small" style={{ width: '100%', fontSize: '12px', color: '#666' }}>
            <div>
              <span>步数: </span>
              {row.step > 0 ? (
                <Tag theme="primary" variant="light" size="small">Step {row.step}</Tag>
              ) : '-'}
              <span style={{ marginLeft: '12px' }}>Loss: {row.loss > 0 ? row.loss.toFixed(4) : '-'}</span>
            </div>
            <div>大小: {row.sizeStr} | {formatTime(row.timestamp)}</div>
          </Space>
        </div>
      )
    },
    {
      colKey: 'operation',
      title: '操作',
      width: 80,
      cell: ({ row }: { row: Checkpoint }) => (
        <Space direction="vertical" size="small">
          <Button
            size="small"
            theme="primary"
            variant="outline"
            icon={<DownloadIcon />}
            loading={downloading === row.name}
            onClick={() => handleDownload(row)}
            block
          >
            下载
          </Button>
          <Button
            size="small"
            theme="danger"
            variant="outline"
            icon={<DeleteIcon />}
            onClick={() => confirmDelete(row)}
            block
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const columns = isMobile ? mobileColumns : desktopColumns;

  // 初始加载和自动刷新
  useEffect(() => {
    fetchCheckpoints();

    // 如果任务在运行中，每30秒自动刷新
    let interval: NodeJS.Timeout | null = null;
    if (jobStatus === 'running') {
      interval = setInterval(() => {
        fetchCheckpoints();
      }, 30000); // 30秒
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId, jobStatus]);

  return (
    <div className="checkpoint-manager">
      <Card
        title={
          <Space>
            <span>💾 模型检查点</span>
            <Tag theme={checkpoints.length > 0 ? 'success' : 'default'} size="small">
              {checkpoints.length} 个检查点
            </Tag>
            {jobStatus === 'running' && (
              <Tag theme="primary" size="small" icon={<RefreshIcon />}>
                自动刷新中
              </Tag>
            )}
          </Space>
        }
        bordered={false}
        actions={
          <Button
            size="small"
            icon={<RefreshIcon />}
            onClick={fetchCheckpoints}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Loading loading={loading} showOverlay={false}>
          {checkpoints.length === 0 ? (
            <Empty description="暂无checkpoint文件" />
          ) : (
            <Table
              data={checkpoints}
              columns={columns}
              rowKey="name"
              size="small"
              bordered
              hover
              stripe
              maxHeight={isMobile ? 500 : 400}
              tableLayout={isMobile ? 'auto' : 'fixed'}
              pagination={{
                defaultPageSize: isMobile ? 5 : 10,
                showPageSize: !isMobile,
                pageSizeOptions: [5, 10, 20, 50]
              }}
            />
          )}
        </Loading>
      </Card>

      {/* 删除确认对话框 */}
      <Dialog
        visible={deleteDialogVisible}
        header="确认删除"
        body={
          selectedCheckpoint ? (
            <div>
              <p>确定要删除以下checkpoint吗？此操作不可恢复。</p>
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: '#f5f5f5', 
                borderRadius: '4px' 
              }}>
                <div><strong>名称:</strong> {selectedCheckpoint.name}</div>
                <div><strong>大小:</strong> {selectedCheckpoint.sizeStr}</div>
                <div><strong>路径:</strong> {selectedCheckpoint.path}</div>
              </div>
            </div>
          ) : null
        }
        confirmBtn="删除"
        cancelBtn="取消"
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteDialogVisible(false);
          setSelectedCheckpoint(null);
        }}
      />

      <style jsx>{`
        .checkpoint-manager {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default CheckpointManager;
