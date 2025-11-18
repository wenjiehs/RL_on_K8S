import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Form,
  Input,
  Select,
  Tabs,
  Button,
  Space,
  Upload,
  Textarea,
  MessagePlugin,
  Loading,
} from 'tdesign-react';
import { AddIcon, UploadIcon } from 'tdesign-icons-react';

const { FormItem } = Form;
const { TabPanel } = Tabs;

interface CreateTrainingJobDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Environment {
  id: string;
  name: string;
  framework: string;
  status: string;
}

interface FormData {
  experimentName: string;
  algorithmType: string;
  environmentId: string;
  dataPath: string;
  hyperparams: string;
  codePath?: string;
}

const algorithmOptions = [
  { label: 'PPO (Proximal Policy Optimization)', value: 'PPO' },
  { label: 'DQN (Deep Q-Network)', value: 'DQN' },
  { label: 'SAC (Soft Actor-Critic)', value: 'SAC' },
  { label: 'A3C (Asynchronous Advantage Actor-Critic)', value: 'A3C' },
  { label: 'TD3 (Twin Delayed DDPG)', value: 'TD3' },
];

const presetConfigs: Record<string, any> = {
  PPO: {
    learning_rate: 0.0003,
    gamma: 0.99,
    clip_range: 0.2,
    n_steps: 2048,
    batch_size: 64,
  },
  DQN: {
    learning_rate: 0.0001,
    gamma: 0.99,
    buffer_size: 100000,
    batch_size: 32,
    exploration_fraction: 0.1,
  },
  SAC: {
    learning_rate: 0.0003,
    gamma: 0.99,
    tau: 0.005,
    batch_size: 256,
  },
  A3C: {
    learning_rate: 0.0001,
    gamma: 0.99,
    n_steps: 5,
    entropy_coef: 0.01,
  },
  TD3: {
    learning_rate: 0.0003,
    gamma: 0.99,
    tau: 0.005,
    batch_size: 100,
    policy_delay: 2,
  },
};

const CreateTrainingJobDialog: React.FC<CreateTrainingJobDialogProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState('quick');
  const [loading, setLoading] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [formData, setFormData] = useState<FormData>({
    experimentName: '',
    algorithmType: 'PPO',
    environmentId: '',
    dataPath: '/cfs/rl-data/',
    hyperparams: JSON.stringify(presetConfigs.PPO, null, 2),
  });

  useEffect(() => {
    if (visible) {
      fetchEnvironments();
    }
  }, [visible]);

  const fetchEnvironments = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/environments');
      if (!response.ok) {
        throw new Error('Failed to fetch environments');
      }
      const data = await response.json();
      // Backend returns array directly, filter for running environments
      const runningEnvs = Array.isArray(data) 
        ? data.filter((env: Environment) => env.status === 'running')
        : [];
      setEnvironments(runningEnvs);
      
      if (runningEnvs.length === 0) {
        MessagePlugin.warning('当前没有运行中的环境，请先创建并启动环境');
      }
    } catch (error) {
      console.error('Failed to fetch environments:', error);
      MessagePlugin.error('获取环境列表失败');
    }
  };

  const handleAlgorithmChange = (value: any) => {
    const algoType = value as string;
    setFormData({
      ...formData,
      algorithmType: algoType,
      hyperparams: JSON.stringify(presetConfigs[algoType] || {}, null, 2),
    });
  };

  const handleSubmit = async () => {
    if (!formData.experimentName || !formData.algorithmType || !formData.environmentId || !formData.dataPath) {
      MessagePlugin.warning('请填写所有必填字段');
      return;
    }

    try {
      const hyperparamsObj = JSON.parse(formData.hyperparams);
    } catch (error) {
      MessagePlugin.error('超参数格式错误，请输入有效的JSON');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:8080/api/training-jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          experimentName: formData.experimentName,
          algorithmType: formData.algorithmType,
          environmentId: formData.environmentId,
          dataPath: formData.dataPath,
          hyperparameters: JSON.parse(formData.hyperparams),
          namespace: 'default',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建失败');
      }

      MessagePlugin.success('训练任务创建成功');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Failed to create training job:', error);
      MessagePlugin.error(error.message || '创建训练任务失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      experimentName: '',
      algorithmType: 'PPO',
      environmentId: '',
      dataPath: '/cfs/rl-data/',
      hyperparams: JSON.stringify(presetConfigs.PPO, null, 2),
    });
    setActiveTab('quick');
    onClose();
  };

  return (
    <Dialog
      visible={visible}
      header="创建训练任务"
      width={700}
      onClose={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose}>取消</Button>
          <Button theme="primary" onClick={handleSubmit} loading={loading}>
            创建任务
          </Button>
        </Space>
      }
    >
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value as string)}>
        <TabPanel value="quick" label="快速创建">
          <Form labelWidth={120} style={{ marginTop: 16 }}>
            <FormItem label="实验名称" name="experimentName" requiredMark>
              <Input
                placeholder="请输入实验名称"
                value={formData.experimentName}
                onChange={(value) => setFormData({ ...formData, experimentName: value })}
              />
            </FormItem>

            <FormItem label="算法类型" name="algorithmType" requiredMark>
              <Select
                value={formData.algorithmType}
                onChange={handleAlgorithmChange}
                options={algorithmOptions}
              />
            </FormItem>

            <FormItem label="训练环境" name="environmentId" requiredMark>
              <Select
                value={formData.environmentId}
                onChange={(value) => setFormData({ ...formData, environmentId: value as string })}
                options={environments.map((env) => ({
                  label: `${env.name} (${env.framework})`,
                  value: env.name,
                }))}
                placeholder={environments.length === 0 ? "暂无运行中的环境" : "选择运行中的环境"}
                disabled={environments.length === 0}
              />
            </FormItem>

            <FormItem label="数据路径" name="dataPath" requiredMark>
              <Input
                placeholder="/cfs/rl-data/exp1/train/latest"
                value={formData.dataPath}
                onChange={(value) => setFormData({ ...formData, dataPath: value })}
              />
            </FormItem>

            <FormItem label="超参数配置" name="hyperparams">
              <Textarea
                placeholder="JSON格式的超参数"
                value={formData.hyperparams}
                onChange={(value) => setFormData({ ...formData, hyperparams: value })}
                autosize={{ minRows: 6, maxRows: 12 }}
              />
            </FormItem>
          </Form>
        </TabPanel>

        <TabPanel value="custom" label="自定义创建">
          <Form labelWidth={120} style={{ marginTop: 16 }}>
            <FormItem label="实验名称" name="experimentName" requiredMark>
              <Input
                placeholder="请输入实验名称"
                value={formData.experimentName}
                onChange={(value) => setFormData({ ...formData, experimentName: value })}
              />
            </FormItem>

            <FormItem label="算法类型" name="algorithmType" requiredMark>
              <Select
                value={formData.algorithmType}
                onChange={(value) => {
                  const algoType = value as string;
                  setFormData({ ...formData, algorithmType: algoType });
                }}
                options={algorithmOptions}
              />
            </FormItem>

            <FormItem label="训练环境" name="environmentId" requiredMark>
              <Select
                value={formData.environmentId}
                onChange={(value) => setFormData({ ...formData, environmentId: value as string })}
                options={environments.map((env) => ({
                  label: `${env.name} (${env.framework})`,
                  value: env.name,
                }))}
                placeholder={environments.length === 0 ? "暂无运行中的环境" : "选择运行中的环境"}
                disabled={environments.length === 0}
              />
            </FormItem>

            <FormItem label="数据路径" name="dataPath" requiredMark>
              <Input
                placeholder="/cfs/rl-data/exp1/train/latest"
                value={formData.dataPath}
                onChange={(value) => setFormData({ ...formData, dataPath: value })}
              />
            </FormItem>

            <FormItem label="代码路径" name="codePath">
              <Input
                placeholder="/cfs/rl-data/code/my_algorithm.py (可选)"
                value={formData.codePath}
                onChange={(value) => setFormData({ ...formData, codePath: value })}
              />
            </FormItem>

            <FormItem label="超参数配置" name="hyperparams">
              <Textarea
                placeholder="JSON格式的超参数"
                value={formData.hyperparams}
                onChange={(value) => setFormData({ ...formData, hyperparams: value })}
                autosize={{ minRows: 8, maxRows: 15 }}
              />
            </FormItem>
          </Form>
        </TabPanel>
      </Tabs>
    </Dialog>
  );
};

export default CreateTrainingJobDialog;