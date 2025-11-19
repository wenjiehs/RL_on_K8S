import React, { useState } from 'react';
import { Card, Button, Space, Row, Col, Statistic } from 'tdesign-react';

interface MetricsData {
  loss: number[];
  accuracy: number[];
  iterations: number[];
}

interface TrainingMetricsChartProps {
  data: MetricsData;
}

const TrainingMetricsChart: React.FC<TrainingMetricsChartProps> = ({ data }) => {
  const [selectedMetric, setSelectedMetric] = useState<'loss' | 'accuracy'>('loss');

  // 简单的SVG图表实现
  const renderChart = () => {
    const values = selectedMetric === 'loss' ? data.loss : data.accuracy;
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    const width = 600;
    const height = 300;
    const padding = 40;
    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    
    // 生成路径点
    const points = values.map((value, index) => {
      const x = padding + (index / (values.length - 1)) * chartWidth;
      const y = padding + (1 - (value - minValue) / range) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    // 生成网格线
    const gridLines = [];
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * chartHeight;
      gridLines.push(
        <line
          key={`h-${i}`}
          x1={padding}
          y1={y}
          x2={width - padding}
          y2={y}
          stroke="#e0e0e0"
          strokeWidth="1"
        />
      );
    }

    return (
      <div style={{ overflow: 'auto' }}>
        <svg width={width} height={height} style={{ minWidth: '600px' }}>
          {/* 网格线 */}
          {gridLines}
          
          {/* 坐标轴 */}
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="#333"
            strokeWidth="2"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#333"
            strokeWidth="2"
          />
          
          {/* 数据线 */}
          <polyline
            points={points}
            fill="none"
            stroke="#1890ff"
            strokeWidth="2"
          />
          
          {/* 数据点 */}
          {values.map((value, index) => {
            const x = padding + (index / (values.length - 1)) * chartWidth;
            const y = padding + (1 - (value - minValue) / range) * chartHeight;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="3"
                fill="#1890ff"
                style={{ cursor: 'pointer' }}
                title={`Iteration ${data.iterations[index]}: ${value.toFixed(3)}`}
              />
            );
          })}
          
          {/* Y轴标签 */}
          {[0, 1, 2, 3, 4, 5].map(i => {
            const value = maxValue - (i / 5) * range;
            const y = padding + (i / 5) * chartHeight;
            return (
              <text
                key={`y-${i}`}
                x={padding - 10}
                y={y + 5}
                textAnchor="end"
                fontSize="12"
                fill="#666"
              >
                {value.toFixed(2)}
              </text>
            );
          })}
          
          {/* X轴标签 */}
          {[0, Math.floor(values.length / 4), Math.floor(values.length / 2), Math.floor(3 * values.length / 4), values.length - 1].map(i => {
            const x = padding + (i / (values.length - 1)) * chartWidth;
            return (
              <text
                key={`x-${i}`}
                x={x}
                y={height - padding + 20}
                textAnchor="middle"
                fontSize="12"
                fill="#666"
              >
                {data.iterations[i]}
              </text>
            );
          })}
        </svg>
      </div>
    );
  };

  const currentValue = selectedMetric === 'loss' 
    ? data.loss[data.loss.length - 1] 
    : data.accuracy[data.accuracy.length - 1];

  const minValue = selectedMetric === 'loss'
    ? Math.min(...data.loss)
    : Math.min(...data.accuracy);

  const avgValue = selectedMetric === 'loss'
    ? data.loss.reduce((a, b) => a + b, 0) / data.loss.length
    : data.accuracy.reduce((a, b) => a + b, 0) / data.accuracy.length;

  return (
    <Card title="训练指标" bordered={false}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 指标选择器 */}
        <Space>
          <span>选择指标:</span>
          <Button 
            theme={selectedMetric === 'loss' ? 'primary' : 'default'}
            size="small"
            onClick={() => setSelectedMetric('loss')}
          >
            Loss
          </Button>
          <Button 
            theme={selectedMetric === 'accuracy' ? 'primary' : 'default'}
            size="small"
            onClick={() => setSelectedMetric('accuracy')}
          >
            Accuracy
          </Button>
        </Space>

        {/* 统计信息 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Statistic 
              title={`当前${selectedMetric === 'loss' ? 'Loss' : 'Accuracy'}`} 
              value={currentValue} 
              precision={3}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic 
              title={`最小${selectedMetric === 'loss' ? 'Loss' : 'Accuracy'}`} 
              value={minValue} 
              precision={3}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic 
              title={`平均${selectedMetric === 'loss' ? 'Loss' : 'Accuracy'}`} 
              value={avgValue} 
              precision={3}
            />
          </Col>
        </Row>

        {/* 图表 */}
        <div style={{ marginTop: '16px' }}>
          {renderChart()}
        </div>

        {/* 说明 */}
        <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          * 鼠标悬停在数据点上查看具体数值
        </div>
      </Space>
    </Card>
  );
};

export default TrainingMetricsChart;