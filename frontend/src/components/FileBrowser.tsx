import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Button, Space, MessagePlugin, Drawer, Tag, Radio, Input } from 'tdesign-react';
import { FolderIcon, FileIcon, DownloadIcon, DeleteIcon, SearchIcon, ViewListIcon, ViewModuleIcon } from 'tdesign-icons-react';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modTime: string;
  extension: string;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
  level: number;
}

interface FileBrowserProps {
  namespace: string;
  datasetPath?: string;
  datasetName?: string;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ namespace, datasetPath, datasetName }) => {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPath, setCurrentPath] = useState('/cfs/rl-data');
  const [pathHistory, setPathHistory] = useState<string[]>(['/cfs/rl-data']);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchText, setSearchText] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileEntry | null>(null);
  const [previewContent, setPreviewContent] = useState<any>(null);

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
    fetchFiles(initialPath);
  }, [datasetPath]);

  const navigateToPath = (path: string) => {
    fetchFiles(path);
  };

  const navigateUp = () => {
    const parts = currentPath.split('/').filter(p => p);
    if (parts.length > 3) { // Keep at least /cfs/rl-data
      parts.pop();
      const parentPath = '/' + parts.join('/');
      fetchFiles(parentPath);
    }
  };

  const handleDownload = async (file: FileEntry) => {
    try {
      const response = await fetch(`http://localhost:8080/api/datasets/download?path=${encodeURIComponent(file.path)}`);
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
      MessagePlugin.error('Network error: ' + (error as Error).message);
    }
  };

  const handleDelete = async (file: FileEntry) => {
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
  };

  const handlePreview = async (file: FileEntry) => {
    setPreviewFile(file);
    setPreviewVisible(true);

    try {
      const response = await fetch(`http://localhost:8080/api/datasets/preview?path=${encodeURIComponent(file.path)}`);
      if (response.ok) {
        const data = await response.json();
        setPreviewContent(data);
      }
    } catch (error) {
      console.error('Failed to preview file:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file: FileEntry) => {
    if (file.isDir) return <FolderIcon style={{ color: '#E37318' }} />;
    
    const ext = file.extension.toLowerCase();
    const iconColors: Record<string, string> = {
      '.parquet': '#0052D9',
      '.csv': '#00A870',
      '.json': '#834EC2',
      '.txt': '#666',
      '.py': '#0052D9',
      '.sh': '#00A870',
    };

    return <FileIcon style={{ color: iconColors[ext] || '#999' }} />;
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      colKey: 'name',
      title: 'Name',
      width: 300,
      cell: ({ row }: { row: FileEntry }) => (
        <Space align="center">
          {getFileIcon(row)}
          <span 
            style={{ 
              fontWeight: row.isDir ? '500' : 'normal',
              cursor: row.isDir ? 'pointer' : 'default',
              color: row.isDir ? 'var(--tc-brand-color)' : 'inherit'
            }}
            onClick={() => row.isDir && fetchFiles(row.path)}
          >
            {row.name}
          </span>
        </Space>
      ),
    },
    {
      colKey: 'size',
      title: 'Size',
      width: 100,
      cell: ({ row }: { row: FileEntry }) => (
        <span>{row.isDir ? '-' : formatBytes(row.size)}</span>
      ),
    },
    {
      colKey: 'extension',
      title: 'Type',
      width: 100,
      cell: ({ row }: { row: FileEntry }) => (
        <span>{row.isDir ? 'Folder' : (row.extension || '-')}</span>
      ),
    },
    {
      colKey: 'modTime',
      title: 'Modified',
      width: 180,
      cell: ({ row }: { row: FileEntry }) => (
        <span>{new Date(row.modTime).toLocaleString()}</span>
      ),
    },
    {
      colKey: 'actions',
      title: 'Actions',
      width: 200,
      cell: ({ row }: { row: FileEntry }) => (
        !row.isDir && (
          <Space size="small">
            <Button theme="primary" variant="text" size="small" onClick={() => handlePreview(row)}>
              Preview
            </Button>
            <Button 
              theme="primary" 
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

  const renderGridView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '16px', padding: '16px' }}>
      {filteredFiles.map((file, index) => (
        <div
          key={index}
          style={{ cursor: file.isDir ? 'pointer' : 'default' }}
          onClick={() => file.isDir && fetchFiles(file.path)}
        >
          <Card bordered style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>
            {getFileIcon(file)}
          </div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '500',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '4px'
          }}>
            {file.name}
          </div>
          {!file.isDir && (
            <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)' }}>
              {formatBytes(file.size)}
            </div>
          )}
          </Card>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <Row gutter={16}>
        {/* Left: Quick Navigation */}
        <Col span={6}>
          <Card title="Quick Navigation" bordered={false} style={{ height: '600px', overflow: 'auto' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button 
                block 
                variant="outline"
                onClick={() => navigateToPath('/cfs/rl-data')}
                icon={<FolderIcon />}
              >
                Root Directory
              </Button>
              
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--tc-text-secondary)' }}>
                Recent Paths
              </div>
              {pathHistory.slice(-5).reverse().map((path, index) => (
                <Button
                  key={index}
                  block
                  variant="text"
                  onClick={() => navigateToPath(path)}
                  style={{ 
                    justifyContent: 'flex-start',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {path}
                </Button>
              ))}
            </Space>
          </Card>
        </Col>

        {/* Right: File List */}
        <Col span={18}>
          <Card bordered={false}>
            {/* Toolbar */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Space>
                  <Button 
                    size="small" 
                    onClick={navigateUp}
                    disabled={currentPath === '/cfs/rl-data'}
                  >
                    ← Up
                  </Button>
                  <Tag theme="primary" variant="light">
                    {currentPath}
                  </Tag>
                </Space>
                <Radio.Group value={viewMode} onChange={(value) => setViewMode(value as 'list' | 'grid')}>
                  <Radio.Button value="list">
                    <ViewListIcon /> List
                  </Radio.Button>
                  <Radio.Button value="grid">
                    <ViewModuleIcon /> Grid
                  </Radio.Button>
                </Radio.Group>
              </div>
              <Input
                placeholder="Search files..."
                value={searchText}
                onChange={(value) => setSearchText(value)}
                prefixIcon={<SearchIcon />}
                clearable
              />
            </div>

            {/* File Display */}
            {viewMode === 'list' ? (
              <Table
                rowKey="path"
                data={filteredFiles}
                columns={columns}
                loading={loading}
                stripe
                hover
                bordered={false}
                size="medium"
                empty="No files found"
                maxHeight={500}
              />
            ) : (
              renderGridView()
            )}
          </Card>
        </Col>
      </Row>

      {/* Preview Drawer */}
      <Drawer
        visible={previewVisible}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewFile(null);
          setPreviewContent(null);
        }}
        header={
          <Space align="center">
            <FileIcon />
            <span>{previewFile?.name}</span>
          </Space>
        }
        size="large"
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
      >
        {previewContent && (
          <div style={{ padding: '16px' }}>
            {previewContent.type === 'text' && (
              <div>
                <pre style={{ 
                  backgroundColor: 'var(--tc-bg-color-container)', 
                  padding: '16px', 
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '500px'
                }}>
                  {previewContent.content}
                </pre>
                {previewContent.truncated && (
                  <div style={{ marginTop: '8px', color: 'var(--tc-warning-color)' }}>
                    ⚠️ Content truncated (showing first 10KB)
                  </div>
                )}
              </div>
            )}
            {previewContent.type === 'parquet' && (
              <div>
                {previewContent.message && (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'var(--tc-bg-color-container)', 
                    borderRadius: '4px',
                    marginBottom: '16px',
                    color: 'var(--tc-text-secondary)'
                  }}>
                    ℹ️ {previewContent.message}
                  </div>
                )}
                
                {previewContent.schema && previewContent.schema.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ marginBottom: '8px' }}>Schema ({previewContent.schema.length} columns)</h4>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '8px',
                      padding: '12px',
                      backgroundColor: 'var(--tc-bg-color-container)',
                      borderRadius: '4px'
                    }}>
                      {previewContent.schema.map((col: any, idx: number) => (
                        <Tag key={idx} theme="primary" variant="light">
                          {col.name}: {col.type}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}

                {previewContent.data && previewContent.data.length > 0 && (
                  <div>
                    <h4 style={{ marginBottom: '8px' }}>
                      Data Preview ({previewContent.previewRows} of {previewContent.totalRows} rows)
                    </h4>
                    <div style={{ 
                      maxHeight: '400px', 
                      overflow: 'auto',
                      border: '1px solid var(--tc-border-level-1-color)',
                      borderRadius: '4px'
                    }}>
                      <Table
                        rowKey="index"
                        data={previewContent.data.map((item: any, index: number) => ({ ...item, index }))}
                        columns={Object.keys(previewContent.data[0] || {}).map(key => ({
                          colKey: key,
                          title: key,
                          width: 150,
                          ellipsis: true,
                          cell: ({ row }: any) => {
                            const value = row[key];
                            if (value === null || value === undefined) {
                              return <span style={{ color: 'var(--tc-text-placeholder)' }}>null</span>;
                            }
                            if (typeof value === 'object') {
                              return <span style={{ fontSize: '12px' }}>{JSON.stringify(value)}</span>;
                            }
                            return <span>{String(value)}</span>;
                          }
                        }))}
                        bordered
                        stripe
                        size="small"
                        maxHeight={350}
                      />
                    </div>
                  </div>
                )}

                {(!previewContent.data || previewContent.data.length === 0) && !previewContent.message && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--tc-text-secondary)' }}>
                    <FileIcon size="48px" style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <div>No data to preview</div>
                  </div>
                )}
              </div>
            )}
            {previewContent.type === 'image' && (
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={`http://localhost:8080/api/datasets/download?path=${encodeURIComponent(previewFile?.path || '')}`}
                  alt={previewFile?.name}
                  style={{ maxWidth: '100%', maxHeight: '600px' }}
                />
              </div>
            )}
            {previewContent.type === 'unsupported' && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--tc-text-secondary)' }}>
                <FileIcon size="48px" style={{ marginBottom: '16px', opacity: 0.5 }} />
                <div>{previewContent.message}</div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
};

export default FileBrowser;