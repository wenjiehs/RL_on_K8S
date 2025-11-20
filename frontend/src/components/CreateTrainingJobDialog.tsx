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
import { AddIcon, UploadIcon, CloseIcon, RefreshIcon } from 'tdesign-icons-react';
import { useNamespaces } from '../hooks/useNamespaces';
import { useTrainingConfig, ConfigOption, TrainingMethod, DatasetOption } from '../hooks/useTrainingConfig';

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
  cpu: number;
  memory: number;
  gpu: number;
}

interface BaseFormData {
  // 基础信息
  jobName: string;
  jobDescription?: string;
  baseModel: string;
  trainingType: string;
  trainingMethod: string;
  
  // 环境配置方式
  environmentMode: 'select-existing' | 'create-new';
  
  // 选择已有环境
  namespace: string;
  environmentId: string;
  
  // 自动创建环境参数
  createNamespace: string;
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

// CPU、内存、GPU选项保持硬编码
const cpuOptions = [
  { label: '1核', value: 1 },
  { label: '2核', value: 2 },
  { label: '4核', value: 4 },
  { label: '8核', value: 8 },
  { label: '16核', value: 16 },
  { label: '32核', value: 32 },
  { label: '64核', value: 64 },
];

const memoryOptions = [
  { label: '4GB', value: 4 },
  { label: '8GB', value: 8 },
  { label: '16GB', value: 16 },
  { label: '32GB', value: 32 },
  { label: '64GB', value: 64 },
  { label: '128GB', value: 128 },
  { label: '256GB', value: 256 },
];

const gpuOptions = [
  { label: '0卡', value: 0 },
  { label: '1卡', value: 1 },
  { label: '2卡', value: 2 },
  { label: '4卡', value: 4 },
  { label: '8卡', value: 8 },
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
  
  // 使用命名空间Hook
  const { namespaces: namespaceOptions, loading: namespacesLoading } = useNamespaces();
  
  // 使用训练配置Hook
  const { config, loading: configLoading, error: configError, reloadConfig } = useTrainingConfig();
  
  // 根据训练类型过滤训练方式
  const getFilteredTrainingMethods = () => {
    if (!config || !formData.trainingType) return config?.trainingMethods || [];
    
    return config.trainingMethods.filter(method =>
      method.compatibleTypes.includes(formData.trainingType)
    );
  };

  // 处理配置重载
  const handleReloadConfig = async () => {
    try {
      const result = await reloadConfig();
      if (result.success) {
        MessagePlugin.success('配置重载成功');
      } else {
        MessagePlugin.error(`配置重载失败: ${result.message}`);
      }
    } catch (error: any) {
      MessagePlugin.error(`配置重载失败: ${error.message}`);
    }
  };
  
  const [formData, setFormData] = useState<BaseFormData>({
    // 基础信息
    jobName: '',
    jobDescription: '',
    baseModel: 'llama-7b',
    trainingType: 'reinforcement_learning',
    trainingMethod: 'RLHF_DPO',
    
    // 环境配置方式
    environmentMode: 'select-existing',
    
    // 选择已有环境
    namespace: 'default',
    environmentId: '',
    
    // 自动创建环境参数
    createNamespace: 'default',
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
    if (visible && formData.namespace) {
      fetchEnvironments();
    }
  }, [visible, formData.namespace]);



  // 表单验证函数
  const validateTab = (tab: string): boolean => {
    switch (tab) {
      case 'basic':
        return !!(formData.jobName && formData.baseModel && formData.trainingType && formData.trainingMethod);
      case 'environment':
        if (formData.environmentMode === 'select-existing') {
          return !!(formData.namespace && formData.environmentId);
        } else {
          return !!(formData.createNamespace && formData.cpu && formData.memory && formData.image);
        }
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
      const response = await fetch(`http://localhost:8080/api/environments?namespace=${formData.namespace}`);
      if (!response.ok) {
        throw new Error('Failed to fetch environments');
      }
      const data = await response.json();
      const runningEnvs = Array.isArray(data) 
        ? data.filter((env: Environment) => env.status === 'running')
        : [];
      setEnvironments(runningEnvs);
      
      if (runningEnvs.length === 0) {
        MessagePlugin.warning('当前命名空间没有运行中的环境，请先创建并启动环境');
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

  const handleSubmit = async () => {
    // 验证所有必填字段
    let allRequiredFields = ['jobName', 'baseModel', 'trainingType', 'trainingMethod', 'dpoDataset'];
    
    // 根据环境配置方式添加不同的必填字段
    if (formData.environmentMode === 'select-existing') {
      allRequiredFields.push('namespace', 'environmentId');
    } else {
      allRequiredFields.push('createNamespace', 'cpu', 'memory', 'image');
    }
    
    const missingFields = allRequiredFields.filter(field => !formData[field as keyof BaseFormData]);
    
    if (missingFields.length > 0) {
      MessagePlugin.warning(`请完成所有必填项后再创建任务: ${missingFields.join(', ')}`);
      return;
    }

    // 使用输出目录（如果为空，后端会自动生成）
    let outputDir = formData.outputDirectory;

    setLoading(true);
    try {
      // 准备提交数据
      const submitData = {
        ...formData,
        outputDirectory: outputDir,
        // 根据环境模式设置正确的命名空间
        namespace: formData.environmentMode === 'select-existing' ? formData.namespace : formData.createNamespace,
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
      environmentMode: 'select-existing',
      namespace: 'default',
      environmentId: '',
      createNamespace: 'default',
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

  // 配置加载状态处理
  if (configLoading) {
    return (
      <Dialog
        visible={visible}
        header="创建训练任务"
        width={900}
        onClose={handleClose}
      >
        <div style={{ 
          padding: '60px', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '300px'
        }}>
          <Loading text="加载配置中..." size="large" />
          <div style={{ marginTop: '16px', color: 'var(--td-text-color-secondary)' }}>
            正在加载训练配置，请稍候...
          </div>
        </div>
      </Dialog>
    );
  }

  // 配置加载错误处理
  if (configError) {
    return (
      <Dialog
        visible={visible}
        header="创建训练任务"
        width={900}
        onClose={handleClose}
      >
        <div style={{ 
          padding: '60px', 
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '300px'
        }}>
          <div style={{ 
            fontSize: '16px', 
            color: 'var(--td-error-color)', 
            marginBottom: '16px' 
          }}>
            ⚠️ 配置加载失败
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: 'var(--td-text-color-secondary)',
            marginBottom: '24px',
            maxWidth: '400px'
          }}>
            {configError}
          </div>
          <Button theme="primary" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      visible={visible}
      header={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>创建训练任务</span>
          <Button
            variant="text"
            icon={<RefreshIcon />}
            onClick={handleReloadConfig}
            loading={configLoading}
            title="刷新配置"
          />
        </div>
      }
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
                placeholder="如: train1, dpo-llama-7b, test-gpu-manual"
                value={formData.jobName}
                onChange={(value) => setFormData({ ...formData, jobName: value })}
              />
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                任务名称将用作存储路径标识符，建议使用字母、数字和连字符
              </div>
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
                options={config?.baseModels || []}
                placeholder="选择基座模型"
                loading={configLoading}
              />
            </FormItem>

            <FormItem label="训练类型" name="trainingType" requiredMark>
              <Select
                value={formData.trainingType}
                onChange={(value) => setFormData({ ...formData, trainingType: value as string })}
                options={config?.trainingTypes || []}
                placeholder="选择训练类型"
                loading={configLoading}
              />
            </FormItem>

            <FormItem label="训练方式" name="trainingMethod" requiredMark>
              <Select
                value={formData.trainingMethod}
                onChange={(value) => handleTrainingMethodChange(value as string)}
                options={getFilteredTrainingMethods()}
                placeholder="选择训练方式"
                loading={configLoading}
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
              ⚠️ 请完成环境配置：选择已有环境或设置自动创建环境参数
            </div>
          )}
          
          <Form labelWidth={140} style={{ marginTop: 16 }}>
            {/* 环境配置方式选择 */}
            <FormItem label="环境配置方式" name="environmentMode" requiredMark>
              <Select
                value={formData.environmentMode}
                onChange={(value) => {
                  const modeValue = value as 'select-existing' | 'create-new';
                  setFormData({ ...formData, environmentMode: modeValue });
                  // 切换模式时清空相关字段
                  if (modeValue === 'select-existing') {
                    setFormData(prev => ({ 
                      ...prev, 
                      environmentMode: 'select-existing',
                      environmentId: '',
                      createNamespace: 'default'
                    }));
                  } else {
                    setFormData(prev => ({ 
                      ...prev, 
                      environmentMode: 'create-new',
                      namespace: '',
                      environmentId: ''
                    }));
                  }
                }}
                options={[
                  { label: '选择已有环境', value: 'select-existing', description: '从现有运行中的Ray环境选择' },
                  { label: '自动创建环境', value: 'create-new', description: '根据配置自动创建新的Ray环境' }
                ]}
                placeholder="选择环境配置方式"
              />
            </FormItem>

            {/* 选择已有环境配置 */}
            {formData.environmentMode === 'select-existing' && (
              <div style={{ 
                padding: '16px', 
                marginBottom: '16px', 
                backgroundColor: '#f0f9ff', 
                border: '1px solid #bae6fd', 
                borderRadius: '8px',
                borderLeft: '4px solid #0ea5e9'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#0369a1' }}>
                  🎯 选择已有环境
                </div>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                  从现有运行中的Ray环境选择，系统将使用该环境执行训练任务。
                </div>
                
                <FormItem label="命名空间" name="namespace" requiredMark>
                  <Select
                    value={formData.namespace}
                    onChange={(value) => {
                      setFormData({ ...formData, namespace: value as string, environmentId: '' });
                    }}
                    options={namespaceOptions}
                    placeholder="选择命名空间"
                    loading={namespacesLoading}
                    filterable
                  />
                </FormItem>

                <FormItem label="训练环境" name="environmentId" requiredMark>
                  <Select
                    value={formData.environmentId}
                    onChange={(value) => {
                      const selectedEnv = environments.find(env => env.name === value);
                      if (selectedEnv) {
                        // 当选择已有环境时，自动设置该环境的资源配置
                        setFormData({ 
                          ...formData, 
                          environmentId: value as string,
                          gpu: selectedEnv.gpu || 1,
                          cpu: selectedEnv.cpu || 4,
                          memory: selectedEnv.memory || 16,
                          image: selectedEnv.image || formData.image
                        });
                      } else {
                        setFormData({ ...formData, environmentId: value as string });
                      }
                    }}
                    options={environments.map((env) => ({
                      label: `${env.name} (${env.framework}) - ${env.gpu || 0}卡`,
                      value: env.name,
                    }))}
                    placeholder={environments.length === 0 ? "暂无运行中的环境" : "选择运行中的环境"}
                    disabled={environments.length === 0}
                  />
                </FormItem>

                <FormItem label="产出目录" name="outputDirectory">
                  <Input
                    value={formData.outputDirectory}
                    onChange={(value) => setFormData({ ...formData, outputDirectory: value })}
                    placeholder={`/mnt/cfs-turbo/cfs/${formData.jobName || '{job-name}'}/checkpoint`}
                  />
                  <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                    {formData.jobName 
                      ? `💡 留空将自动生成: /mnt/cfs-turbo/cfs/${formData.jobName}/checkpoint`
                      : '💡 留空将自动使用任务名称生成路径'}
                  </div>
                </FormItem>
              </div>
            )}

            {/* 自动创建环境配置 */}
            {formData.environmentMode === 'create-new' && (
              <div style={{ 
                padding: '16px', 
                marginBottom: '16px', 
                backgroundColor: '#f0fdf4', 
                border: '1px solid #bbf7d0', 
                borderRadius: '8px',
                borderLeft: '4px solid #22c55e'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#15803d' }}>
                  ⚙️ 自动创建环境
                </div>
                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                  系统将根据以下配置自动创建新的Ray环境并执行训练任务。
                </div>

                <FormItem label="命名空间" name="createNamespace" requiredMark>
                  <Select
                    value={formData.createNamespace}
                    onChange={(value) => setFormData({ ...formData, createNamespace: value as string })}
                    options={namespaceOptions}
                    placeholder="选择命名空间"
                    loading={namespacesLoading}
                    filterable
                  />
                </FormItem>

                <FormItem label="CPU配置" name="cpu" requiredMark>
                  <InputNumber
                    value={formData.cpu}
                    onChange={(value) => setFormData({ ...formData, cpu: Number(value) || 4 })}
                    min={1}
                    max={64}
                    step={1}
                    placeholder="CPU核数"
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    建议至少4核，复杂训练任务建议8核以上
                  </div>
                </FormItem>

                <FormItem label="内存大小" name="memory" requiredMark>
                  <InputNumber
                    value={formData.memory}
                    onChange={(value) => setFormData({ ...formData, memory: Number(value) || 16 })}
                    min={1}
                    max={256}
                    step={1}
                    placeholder="内存大小(GB)"
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    建议至少16GB，大模型训练建议32GB以上
                  </div>
                </FormItem>

                <FormItem label="GPU资源" name="gpu">
                  <InputNumber
                    value={formData.gpu}
                    onChange={(value) => setFormData({ ...formData, gpu: Number(value) || 1 })}
                    min={0}
                    max={8}
                    step={1}
                    placeholder="GPU数量"
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    GPU训练可显著提升性能，建议1-4张GPU
                  </div>
                </FormItem>

                <FormItem label="镜像选择" name="image" requiredMark>
                  <Select
                    value={formData.image}
                    onChange={(value) => handleImageChange(value as string)}
                    options={config?.commonImages || []}
                    placeholder="选择训练镜像"
                    loading={configLoading}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    选择包含Ray和深度学习框架的镜像
                  </div>
                </FormItem>

                <FormItem label="RDMA设置" name="enableRDMA">
                  <Switch
                    value={formData.enableRDMA}
                    onChange={(value) => setFormData({ ...formData, enableRDMA: value })}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    启用RDMA可提升多节点通信性能，适用于分布式训练
                  </div>
                </FormItem>

                <FormItem label="Debug模式" name="debugMode">
                  <Switch
                    value={formData.debugMode}
                    onChange={(value) => setFormData({ ...formData, debugMode: value })}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    启用Debug模式将保留训练容器，便于问题排查
                  </div>
                </FormItem>

                <FormItem label="产出目录" name="outputDirectory">
                  <Input
                    value={formData.outputDirectory}
                    onChange={(value) => setFormData({ ...formData, outputDirectory: value })}
                    placeholder={`/mnt/cfs-turbo/cfs/${formData.jobName || '{job-name}'}/checkpoint`}
                  />
                  <div style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                    {formData.jobName 
                      ? `💡 留空将自动生成: /mnt/cfs-turbo/cfs/${formData.jobName}/checkpoint`
                      : '💡 留空将自动使用任务名称生成路径'}
                  </div>
                </FormItem>
              </div>
            )}
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
                options={config?.dpoDatasets || []}
                placeholder="选择DPO数据集"
                loading={configLoading}
              />
            </FormItem>

            {formData.dpoDataset && (
              <FormItem label="数据路径" name="dataPath">
                <Input
                  value={config?.dpoDatasets.find(opt => opt.value === formData.dpoDataset)?.path || ''}
                  disabled
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