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
  InputNumber,
  Switch,
} from 'tdesign-react';
import { AddIcon, UploadIcon, CloseIcon } from 'tdesign-icons-react';

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

interface BaseFormData {
  // 基础信息
  jobName: string;
  jobDescription?: string;
  baseModel: string;
  trainingType: string;
  trainingMethod: string;
  
  // 环境信息
  environmentId: string;
  cpu: number;
  memory: number;
  gpu: number;
  image: string;
  enableRDMA: boolean;
  debugMode: boolean;
  outputDirectory: string;
  
  // 数据集配置
  dpoDataset: string;
  
  // 训练配置
  startupScript?: File;
  dependencyFiles?: File[];
}

// 基座模型选项
const baseModelOptions = [
  { label: 'LLaMA-7B', value: 'llama-7b', description: 'Meta LLaMA 7B参数模型' },
  { label: 'LLaMA-13B', value: 'llama-13b', description: 'Meta LLaMA 13B参数模型' },
  { label: 'Qwen-7B', value: 'qwen-7b', description: '通义千问7B参数模型' },
  { label: 'Qwen-14B', value: 'qwen-14b', description: '通义千问14B参数模型' },
  { label: 'ChatGLM3-6B', value: 'chatglm3-6b', description: '智谱ChatGLM3 6B参数模型' },
];

// 训练类型选项
const trainingTypeOptions = [
  { label: '强化学习', value: 'reinforcement_learning' },
  { label: '监督学习', value: 'supervised_learning' },
  { label: '无监督学习', value: 'unsupervised_learning' },
];

// 训练方式选项
const trainingMethodOptions = [
  { label: 'RLHF_DPO', value: 'RLHF_DPO', description: '基于人类反馈的强化学习直接偏好优化' },
  { label: 'RLHF_PPO', value: 'RLHF_PPO', description: '基于人类反馈的强化学习近端策略优化' },
  { label: 'DPO', value: 'DPO', description: '直接偏好优化' },
];

// DPO数据集选项
const dpoDatasetOptions = [
  { label: 'OpenAssistant Conversations Dataset', value: 'openassistant', path: '/mnt/cfs/datasets/openassistant/' },
  { label: 'Alpaca Dataset', value: 'alpaca', path: '/mnt/cfs/datasets/alpaca/' },
  { label: 'Dolly Dataset', value: 'dolly', path: '/mnt/cfs/datasets/dolly/' },
  { label: 'Custom Dataset', value: 'custom', path: '/mnt/cfs/datasets/custom/' },
];

// 常用镜像选项
const imageOptions = [
  { label: 'PyTorch 2.1.0 + CUDA 12.1', value: 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime' },
  { label: 'TensorFlow 2.14.0 + CUDA 12.1', value: 'tensorflow/tensorflow:2.14.0-gpu' },
  { label: 'Ray 2.8.0 + PyTorch', value: 'rayproject/ray:2.8.0-py3.10-gpu' },
  { label: 'Custom Image', value: 'custom' },
];

const CreateTrainingJobDialog: React.FC<CreateTrainingJobDialogProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [tabData, setTabData] = useState<{[key: string]: Partial<BaseFormData>}>({
    basic: {},
    environment: {},
    dataset: {},
    training: {},
  });
  
  const [formData, setFormData] = useState<BaseFormData>({
    // 基础信息
    jobName: '',
    jobDescription: '',
    baseModel: 'llama-7b',
    trainingType: 'reinforcement_learning',
    trainingMethod: 'RLHF_DPO',
    
    // 环境信息
    environmentId: '',
    cpu: 4,
    memory: 16,
    gpu: 1,
    image: 'rayproject/ray:2.8.0-py3.10-gpu',
    enableRDMA: false,
    debugMode: false,
    outputDirectory: '',
    
    // 数据集配置
    dpoDataset: '',
  });

  useEffect(() => {
    if (visible) {
      fetchEnvironments();
    }
  }, [visible]);

  useEffect(() => {
    // 根据选择的DPO数据集自动设置数据路径
    const selectedDataset = dpoDatasetOptions.find(option => option.value === formData.dpoDataset);
    if (selectedDataset) {
      setFormData(prev => ({
        ...prev,
        outputDirectory: selectedDataset.path
      }));
    }
  }, [formData.dpoDataset]);

  // 表单验证函数
  const validateTab = (tab: string): boolean => {
    switch (tab) {
      case 'basic':
        return !!(formData.jobName && formData.baseModel && formData.trainingType && formData.trainingMethod);
      case 'environment':
        return !!(formData.environmentId && formData.cpu && formData.memory && formData.image);
      case 'dataset':
        return !!formData.dpoDataset;
      case 'training':
        return true; // 训练配置是可选的
      default:
        return false;
    }
  };

  // 检查当前tab是否可以进入下一步
  const canProceedToNext = (): boolean => {
    const tabs = ['basic', 'environment', 'dataset', 'training'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex === tabs.length - 1) return true; // 最后一个tab不需要下一步
    
    // 检查当前tab是否完成
    return validateTab(activeTab);
  };

  // 自动激活下一步按钮的useEffect
  useEffect(() => {
    // 当当前tab完成时，延迟500ms后自动激活下一步按钮状态
    if (validateTab(activeTab)) {
      const timer = setTimeout(() => {
        // 这里可以添加自动跳转逻辑，但现在只显示提示
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [formData, activeTab]);

  // 保存当前tab数据
  const saveCurrentTabData = () => {
    setTabData(prev => ({
      ...prev,
      [activeTab]: { ...formData }
    }));
  };

  // Tab切换处理
  const handleTabChange = (value: any) => {
    // 保存当前tab数据
    saveCurrentTabData();
    
    // 切换到新tab
    setActiveTab(value as string);
    
    // 恢复目标tab的数据
    const targetTabData = tabData[value as string];
    if (targetTabData && Object.keys(targetTabData).length > 0) {
      setFormData(prev => ({ ...prev, ...targetTabData }));
    }
  };

  // 下一步处理
  const handleNext = () => {
    if (!canProceedToNext()) {
      MessagePlugin.warning('请完成当前页面的必填项后再继续');
      return;
    }
    
    // 保存当前tab数据
    saveCurrentTabData();
    
    // 切换到下一个tab
    const tabs = ['basic', 'environment', 'dataset', 'training'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  // 上一步处理
  const handlePrevious = () => {
    // 保存当前tab数据
    saveCurrentTabData();
    
    const tabs = ['basic', 'environment', 'dataset', 'training'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      const previousTab = tabs[currentIndex - 1];
      setActiveTab(previousTab);
      
      // 恢复上一个tab的数据
      const previousTabData = tabData[previousTab];
      if (previousTabData && Object.keys(previousTabData).length > 0) {
        setFormData(prev => ({ ...prev, ...previousTabData }));
      }
    }
  };

  const fetchEnvironments = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/environments');
      if (!response.ok) {
        throw new Error('Failed to fetch environments');
      }
      const data = await response.json();
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

  const handleBaseModelChange = (value: string) => {
    setFormData({ ...formData, baseModel: value });
  };

  const handleTrainingMethodChange = (value: string) => {
    setFormData({ ...formData, trainingMethod: value });
  };

  const handleDpoDatasetChange = (value: string) => {
    setFormData({ ...formData, dpoDataset: value });
  };

  const handleImageChange = (value: string) => {
    setFormData({ ...formData, image: value });
  };

  const handleStartupScriptChange = (files: File[]) => {
    if (files && files.length > 0) {
      setFormData({ ...formData, startupScript: files[0] });
    }
  };

  const handleDependencyFilesChange = (files: File[]) => {
    setFormData({ ...formData, dependencyFiles: files });
  };

  const generateOutputDirectory = () => {
    if (!formData.jobName) return '';
    const jobId = `job-${Date.now()}`;
    return `/mnt/cfs/${jobId}/checkpoint`;
  };

  const handleSubmit = async () => {
    // 验证所有必填字段
    const allRequiredFields = ['jobName', 'baseModel', 'trainingType', 'trainingMethod', 'environmentId', 'dpoDataset'];
    const missingFields = allRequiredFields.filter(field => !formData[field as keyof BaseFormData]);
    
    if (missingFields.length > 0) {
      MessagePlugin.warning(`请完成所有必填项后再创建任务: ${missingFields.join(', ')}`);
      return;
    }

    // 生成输出目录
    const outputDir = generateOutputDirectory();
    if (!outputDir) {
      MessagePlugin.error('无法生成输出目录');
      return;
    }

    setLoading(true);
    try {
      // 准备提交数据
      const submitData = {
        ...formData,
        outputDirectory: outputDir,
      };

      const response = await fetch('http://localhost:8080/api/training-jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
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
    // 重置所有数据
    setFormData({
      jobName: '',
      jobDescription: '',
      baseModel: 'llama-7b',
      trainingType: 'reinforcement_learning',
      trainingMethod: 'RLHF_DPO',
      environmentId: '',
      cpu: 4,
      memory: 16,
      gpu: 1,
      image: 'rayproject/ray:2.8.0-py3.10-gpu',
      enableRDMA: false,
      debugMode: false,
      outputDirectory: '',
      dpoDataset: '',
    });
    
    // 重置tab数据
    setTabData({
      basic: {},
      environment: {},
      dataset: {},
      training: {},
    });
    
    setActiveTab('basic');
    onClose();
  };

  // 渲染导航按钮
  const renderNavigationButtons = () => {
    const tabs = ['basic', 'environment', 'dataset', 'training'];
    const currentIndex = tabs.indexOf(activeTab);
    const isFirstTab = currentIndex === 0;
    const isLastTab = currentIndex === tabs.length - 1;
    
    return (
      <Space>
        {!isFirstTab && (
          <Button onClick={handlePrevious}>上一步</Button>
        )}
        {!isLastTab && (
          <Button 
            theme="primary" 
            onClick={handleNext}
            disabled={!canProceedToNext()}
          >
            下一步
          </Button>
        )}
        {isLastTab && (
          <Button 
            theme="primary" 
            onClick={handleSubmit} 
            loading={loading}
          >
            创建任务
          </Button>
        )}
        <Button onClick={handleClose}>取消</Button>
      </Space>
    );
  };

  return (
    <Dialog
      visible={visible}
      header="创建训练任务"
      width={900}
      onClose={handleClose}
      footer={renderNavigationButtons()}
    >
      <Tabs value={activeTab} onChange={handleTabChange}>
        {/* 基础信息 */}
        <TabPanel value="basic" label="基础信息">
          {!validateTab('basic') && (
            <div style={{ 
              padding: '12px', 
              marginBottom: '16px', 
              backgroundColor: '#fef2f2', 
              border: '1px solid #ffccc5', 
              borderRadius: '6px',
              color: '#cf1322'
            }}>
              ⚠️ 请完成必填项：任务名称、基座模型、训练类型、训练方式
            </div>
          )}
          <Form labelWidth={140} style={{ marginTop: 16 }}>
            <FormItem label="任务名称" name="jobName" requiredMark>
              <Input
                placeholder="请输入任务名称"
                value={formData.jobName}
                onChange={(value) => setFormData({ ...formData, jobName: value })}
              />
            </FormItem>

            <FormItem label="任务描述" name="jobDescription">
              <Textarea
                placeholder="请输入任务描述（可选）"
                value={formData.jobDescription}
                onChange={(value) => setFormData({ ...formData, jobDescription: value })}
                autosize={{ minRows: 3, maxRows: 6 }}
              />
            </FormItem>

            <FormItem label="基座模型" name="baseModel" requiredMark>
              <Select
                value={formData.baseModel}
                onChange={(value) => handleBaseModelChange(value as string)}
                options={baseModelOptions}
                placeholder="选择基座模型"
              />
            </FormItem>

            <FormItem label="训练类型" name="trainingType" requiredMark>
              <Select
                value={formData.trainingType}
                onChange={(value) => setFormData({ ...formData, trainingType: value as string })}
                options={trainingTypeOptions}
                placeholder="选择训练类型"
              />
            </FormItem>

            <FormItem label="训练方式" name="trainingMethod" requiredMark>
              <Select
                value={formData.trainingMethod}
                onChange={(value) => handleTrainingMethodChange(value as string)}
                options={trainingMethodOptions}
                placeholder="选择训练方式"
              />
            </FormItem>
          </Form>
        </TabPanel>

        {/* 环境信息 */}
        <TabPanel value="environment" label="环境信息">
          {!validateTab('environment') && (
            <div style={{ 
              padding: '12px', 
              marginBottom: '16px', 
              backgroundColor: '#fef2f2', 
              border: '1px solid #ffccc5', 
              borderRadius: '6px',
              color: '#cf1322'
            }}>
              ⚠️ 请完成必填项：训练环境、CPU核数、内存、镜像
            </div>
          )}
          <Form labelWidth={140} style={{ marginTop: 16 }}>
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

            <FormItem label="CPU核数" name="cpu">
              <InputNumber
                value={formData.cpu}
                onChange={(value) => setFormData({ ...formData, cpu: Number(value) || 4 })}
                min={1}
                max={64}
                step={1}
              />
            </FormItem>

            <FormItem label="内存(GB)" name="memory">
              <InputNumber
                value={formData.memory}
                onChange={(value) => setFormData({ ...formData, memory: Number(value) || 16 })}
                min={1}
                max={256}
                step={1}
              />
            </FormItem>

            <FormItem label="GPU数量" name="gpu">
              <InputNumber
                value={formData.gpu}
                onChange={(value) => setFormData({ ...formData, gpu: Number(value) || 1 })}
                min={0}
                max={8}
                step={1}
              />
            </FormItem>

            <FormItem label="镜像" name="image">
              <Select
                value={formData.image}
                onChange={(value) => handleImageChange(value as string)}
                options={imageOptions}
                placeholder="选择训练镜像"
              />
            </FormItem>

            <FormItem label="启动RDMA" name="enableRDMA">
              <Switch
                value={formData.enableRDMA}
                onChange={(value) => setFormData({ ...formData, enableRDMA: value })}
              />
            </FormItem>

            <FormItem label="Debug模式" name="debugMode">
              <Switch
                value={formData.debugMode}
                onChange={(value) => setFormData({ ...formData, debugMode: value })}
              />
            </FormItem>

            <FormItem label="产出目录" name="outputDirectory">
              <Input
                placeholder="/mnt/cfs/[jobid]/checkpoint"
                value={formData.outputDirectory}
                readonly
              />
            </FormItem>
          </Form>
        </TabPanel>

        {/* 数据集配置 */}
        <TabPanel value="dataset" label="数据集配置">
          {!validateTab('dataset') && (
            <div style={{ 
              padding: '12px', 
              marginBottom: '16px', 
              backgroundColor: '#fef2f2', 
              border: '1px solid #ffccc5', 
              borderRadius: '6px',
              color: '#cf1322'
            }}>
              ⚠️ 请完成必填项：DPO数据集选择
            </div>
          )}
          <Form labelWidth={140} style={{ marginTop: 16 }}>
            <FormItem label="DPO数据集" name="dpoDataset" requiredMark>
              <Select
                value={formData.dpoDataset}
                onChange={(value) => handleDpoDatasetChange(value as string)}
                options={dpoDatasetOptions}
                placeholder="选择DPO数据集"
              />
            </FormItem>

            {formData.dpoDataset && (
              <FormItem label="数据路径" name="dataPath">
                <Input
                  value={dpoDatasetOptions.find(opt => opt.value === formData.dpoDataset)?.path || ''}
                  readonly
                  placeholder="选择数据集后自动显示对应路径"
                />
              </FormItem>
            )}
          </Form>
        </TabPanel>

        {/* 训练配置 */}
        <TabPanel value="training" label="训练配置">
          <Form labelWidth={140} style={{ marginTop: 16 }}>
            <FormItem label="启动脚本" name="startupScript">
              <Upload
                accept=".py,.sh,.bash"
                onChange={handleStartupScriptChange}
                theme="file-input"
                placeholder="点击上传启动脚本"
              >
                <Button variant="outline" icon={<UploadIcon />}>
                  上传启动脚本
                </Button>
              </Upload>
              {formData.startupScript && (
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                  已选择: {formData.startupScript.name}
                </div>
              )}
            </FormItem>

            <FormItem label="依赖文件" name="dependencyFiles">
              <Upload
                accept=".py,.txt,.yaml,.yml,.json,.requirements.txt"
                onChange={handleDependencyFilesChange}
                multiple
                theme="file-input"
                placeholder="点击上传依赖文件"
              >
                <Button variant="outline" icon={<UploadIcon />}>
                  上传依赖文件
                </Button>
              </Upload>
              {formData.dependencyFiles && formData.dependencyFiles.length > 0 && (
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                  已选择 {formData.dependencyFiles.length} 个文件
                </div>
              )}
            </FormItem>
          </Form>
        </TabPanel>
      </Tabs>
    </Dialog>
  );
};

export default CreateTrainingJobDialog;