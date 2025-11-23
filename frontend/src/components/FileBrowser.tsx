import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Button, Space, MessagePlugin, Drawer, Tag, Radio, Input, Breadcrumb, DialogPlugin, Divider } from 'tdesign-react';
import { 
  FolderIcon, 
  FileIcon, 
  DownloadIcon, 
  DeleteIcon, 
  SearchIcon, 
  ViewListIcon, 
  ViewModuleIcon,
  ChevronRightIcon,
  HomeIcon,
  RefreshIcon,
  FileAddIcon,
  ChevronUpIcon
} from 'tdesign-icons-react';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modTime: string;
  extension: string;
}

interface FileBrowserProps {
  namespace: string;
  datasetPath?: string;
  datasetName?: string;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ namespace, datasetPath, datasetName }) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const initialPath = datasetPath || '/cfs/rl-data';
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [pathHistory, setPathHistory] = useState<string[]>([initialPath]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchText, setSearchText] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [previewContent, setPreviewContent] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动设备
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/datasets/browse?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data: FileEntry[] = await response.json();
        setFiles(data || []);
        setCurrentPath(path);
        
        // Update path history
        if (!pathHistory.includes(path)) {
          setPathHistory([...pathHistory, path]);
        }
      } else {
        const error = await response.json();
        MessagePlugin.error(error.error || 'Failed to browse directory');
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
      MessagePlugin.error('Network error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pathHistory]);

  useEffect(() => {
    const initialPath = datasetPath || '/cfs/rl-data';
    setCurrentPath(initialPath);
    setPathHistory([initialPath]);
    fetchFiles(initialPath);
  }, [datasetPath]);

  const navigateToPath = (path: string) => {
    fetchFiles(path);
  };

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(p => p);
    const basePath = datasetPath || '/cfs/rl-data';
    const basePathParts = basePath.split('/').filter(p => p);
    
    // 只有当当前路径比基础路径深时才能向上导航
    if (parts.length > basePathParts.length) {
      parts.pop();
      const parentPath = '/' + parts.join('/');
      fetchFiles(parentPath);
    }
  };

  const handleDownload = async (file: FileEntry) => {
    try {
      MessagePlugin.loading('Downloading...', 0);
      const response = await fetch(`http://localhost:8080/api/datasets/download?path=${encodeURIComponent(file.path)}`);
      
      MessagePlugin.close();
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        MessagePlugin.success('File downloaded successfully');
      } else {
        MessagePlugin.error('Failed to download file');
      }
    } catch (error) {
      MessagePlugin.close();
      MessagePlugin.error('Network error: ' + (error as Error).message);
    }
  };

  const handleDelete = async (file: FileEntry) => {
    const dialog = DialogPlugin.confirm({
      header: 'Delete File',
      body: `Are you sure you want to delete "${file.name}"? This action cannot be undone.`,
      theme: 'warning',
      confirmBtn: 'Delete',
      cancelBtn: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await fetch(
            `http://localhost:8080/api/datasets/file/delete?path=${encodeURIComponent(file.path)}`,
            { method: 'DELETE' }
          );

          if (response.ok) {
            MessagePlugin.success('File deleted successfully');
            fetchFiles(currentPath);
          } else {
            const error = await response.json();
            MessagePlugin.error(error.error || 'Failed to delete file');
          }
        } catch (error) {
          MessagePlugin.error('Network error: ' + (error as Error).message);
        }
        dialog.hide();
      },
      onCancel: () => {
        dialog.hide();
      }
    });
  };

  const handlePreview = async (file: FileEntry) => {
    setPreviewFile(file);
    setPreviewVisible(true);
    setPreviewContent({ loading: true });

    try {
      const response = await fetch(`http://localhost:8080/api/datasets/preview?path=${encodeURIComponent(file.path)}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewContent(data);
      } else {
        setPreviewContent({ 
          type: 'error', 
          message: 'Failed to load preview' 
        });
      }
    } catch (error) {
      console.error('Failed to preview file:', error);
      setPreviewContent({ 
        type: 'error', 
        message: 'Network error: ' + (error as Error).message 
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file: FileEntry, size: string = '20px') => {
    if (file.isDir) {
      return <FolderIcon size={size} style={{ color: '#FFA940' }} />;
    }
    
    const ext = file.extension.toLowerCase();
    const iconConfig: Record<string, { color: string }> = {
      '.parquet': { color: '#0052D9' },
      '.csv': { color: '#00A870' },
      '.json': { color: '#834EC2' },
      '.txt': { color: '#666666' },
      '.py': { color: '#0052D9' },
      '.sh': { color: '#00A870' },
      '.md': { color: '#0052D9' },
      '.yaml': { color: '#834EC2' },
      '.yml': { color: '#834EC2' },
      '.log': { color: '#E37318' },
      '.png': { color: '#52C41A' },
      '.jpg': { color: '#52C41A' },
      '.jpeg': { color: '#52C41A' },
      '.gif': { color: '#52C41A' },
    };

    const config = iconConfig[ext] || { color: '#999999' };
    return <FileIcon size={size} style={{ color: config.color }} />;
  };

  const getFileTypeTag = (file: FileEntry) => {
    if (file.isDir) return <Tag theme="warning" variant="light">Folder</Tag>;
    
    const ext = file.extension.toLowerCase();
    const typeMap: Record<string, { label: string; theme: string }> = {
      '.parquet': { label: 'Parquet', theme: 'primary' },
      '.csv': { label: 'CSV', theme: 'success' },
      '.json': { label: 'JSON', theme: 'purple' },
      '.txt': { label: 'Text', theme: 'default' },
      '.py': { label: 'Python', theme: 'primary' },
      '.sh': { label: 'Shell', theme: 'success' },
      '.md': { label: 'Markdown', theme: 'primary' },
      '.yaml': { label: 'YAML', theme: 'purple' },
      '.yml': { label: 'YAML', theme: 'purple' },
      '.log': { label: 'Log', theme: 'warning' },
    };

    const type = typeMap[ext] || { label: ext.substring(1).toUpperCase() || 'File', theme: 'default' };
    return <Tag theme={type.theme as any} variant="light" size="small">{type.label}</Tag>;
  };

  // 生成面包屑路径
  const getBreadcrumbItems = () => {
    const parts = currentPath.split('/').filter(p => p);
    const items = [
      {
        content: <><HomeIcon style={{ marginRight: '4px' }} />Root</>,
        onClick: () => navigateToPath(datasetPath || '/cfs/rl-data')
      }
    ];

    let accPath = '';
    parts.forEach((part, index) => {
      accPath += '/' + part;
      const fullPath = accPath;
      
      // 跳过基础路径之前的部分
      const baseParts = (datasetPath || '/cfs/rl-data').split('/').filter(p => p);
      if (index < baseParts.length - 1) return;
      
      items.push({
        content: part,
        onClick: () => navigateToPath(fullPath)
      });
    });

    return items;
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 桌面端表格列配置
  const desktopColumns = [
    {
      colKey: 'name',
      title: 'Name',
      width: 350,
      cell: ({ row }: { row: FileEntry }) => (
        <Space align="center" style={{ cursor: row.isDir ? 'pointer' : 'default' }}>
          {getFileIcon(row)}
          <span 
            style={{ 
              fontWeight: row.isDir ? '500' : 'normal',
              color: row.isDir ? 'var(--tc-brand-color)' : 'inherit',
              fontSize: '14px'
            }}
            onClick={() => row.isDir && fetchFiles(row.path)}
          >
            {row.name}
          </span>
        </Space>
      ),
    },
    {
      colKey: 'type',
      title: 'Type',
      width: 120,
      cell: ({ row }: { row: FileEntry }) => getFileTypeTag(row),
    },
    {
      colKey: 'size',
      title: 'Size',
      width: 100,
      cell: ({ row }: { row: FileEntry }) => (
        <span style={{ color: 'var(--tc-text-secondary)', fontSize: '13px' }}>
          {row.isDir ? '-' : formatBytes(row.size)}
        </span>
      ),
    },
    {
      colKey: 'modTime',
      title: 'Modified',
      width: 180,
      cell: ({ row }: { row: FileEntry }) => (
        <span style={{ color: 'var(--tc-text-secondary)', fontSize: '13px' }}>
          {new Date(row.modTime).toLocaleString()}
        </span>
      ),
    },
    {
      colKey: 'actions',
      title: 'Actions',
      width: 200,
      fixed: 'right' as const,
      cell: ({ row }: { row: FileEntry }) => (
        !row.isDir && (
          <Space size="small">
            <Button 
              theme="primary" 
              variant="text" 
              size="small" 
              onClick={() => handlePreview(row)}
            >
              Preview
            </Button>
            <Button 
              theme="default" 
              variant="text" 
              size="small" 
              icon={<DownloadIcon />}
              onClick={() => handleDownload(row)}
            >
              Download
            </Button>
            <Button 
              theme="danger" 
              variant="text" 
              size="small" 
              icon={<DeleteIcon />}
              onClick={() => handleDelete(row)}
            >
              Delete
            </Button>
          </Space>
        )
      ),
    },
  ];

  // 移动端表格列配置（简化）
  const mobileColumns = [
    {
      colKey: 'name',
      title: 'Name',
      cell: ({ row }: { row: FileEntry }) => (
        <div onClick={() => row.isDir && fetchFiles(row.path)}>
          <Space align="center" style={{ marginBottom: '4px' }}>
            {getFileIcon(row)}
            <span style={{ 
              fontWeight: row.isDir ? '500' : 'normal',
              fontSize: '14px'
            }}>
              {row.name}
            </span>
          </Space>
          <Space size="small" style={{ marginTop: '4px' }}>
            {getFileTypeTag(row)}
            {!row.isDir && (
              <span style={{ fontSize: '12px', color: 'var(--tc-text-placeholder)' }}>
                {formatBytes(row.size)}
              </span>
            )}
          </Space>
        </div>
      ),
    },
    {
      colKey: 'actions',
      title: '',
      width: 80,
      cell: ({ row }: { row: FileEntry }) => (
        !row.isDir && (
          <Space direction="vertical" size="small">
            <Button 
              block
              size="small" 
              icon={<DownloadIcon />}
              onClick={() => handleDownload(row)}
            />
            <Button 
              block
              theme="danger" 
              size="small" 
              icon={<DeleteIcon />}
              onClick={() => handleDelete(row)}
            />
          </Space>
        )
      ),
    },
  ];

  const renderGridView = () => (
    <div 
      style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile 
          ? 'repeat(auto-fill, minmax(120px, 1fr))' 
          : 'repeat(auto-fill, minmax(160px, 1fr))', 
        gap: isMobile ? '12px' : '16px', 
        padding: isMobile ? '12px' : '16px' 
      }}
    >
      {filteredFiles.map((file, index) => (
        <Card
          key={index}
          bordered
          hoverable
          style={{ 
            cursor: file.isDir ? 'pointer' : 'default',
            textAlign: 'center',
            transition: 'all 0.3s ease',
            height: '100%',
          }}
          onClick={() => file.isDir && fetchFiles(file.path)}
        >
          <div style={{ 
            fontSize: isMobile ? '40px' : '48px', 
            marginBottom: isMobile ? '6px' : '8px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: isMobile ? '60px' : '70px'
          }}>
            {getFileIcon(file, isMobile ? '40px' : '48px')}
          </div>
          <div style={{ 
            fontSize: isMobile ? '12px' : '14px', 
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '6px',
            padding: '0 4px',
            color: file.isDir ? 'var(--tc-brand-color)' : 'inherit'
          }}>
            {file.name}
          </div>
          {!file.isDir && (
            <>
              <div style={{ fontSize: '11px', color: 'var(--tc-text-secondary)', marginBottom: '4px' }}>
                {formatBytes(file.size)}
              </div>
              {!isMobile && (
                <Space size="small" style={{ marginTop: '8px' }}>
                  <Button 
                    size="small" 
                    variant="outline"
                    icon={<DownloadIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file);
                    }}
                  />
                  <Button 
                    size="small" 
                    theme="danger"
                    variant="outline"
                    icon={<DeleteIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file);
                    }}
                  />
                </Space>
              )}
            </>
          )}
        </Card>
      ))}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Row gutter={16} style={{ flex: 1, overflow: 'hidden' }}>
        {/* 左侧导航 - 仅桌面端显示 */}
        {!isMobile && (
          <Col span={5}>
            <Card 
              title={
                <Space align="center">
                  <FolderIcon />
                  <span>Navigation</span>
                </Space>
              }
              bordered={false} 
              style={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ 
                flex: 1, 
                overflowY: 'auto',
                overflowX: 'hidden'
              }}>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <Button 
                    block 
                    variant="outline"
                    onClick={() => navigateToPath(datasetPath || '/cfs/rl-data')}
                    icon={<HomeIcon />}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    Home
                  </Button>
                  
                  {datasetName && (
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: 'var(--tc-brand-color-light-1)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: 'var(--tc-brand-color)',
                      fontWeight: '500',
                      marginTop: '8px'
                    }}>
                      📁 {datasetName}
                    </div>
                  )}
                  
                  <Divider style={{ margin: '12px 0' }} />
                  
                  <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)', padding: '0 4px' }}>
                    Recent Paths
                  </div>
                  {pathHistory.slice(-8).reverse().map((path, index) => (
                    <Button
                      key={index}
                      block
                      variant={path === currentPath ? 'base' : 'text'}
                      theme={path === currentPath ? 'primary' : 'default'}
                      onClick={() => navigateToPath(path)}
                      style={{ 
                        justifyContent: 'flex-start',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '13px'
                      }}
                      icon={<ChevronRightIcon size="14px" />}
                      title={path}
                    >
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        display: 'block'
                      }}>
                        {path.split('/').pop() || 'root'}
                      </span>
                    </Button>
                  ))}
                </Space>
              </div>
            </Card>
          </Col>
        )}

        {/* 右侧文件列表 */}
        <Col span={isMobile ? 12 : 7}>
          <Card 
            bordered={false} 
            style={{ 
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* 工具栏 */}
            <div style={{ marginBottom: '16px' }}>
              {/* 面包屑导航 */}
              <div style={{ 
                marginBottom: '12px',
                padding: isMobile ? '8px 12px' : '10px 16px',
                backgroundColor: 'var(--tc-bg-color-container)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap'
              }}>
                <Button 
                  size="small" 
                  variant="outline"
                  onClick={navigateUp}
                  disabled={currentPath === (datasetPath || '/cfs/rl-data')}
                  icon={<ChevronUpIcon />}
                  style={{ flexShrink: 0 }}
                >
                  {!isMobile && 'Up'}
                </Button>
                <div style={{ 
                  flex: 1, 
                  overflow: 'hidden',
                  fontSize: isMobile ? '12px' : '13px'
                }}>
                  <Breadcrumb 
                    maxItemWidth="120px"
                    options={getBreadcrumbItems()}
                  />
                </div>
                <Button 
                  size="small" 
                  variant="outline"
                  onClick={() => fetchFiles(currentPath)}
                  icon={<RefreshIcon />}
                  style={{ flexShrink: 0 }}
                >
                  {!isMobile && 'Refresh'}
                </Button>
              </div>

              {/* 搜索和视图切换 */}
              <div style={{ 
                display: 'flex', 
                gap: '8px',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: isMobile ? 'stretch' : 'center'
              }}>
                <Input
                  placeholder="Search files..."
                  value={searchText}
                  onChange={(value) => setSearchText(value)}
                  prefixIcon={<SearchIcon />}
                  clearable
                  size={isMobile ? 'medium' : 'medium'}
                  style={{ flex: 1 }}
                />
                <Radio.Group 
                  value={viewMode} 
                  onChange={(value) => setViewMode(value as 'list' | 'grid')}
                  variant="default-filled"
                  size={isMobile ? 'medium' : 'medium'}
                >
                  <Radio.Button value="list">
                    <ViewListIcon /> {!isMobile && 'List'}
                  </Radio.Button>
                  <Radio.Button value="grid">
                    <ViewModuleIcon /> {!isMobile && 'Grid'}
                  </Radio.Button>
                </Radio.Group>
              </div>
            </div>

            {/* 文件统计 */}
            <div style={{ 
              marginBottom: '12px',
              fontSize: '13px',
              color: 'var(--tc-text-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 4px'
            }}>
              <span>
                {filteredFiles.length} items 
                {searchText && ` (filtered from ${files.length})`}
              </span>
              <span>
                {filteredFiles.filter(f => f.isDir).length} folders, {filteredFiles.filter(f => !f.isDir).length} files
              </span>
            </div>

            {/* 文件显示区域 */}
            <div style={{ 
              flex: 1, 
              overflow: 'auto',
              minHeight: 0
            }}>
              {viewMode === 'list' ? (
                <Table
                  rowKey="path"
                  data={filteredFiles}
                  columns={isMobile ? mobileColumns : desktopColumns}
                  loading={loading}
                  stripe
                  hover
                  bordered={false}
                  size={isMobile ? 'small' : 'medium'}
                  empty={
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <FileIcon size="48px" style={{ opacity: 0.3, marginBottom: '12px' }} />
                      <div style={{ color: 'var(--tc-text-secondary)' }}>
                        {searchText ? 'No matching files found' : 'This folder is empty'}
                      </div>
                    </div>
                  }
                  maxHeight="100%"
                />
              ) : (
                renderGridView()
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 预览抽屉 */}
      <Drawer
        visible={previewVisible}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewFile(null);
          setPreviewContent(null);
        }}
        header={
          <Space align="center">
            {previewFile && getFileIcon(previewFile, '20px')}
            <span style={{ fontWeight: '500' }}>{previewFile?.name}</span>
            {previewFile && getFileTypeTag(previewFile)}
          </Space>
        }
        size={isMobile ? '90%' : 'large'}
        footer={
          <Space>
            <Button onClick={() => setPreviewVisible(false)}>Close</Button>
            {previewFile && (
              <Button theme="primary" icon={<DownloadIcon />} onClick={() => handleDownload(previewFile)}>
                Download
              </Button>
            )}
          </Space>
        }
        destroyOnClose
      >
        {previewContent && (
          <div style={{ padding: isMobile ? '12px' : '16px' }}>
            {previewContent.loading && (
              <div style={{ textAlign: 'center', padding: '60px' }}>
                <div style={{ marginBottom: '16px' }}>Loading preview...</div>
              </div>
            )}
            
            {previewContent.type === 'text' && (
              <div>
                <div style={{ 
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: 'var(--tc-bg-color-container)',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}>
                  <span>
                    <strong>{previewContent.lines}</strong> lines · <strong>{formatBytes(previewContent.size)}</strong>
                  </span>
                </div>
                <pre style={{ 
                  backgroundColor: 'var(--tc-bg-color-container)', 
                  padding: '16px', 
                  borderRadius: '6px',
                  overflow: 'auto',
                  maxHeight: '600px',
                  fontSize: isMobile ? '12px' : '13px',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  {previewContent.content}
                </pre>
                {previewContent.truncated && (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '12px',
                    backgroundColor: 'var(--tc-warning-color-1)',
                    color: 'var(--tc-warning-color)',
                    borderRadius: '4px',
                    fontSize: '13px'
                  }}>
                    ⚠️ Content truncated (showing first 1MB)
                  </div>
                )}
              </div>
            )}
            
            {previewContent.type === 'unsupported' && (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--tc-text-secondary)' }}>
                <FileIcon size="64px" style={{ marginBottom: '16px', opacity: 0.3 }} />
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>{previewContent.content}</div>
                <div style={{ fontSize: '13px' }}>
                  File size: {formatBytes(previewContent.size)}
                </div>
              </div>
            )}

            {previewContent.type === 'error' && (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--tc-error-color)' }}>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>Failed to load preview</div>
                <div style={{ fontSize: '13px', color: 'var(--tc-text-secondary)' }}>
                  {previewContent.message}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default FileBrowser;
