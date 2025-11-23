import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Space, Typography, Loading, Alert, Tag, Switch, Input, Slider } from 'tdesign-react';
import { DownloadIcon, RefreshIcon, SearchIcon, ClearIcon } from 'tdesign-icons-react';
import { MessagePlugin } from 'tdesign-react';

const { Text } = Typography;

interface LogResponse {
  success: boolean;
  message: string;
  jobId: string;
  lines: string[];
  totalLines: number;
  hasMore: boolean;
}

interface TrainingJobLogsProps {
  jobId: string;
  jobStatus?: string;
}

const TrainingJobLogs: React.FC<TrainingJobLogsProps> = ({ jobId, jobStatus }) => {
  // 优化版本 - 支持分页加载
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>('');
  const [totalLines, setTotalLines] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [fontSize, setFontSize] = useState(12);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  const pageSize = 500; // 每次加载500行
  
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // 过滤日志
  const filteredLogs = logs.filter(line => 
    searchTerm === '' || line.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 获取日志级别颜色
  const getLogLevelColor = (line: string) => {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('ERROR') || upperLine.includes('FATAL') || upperLine.includes('EXCEPTION')) {
      return '#f5222d';
    } else if (upperLine.includes('WARN') || upperLine.includes('WARNING')) {
      return '#fa8c16';
    } else if (upperLine.includes('INFO')) {
      return '#1890ff';
    } else if (upperLine.includes('DEBUG')) {
      return '#52c41a';
    } else if (upperLine.includes('SUCCESS')) {
      return '#52c41a';
    }
    return '#d4d4d4';
  };

  // 获取日志级别标签
  const getLogLevelTag = (line: string) => {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('ERROR') || upperLine.includes('FATAL') || upperLine.includes('EXCEPTION')) {
      return { text: 'ERROR', theme: 'danger' as const };
    } else if (upperLine.includes('WARN') || upperLine.includes('WARNING')) {
      return { text: 'WARN', theme: 'warning' as const };
    } else if (upperLine.includes('INFO')) {
      return { text: 'INFO', theme: 'primary' as const };
    } else if (upperLine.includes('DEBUG')) {
      return { text: 'DEBUG', theme: 'default' as const };
    } else if (upperLine.includes('SUCCESS')) {
      return { text: 'SUCCESS', theme: 'success' as const };
    }
    return null;
  };

  const fetchLogs = useCallback(async (offset: number = 0, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError('');

      const response = await fetch(
        `http://localhost:8080/api/training-jobs/file-logs?jobId=${jobId}&offset=${offset}&limit=${pageSize}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: LogResponse = await response.json();

      if (data.success) {
        if (append) {
          // 追加模式：在现有日志后面添加
          setLogs(prev => [...prev, ...data.lines]);
        } else {
          // 刷新模式：替换所有日志
          setLogs(data.lines);
        }
        setTotalLines(data.totalLines);
        setHasMore(data.hasMore);
        setCurrentOffset(offset + data.lines.length);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取日志失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [jobId, pageSize]);

  // 加载更多日志
  const loadMoreLogs = () => {
    if (!loadingMore && hasMore) {
      fetchLogs(currentOffset, true);
    }
  };

  const downloadLogs = () => {
    if (filteredLogs.length === 0) {
      MessagePlugin.warning('暂无日志可下载');
      return;
    }

    const blob = new Blob([filteredLogs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-job-${jobId}-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    MessagePlugin.success('日志下载成功');
  };

  const clearLogs = () => {
    setLogs([]);
    setCurrentOffset(0);
    setHasMore(false);
    MessagePlugin.info('日志已清空');
  };

  const handleRefresh = () => {
    setCurrentOffset(0);
    fetchLogs(0, false);
  };

  // 初始加载日志
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div style={{ padding: '16px', maxWidth: '100%', margin: '0 auto' }}>
      {/* 主标题和控制面板 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Text style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
              训练日志
            </Text>
            {totalLines > 0 && (
              <Tag theme="primary" variant="light" style={{ fontSize: '12px' }}>
                共 {totalLines} 行
              </Tag>
            )}
          </div>

          <Space size="small">
            <Button
              theme="primary"
              variant="text"
              icon={<RefreshIcon />}
              onClick={handleRefresh}
              loading={loading}
              size="small"
            >
              刷新
            </Button>
            <Button
              theme="default"
              variant="text"
              icon={<DownloadIcon />}
              onClick={downloadLogs}
              disabled={filteredLogs.length === 0}
              size="small"
            >
              下载
            </Button>
            <Button
              theme="default"
              variant="text"
              icon={<ClearIcon />}
              onClick={clearLogs}
              disabled={logs.length === 0}
              size="small"
            >
              清空
            </Button>
          </Space>
        </div>
      </Card>

      {/* 控制面板 */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
          alignItems: 'center'
        }}>
          {/* 搜索框 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ fontSize: '14px', minWidth: '60px' }}>搜索:</Text>
            <Input
              placeholder="搜索日志内容..."
              prefixIcon={<SearchIcon />}
              value={searchTerm}
              onChange={setSearchTerm}
              clearable
              size="small"
              style={{ flex: 1 }}
            />
          </div>

          {/* 显示选项 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ fontSize: '14px', minWidth: '80px' }}>显示选项:</Text>
            <Space size="small">
              <Switch 
                value={showLineNumbers} 
                onChange={setShowLineNumbers}
                size="small"
                label="行号"
              />
              <Switch 
                value={wrapLines} 
                onChange={setWrapLines}
                size="small"
                label="换行"
              />
            </Space>
          </div>

          {/* 字体大小 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ fontSize: '14px', minWidth: '60px' }}>字号:</Text>
            <Slider
              value={fontSize}
              onChange={(value) => {
                if (typeof value === 'number') {
                  setFontSize(value);
                }
              }}
              min={10}
              max={18}
              step={1}
              style={{ width: '100px' }}
            />
            <Text style={{ fontSize: '12px', color: '#666', minWidth: '20px' }}>
              {fontSize}
            </Text>
          </div>
        </div>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert 
          theme="error" 
          message={error}
          close
          onClose={() => setError('')}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 日志内容区域 */}
      <Card style={{ 
        padding: '0',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}>
        {/* 日志头部信息 */}
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '12px 16px',
          borderBottom: '1px solid #e9ecef',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Text style={{ fontSize: '14px', color: '#666' }}>
              显示 {filteredLogs.length} / {logs.length} 条日志
              {searchTerm && ` (搜索: "${searchTerm}")`}
            </Text>
            {hasMore && (
              <Button
                theme="primary"
                size="small"
                onClick={loadMoreLogs}
                loading={loadingMore}
                style={{ fontSize: '12px' }}
              >
                {loadingMore ? '加载中...' : `加载更多 (剩余 ${totalLines - currentOffset} 行)`}
              </Button>
            )}
          </div>
          <Text style={{ fontSize: '12px', color: '#999' }}>
            任务ID: {jobId}
          </Text>
        </div>

        {/* 日志内容 */}
        <div
          ref={logsContainerRef}
          style={{
            height: '600px',
            overflow: 'auto',
            backgroundColor: '#1e1e1e',
            color: '#d4d4d4',
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: `${fontSize}px`,
            lineHeight: '1.5',
            padding: '16px',
            whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
            wordBreak: wrapLines ? 'break-all' : 'normal',
          }}
        >
          {loading && logs.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '50px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px'
            }}>
              <Loading size="large" />
              <Text style={{ color: '#999' }}>加载日志中...</Text>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '50px',
              color: '#999'
            }}>
              {searchTerm ? '没有找到匹配的日志' : '暂无日志'}
            </div>
          ) : (
            filteredLogs.map((line, index) => {
              const originalIndex = logs.indexOf(line);
              const logLevelTag = getLogLevelTag(line);
              
              return (
                <div
                  key={index}
                  style={{
                    marginBottom: '2px',
                    padding: '4px 8px',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                    borderLeft: logLevelTag ? `3px solid` : 'none',
                    borderLeftColor: logLevelTag ? getLogLevelColor(line) : 'transparent',
                  }}
                >
                  {/* 行号 */}
                  {showLineNumbers && (
                    <span style={{
                      color: '#666',
                      minWidth: '40px',
                      fontSize: `${fontSize - 1}px`,
                      textAlign: 'right',
                      userSelect: 'none',
                      opacity: 0.7
                    }}>
                      {originalIndex + 1}
                    </span>
                  )}

                  {/* 日志级别标签 */}
                  {logLevelTag && (
                    <Tag 
                      theme={logLevelTag.theme} 
                      size="small"
                      style={{ 
                        fontSize: `${fontSize - 2}px`,
                        minWidth: '60px',
                        textAlign: 'center'
                      }}
                    >
                      {logLevelTag.text}
                    </Tag>
                  )}

                  {/* 日志内容 */}
                  <span style={{
                    color: getLogLevelColor(line),
                    flex: 1,
                    fontSize: `${fontSize}px`,
                    wordBreak: wrapLines ? 'break-all' : 'normal'
                  }}>
                    {line}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* 底部状态栏 */}
      <Card style={{ marginTop: '16px', padding: '12px 16px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <Text style={{ fontSize: '12px', color: '#666' }}>
            最后更新: {new Date().toLocaleString()}
          </Text>
          
          <Space size="small">
            {jobStatus && (
              <Tag theme={jobStatus === 'running' ? 'success' : 'default'} variant="light">
                状态: {jobStatus}
              </Tag>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default TrainingJobLogs;