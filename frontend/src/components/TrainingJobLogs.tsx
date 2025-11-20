import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Space, Typography, Loading, Alert, Tag, Switch, Input, Slider } from 'tdesign-react';
import { DownloadIcon, RefreshIcon, PauseIcon, PlayIcon, SearchIcon, ClearIcon } from 'tdesign-icons-react';
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
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [totalLines, setTotalLines] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [fontSize, setFontSize] = useState(12);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wrapLines, setWrapLines] = useState(true);
  
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(
        `http://localhost:8080/api/training-jobs/file-logs?jobId=${jobId}&limit=1000`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: LogResponse = await response.json();

      if (data.success) {
        setLogs(data.lines);
        setTotalLines(data.totalLines);
        
        // 自动滚动到底部
        if (autoScroll && logsContainerRef.current) {
          setTimeout(() => {
            if (logsContainerRef.current) {
              logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
            }
          }, 100);
        }
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取日志失败');
    } finally {
      setLoading(false);
    }
  }, [jobId, autoScroll]);

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
    MessagePlugin.info('日志已清空');
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const toggleAutoScroll = () => {
    setAutoScroll(!autoScroll);
  };

  // 初始加载日志
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 设置自动刷新
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchLogs, refreshInterval * 1000);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, fetchLogs]);

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
                {totalLines} 行
              </Tag>
            )}
            {autoRefresh && (
              <Tag theme="success" variant="light" style={{ fontSize: '12px' }}>
                自动刷新中
              </Tag>
            )}
          </div>

          <Space size="small">
            <Button
              theme="primary"
              variant="text"
              icon={<RefreshIcon />}
              onClick={fetchLogs}
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

          {/* 自动刷新控制 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ fontSize: '14px', minWidth: '80px' }}>自动刷新:</Text>
            <Switch 
              value={autoRefresh} 
              onChange={toggleAutoRefresh}
              size="small"
            />
            {autoRefresh && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Text style={{ fontSize: '12px', color: '#666' }}>{refreshInterval}s</Text>
                <Slider
                  value={refreshInterval}
                  onChange={setRefreshInterval}
                  min={1}
                  max={30}
                  step={1}
                  style={{ width: '80px' }}
                  size="small"
                />
              </div>
            )}
          </div>

          {/* 自动滚动控制 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text style={{ fontSize: '14px', minWidth: '80px' }}>自动滚动:</Text>
            <Switch 
              value={autoScroll} 
              onChange={toggleAutoScroll}
              size="small"
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
              onChange={setFontSize}
              min={10}
              max={18}
              step={1}
              style={{ width: '100px' }}
              size="small"
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
          closable
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
          <Text style={{ fontSize: '14px', color: '#666' }}>
            显示 {filteredLogs.length} / {logs.length} 条日志
            {searchTerm && ` (搜索: "${searchTerm}")`}
          </Text>
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
            <Text style={{ fontSize: '12px', color: '#999' }}>
              刷新间隔: {refreshInterval}s
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default TrainingJobLogs;