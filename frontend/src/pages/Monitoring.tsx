import React, { useState } from 'react';
import { Table, Tag, Card, Row, Col, Space, Button } from 'tdesign-react';
import { RefreshIcon } from 'tdesign-icons-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';

const rewardData = [
  { step: 0, reward: 50 },
  { step: 100, reward: 120 },
  { step: 200, reward: 150 },
  { step: 300, reward: 210 },
  { step: 400, reward: 250 },
  { step: 500, reward: 280 },
  { step: 600, reward: 310 },
];

const resourceData = [
  { time: '11:50', cpu: 25, memory: 450 },
  { time: '11:52', cpu: 30, memory: 480 },
  { time: '11:54', cpu: 45, memory: 510 },
  { time: '11:56', cpu: 40, memory: 500 },
  { time: '11:58', cpu: 60, memory: 650 },
  { time: '12:00', cpu: 55, memory: 620 },
];

interface Alert {
  id: string;
  time: string;
  severity: 'High' | 'Medium' | 'Low';
  jobId: string;
  message: string;
  status: 'Triggered' | 'Resolved';
}

const Monitoring: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([
    {
      id: 'alert-001',
      time: '2025-11-14 09:35',
      severity: 'High',
      jobId: 'job-f1a9e7',
      message: 'Job failed: OOMKilled',
      status: 'Triggered',
    },
    {
      id: 'alert-002',
      time: '2025-11-14 10:15',
      severity: 'Medium',
      jobId: 'job-d4a6f8',
      message: 'Reward plateau detected',
      status: 'Resolved',
    },
    {
      id: 'alert-003',
      time: '2025-11-14 11:58',
      severity: 'Low',
      jobId: 'job-e8b1c3',
      message: 'CPU usage > 80% for 5 mins',
      status: 'Triggered',
    },
  ]);

  const alertColumns = [
    {
      colKey: 'time',
      title: 'Time',
      width: 150,
    },
    {
      colKey: 'severity',
      title: 'Severity',
      width: 100,
      cell: ({ row }: { row: Alert }) => {
        const themeMap = { High: 'danger', Medium: 'warning', Low: 'primary' };
        return <Tag theme={themeMap[row.severity] as any}>{row.severity}</Tag>;
      },
    },
    {
      colKey: 'jobId',
      title: 'Job ID',
      width: 120,
      cell: ({ row }: { row: Alert }) => (
        <span style={{ fontWeight: '500', color: 'var(--tc-text-primary)' }}>{row.jobId}</span>
      ),
    },
    {
      colKey: 'message',
      title: 'Message',
      ellipsis: true,
    },
    {
      colKey: 'status',
      title: 'Status',
      width: 120,
      cell: ({ row }: { row: Alert }) => {
        const themeMap = { Triggered: 'danger', Resolved: 'success' };
        return (
          <Tag theme={themeMap[row.status] as any} variant="light">
            {row.status}
          </Tag>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card
            title="Live Training Reward (job-e8b1c3)"
            bordered={false}
            style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            actions={
              <Button icon={<RefreshIcon />} variant="text" size="small">
                Refresh
              </Button>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={rewardData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="step"
                  label={{ value: 'Training Steps', position: 'insideBottom', offset: -5 }}
                  stroke="#6b7280"
                />
                <YAxis
                  label={{ value: 'Avg. Reward', angle: -90, position: 'insideLeft' }}
                  stroke="#6b7280"
                />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="reward" stroke="#0d6eff" strokeWidth={2} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            title="Pod CPU Usage (%)"
            bordered={false}
            style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={resourceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Area type="monotone" dataKey="cpu" stroke="#00a870" fill="#00a870" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            title="Pod Memory Usage (MB)"
            bordered={false}
            style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={resourceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="memory" fill="#ed7b2f" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card
        title="Alert History & Diagnostics"
        bordered={false}
        style={{ borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
        actions={
          <Button icon={<RefreshIcon />} variant="outline">
            Refresh
          </Button>
        }
      >
        <Table
          rowKey="id"
          data={alerts}
          columns={alertColumns}
          stripe
          hover
          bordered={false}
          size="medium"
        />
      </Card>
    </div>
  );
};

export default Monitoring;