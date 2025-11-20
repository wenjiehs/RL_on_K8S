import React, { useState, useEffect } from 'react';
import { Dialog, Button, Space, Select, Input, InputNumber, Loading, Alert, Checkbox, MessagePlugin, Card, Divider, Collapse, Tag, Tooltip } from 'tdesign-react';
// @ts-nocheck
import { AddIcon, ServerIcon, CheckCircleIcon, ErrorCircleIcon, TimeIcon, InfoCircleIcon, CloudIcon, SettingIcon, CodeIcon } from 'tdesign-icons-react';

interface CreateEnvironmentDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StorageStatus {
  available: string;
  capacity: string;
  status: string;
  used: string;
}

interface ImageOption {
  label: string;
  value: string;
  description: string;
  recommended?: boolean;
}

const CreateEnvironmentDialog: React.FC<CreateEnvironmentDialogProps> = ({ visible, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('ray');
  const [image, setImage] = useState('');
  const [customImage, setCustomImage] = useState('');
  const [replicas, setReplicas] = useState(1);
  const [namespace, setNamespace] = useState('rl');
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [autoInitStorage, setAutoInitStorage] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const frameworkOptions = [
    { label: 'Ray (推荐)', value: 'ray' },
    { label: 'Horovod', value: 'horovod' },
    { label: 'DeepSpeed', value: 'deepspeed' },
    { label: 'Custom', value: 'custom' },
  ];

  // 从training-config.yaml中获取的镜像配置
  const imageOptions: ImageOption[] = [
    {
      label: 'Ray 2.7 + VERL (推荐生产环境)',
      value: 'ccr.ccs.tencentyun.com/halewang/verl:app-verl0.5-transformers4.55.4-vllm0.10.0-mcore0.13.0-te2.2-v1',
      description: 'Ray 2.7.0 with PyTorch, VLLM and GPU support - 与ray-single-group相同配置',
      recommended: true,
    },
    {
      label: 'PyTorch 2.1 + CUDA 12.1',
      value: 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime',
      description: 'PyTorch 2.1.0 with CUDA 12.1',
    },
    {
      label: 'PyTorch 2.0 + CUDA 11.8',
      value: 'pytorch/pytorch:2.0.1-cuda11.8-cudnn8-runtime',
      description: 'PyTorch 2.0.1 with CUDA 11.8',
    },
    {
      label: 'TensorFlow 2.13 + CUDA 11.8',
      value: 'tensorflow/tensorflow:2.13.0-gpu',
      description: 'TensorFlow 2.13.0 with GPU support',
    },
    {
      label: '自定义镜像',
      value: 'custom',
      description: '手动输入Docker镜像地址',
    },
  ];

  const predefinedImages = {
    ray: 'ccr.ccs.tencentyun.com/halewang/verl:app-verl0.5-transformers4.55.4-vllm0.10.0-mcore0.13.0-te2.2-v1',
    horovod: 'horovod/horovod:latest',
    deepspeed: 'deepspeed/deepspeed:latest',
  };

  // 重置表单
  const resetForm = () => {
    setName('');
    setFramework('ray');
    setImage('ccr.ccs.tencentyun.com/halewang/verl:app-verl0.5-transformers4.55.4-vllm0.10.0-mcore0.13.0-te2.2-v1');
    setCustomImage('');
    setReplicas(1);
    setNamespace('rl');
    setAutoInitStorage(true);
    setShowAdvanced(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      MessagePlugin.warning('请输入环境名称');
      return;
    }

    // 验证镜像
    const finalImage = image === 'custom' ? customImage : image;
    if (!finalImage || !finalImage.trim()) {
      MessagePlugin.warning('请选择或输入Docker镜像');
      return;
    }

    // Auto-initialize storage if enabled and not ready
    if (autoInitStorage && storageStatus && storageStatus.status !== 'connected') {
      MessagePlugin.info('正在初始化存储...');
      const initSuccess = await initializeStorage();
      if (!initSuccess) {
        MessagePlugin.warning('存储初始化失败，但将继续创建环境');
      }
      // Wait a bit for PVC to be created
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setLoading(true);
    try {
      const finalImage = image === 'custom' ? customImage : image;
      
      const response = await fetch('http://localhost:8080/api/environments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          framework,
          image: finalImage,
          replicas,
          namespace,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        MessagePlugin.success({
          content: `环境 "${name}" 创建成功！`,
          duration: 3000,
        });
        resetForm();
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        MessagePlugin.error('创建环境失败: ' + (error.error || '未知错误'));
      }
    } catch (error) {
      console.error('Network error:', error);
      MessagePlugin.error('网络错误: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch storage status
  const fetchStorageStatus = async () => {
    setStorageLoading(true);
    try {
      const response = await fetch(`http://localhost:8080/api/storage/status?namespace=${namespace}`);
      if (response.ok) {
        const data = await response.json();
        setStorageStatus(data);
      } else {
        console.error('Failed to fetch storage status');
      }
    } catch (error) {
      console.error('Error fetching storage status:', error);
    } finally {
      setStorageLoading(false);
    }
  };

  // Initialize storage if needed
  const initializeStorage = async (): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:8080/api/storage/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ namespace }),
      });

      if (response.ok) {
        MessagePlugin.success('存储初始化成功');
        fetchStorageStatus();
        return true;
      } else {
        const error = await response.json();
        MessagePlugin.error(error.error || '存储初始化失败');
        return false;
      }
    } catch (error) {
      console.error('Storage initialization error:', error);
      MessagePlugin.error('网络错误: ' + (error as Error).message);
      return false;
    }
  };

  useEffect(() => {
    if (visible) {
      fetchStorageStatus();
      // 设置默认镜像
      if (!image) {
        setImage('ccr.ccs.tencentyun.com/halewang/verl:app-verl0.5-transformers4.55.4-vllm0.10.0-mcore0.13.0-te2.2-v1');
      }
    } else {
      // 关闭时重置表单
      resetForm();
    }
  }, [visible, namespace]);

  const handleFrameworkChange = (value: any) => {
    setFramework(value);
    if (typeof value === 'string' && predefinedImages[value as keyof typeof predefinedImages]) {
      const newImage = predefinedImages[value as keyof typeof predefinedImages];
      setImage(newImage);
      setCustomImage('');
    }
  };

  const handleImageChange = (value: any) => {
    setImage(value);
    if (value !== 'custom') {
      setCustomImage('');
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  if (!visible) return null;

  const selectedImageOption = imageOptions.find(opt => opt.value === image);
  const isCustomImage = image === 'custom';

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CloudIcon style={{ fontSize: '24px', color: 'var(--tc-brand-color)' }} />
          <span>创建训练环境</span>
        </div>
      }
      width={800}
      destroyOnClose
      mode="modal"
      confirmBtn={null}
      cancelBtn={null}
    >
      <div style={{ padding: '24px 20px' }}>
        {/* 配置说明横幅 */}
        <Alert
          theme="info"
          message={
            <div style={{ fontSize: '13px' }}>
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                🚀 创建训练环境
              </div>
              <div style={{ color: '#666', lineHeight: '1.6' }}>
                新创建的Environment将自动应用配置：32核CPU / 128Gi内存 / 8个GPU / hostNetwork模式 / 完整NCCL优化
              </div>
            </div>
          }
          closable={false}
          style={{ marginBottom: '20px' }}
        />

        {/* Storage Status */}
        {storageLoading ? (
          <div style={{ marginBottom: '20px', textAlign: 'center', padding: '20px' }}>
            <Loading text="检查存储状态..." />
          </div>
        ) : storageStatus ? (
          <div style={{ marginBottom: '20px' }}>
            {storageStatus.status === 'connected' ? (
              <Alert
                theme="success"
                message={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircleIcon />
                    <span>
                      CFS存储就绪 - {storageStatus.available} 可用 / {storageStatus.capacity} 总容量
                    </span>
                  </div>
                }
                closable={false}
              />
            ) : (
              <Alert
                theme="warning"
                message={
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <TimeIcon />
                      <span>CFS存储状态: {storageStatus.status}</span>
                    </div>
                    <div style={{ fontSize: '12px', marginLeft: '24px' }}>
                      创建环境时将自动初始化存储
                    </div>
                  </div>
                }
                closable={false}
              />
            )}
          </div>
        ) : null}

        {/* 基础配置 */}
        <Card 
          bordered 
          style={{ marginBottom: '16px' }}
          title={<span style={{ fontWeight: '500', fontSize: '14px' }}>📝 基础配置</span>}
        >
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                环境名称 <span style={{ color: 'red' }}>*</span>
              </label>
              <Input
                placeholder="例如: my-training-env (小写字母、数字、连字符)"
                value={name}
                onChange={(value) => setName(value)}
                style={{ width: '100%' }}
                size="large"
              />
              <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                💡 名称将自动转换为Kubernetes兼容格式
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Framework <span style={{ color: 'red' }}>*</span>
                </label>
                <Select
                  value={framework}
                  onChange={handleFrameworkChange}
                  options={frameworkOptions}
                  style={{ width: '100%' }}
                  placeholder="选择训练框架"
                  size="large"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Worker数量
                </label>
                <InputNumber
                  min={1}
                  max={10}
                  value={replicas}
                  onChange={(value) => setReplicas(typeof value === 'number' ? value : parseInt(value as string, 10) || 1)}
                  style={{ width: '100%' }}
                  size="large"
                />
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  每个Worker: 32核/128Gi/8GPU
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 镜像配置 */}
        <Card 
          bordered 
          style={{ marginBottom: '16px' }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CodeIcon style={{ fontSize: '16px' }} />
              <span style={{ fontWeight: '500', fontSize: '14px' }}>Docker镜像配置</span>
            </div>
          }
        >
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px' }}>
                选择镜像 <span style={{ color: 'red' }}>*</span>
              </label>
              <Select
                value={image}
                onChange={handleImageChange}
                style={{ width: '100%' }}
                placeholder="选择预定义镜像"
                size="large"
                options={imageOptions.map(opt => ({
                  label: (
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px' }}>{opt.label}</span>
                        {opt.recommended && (
                          <Tag theme="success" size="small">推荐</Tag>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '2px', lineHeight: '1.4' }}>
                        {opt.description}
                      </div>
                    </div>
                  ),
                  value: opt.value,
                }))}
              />
            </div>

            {isCustomImage && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  自定义镜像地址
                </label>
                <Input
                  placeholder="例如: myregistry.com/my-image:tag"
                  value={customImage}
                  onChange={(value) => setCustomImage(value)}
                  style={{ width: '100%' }}
                  size="large"
                />
              </div>
            )}

            {selectedImageOption && !isCustomImage && (
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: '#f8f9fa', 
                borderRadius: '6px',
                fontSize: '13px'
              }}>
                <div style={{ color: '#666', wordBreak: 'break-all' }}>
                  <CodeIcon style={{ fontSize: '14px', marginRight: '6px' }} />
                  {selectedImageOption.value}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* 高级配置 (可折叠) */}
        <Collapse 
          defaultValue={showAdvanced ? ['1'] : []}
          onChange={(value) => setShowAdvanced(value.includes('1'))}
        >
          <Collapse.Panel value="1" header={
            <span style={{ fontWeight: '500', fontSize: '14px' }}>⚙️ 高级配置</span>
          }>
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Namespace
                </label>
                <Input
                  placeholder="Kubernetes namespace"
                  value={namespace}
                  onChange={(value) => setNamespace(value)}
                  style={{ width: '100%' }}
                  size="large"
                />
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  💡 推荐使用 'rl' namespace以确保PVC和网络配置正确
                </div>
              </div>

              {framework === 'ray' && (
                <div style={{ 
                  marginTop: '16px', 
                  padding: '16px', 
                  background: '#f0f7ff', 
                  borderRadius: '8px',
                  border: '1px solid #d0e5ff'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '12px', color: '#0052d9' }}>
                    <SettingIcon style={{ marginRight: '6px' }} />
                    Ray集群配置详情
                  </div>
                  <div style={{ fontSize: '13px', color: '#444', lineHeight: '2' }}>
                    <div><strong>资源配置:</strong></div>
                    <div style={{ paddingLeft: '20px' }}>
                      • CPU: 32核 (请求) / 32核 (限制)<br/>
                      • 内存: 128Gi (请求) / 1000Gi (限制)<br/>
                      • GPU: 8个 NVIDIA GPU
                    </div>
                    <div style={{ marginTop: '8px' }}><strong>网络配置:</strong></div>
                    <div style={{ paddingLeft: '20px' }}>
                      • hostNetwork: true<br/>
                      • hostIPC: true<br/>
                      • hostPID: true<br/>
                      • NCCL优化: 27个环境变量
                    </div>
                    <div style={{ marginTop: '8px' }}><strong>存储配置:</strong></div>
                    <div style={{ paddingLeft: '20px' }}>
                      • CFS Turbo PVC: /mnt/cfs-turbo<br/>
                      • HostPath: dev-shm, usr-src, lib-modules, dev-infiniband
                    </div>
                    <div style={{ marginTop: '8px' }}><strong>节点调度:</strong></div>
                    <div style={{ paddingLeft: '20px' }}>
                      • 节点标签: env=debug<br/>
                      • 容忍度: debug=rl:NoSchedule
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Collapse.Panel>
        </Collapse>

        {/* 操作按钮 */}
        <div style={{ 
          textAlign: 'right', 
          marginTop: '24px', 
          paddingTop: '20px', 
          borderTop: '1px solid #e7e7e7' 
        }}>
          <Space size="medium">
            <Button 
              theme="default" 
              onClick={handleClose} 
              disabled={loading}
              size="large"
            >
              取消
            </Button>
            <Button 
              theme="primary" 
              loading={loading} 
              onClick={handleSubmit}
              size="large"
              icon={<AddIcon />}
            >
              {loading ? '创建中...' : '创建环境'}
            </Button>
          </Space>
        </div>
      </div>
    </Dialog>
  );
};

export default CreateEnvironmentDialog;