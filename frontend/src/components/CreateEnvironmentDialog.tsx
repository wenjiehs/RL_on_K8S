import React, { useState, useEffect } from 'react';
import { Dialog, Button, Space, Select, Input, InputNumber, Loading, Alert, Checkbox, MessagePlugin } from 'tdesign-react';
// @ts-nocheck
import { AddIcon, ServerIcon, CheckCircleIcon, ErrorCircleIcon, TimeIcon } from 'tdesign-icons-react';

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

const CreateEnvironmentDialog: React.FC<CreateEnvironmentDialogProps> = ({ visible, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('ray');
  const [image, setImage] = useState('rayproject/ray:latest');
  const [replicas, setReplicas] = useState(1);
  const [namespace, setNamespace] = useState('default');
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [autoInitStorage, setAutoInitStorage] = useState(true);

  const frameworkOptions = [
    { label: 'Ray', value: 'ray' },
    { label: 'Horovod', value: 'horovod' },
    { label: 'DeepSpeed', value: 'deepspeed' },
    { label: 'Custom', value: 'custom' },
  ];

  const predefinedImages = {
    ray: 'rayproject/ray:latest',
    horovod: 'horovod/horovod:latest',
    deepspeed: 'deepspeed/deepspeed:latest',
  };

  // 重置表单
  const resetForm = () => {
    setName('');
    setFramework('ray');
    setImage('rayproject/ray:latest');
    setReplicas(1);
    setNamespace('default');
    setAutoInitStorage(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      MessagePlugin.warning('请输入环境名称');
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
      const response = await fetch('http://localhost:8080/api/environments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          framework,
          image,
          replicas,
          namespace,
        }),
      });

      if (response.ok) {
        MessagePlugin.success('环境创建成功！');
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
    } else {
      // 关闭时重置表单
      resetForm();
    }
  }, [visible, namespace]);

  const handleFrameworkChange = (value: any) => {
    setFramework(value);
    if (typeof value === 'string' && predefinedImages[value as keyof typeof predefinedImages]) {
      setImage(predefinedImages[value as keyof typeof predefinedImages]);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Dialog
      visible={visible}
      onClose={handleClose}
      header="创建新环境"
      width={700}
      destroyOnClose
      mode="modal"
      confirmBtn={null}
      cancelBtn={null}
    >
      <div style={{ padding: '20px' }}>
        {/* Storage Status */}
        {storageLoading ? (
          <div style={{ marginBottom: '20px', textAlign: 'center', padding: '20px' }}>
            <Loading text="Checking storage status..." />
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
                      CFS Storage Ready - {storageStatus.available} available out of {storageStatus.capacity}
                    </span>
                  </div>
                }
              />
            ) : (
              <Alert
                theme="warning"
                message={
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <TimeIcon />
                      <span>CFS Storage Status: {storageStatus.status}</span>
                    </div>
                    <div style={{ fontSize: '12px', marginLeft: '24px' }}>
                      Storage will be automatically initialized when you create the environment.
                    </div>
                  </div>
                }
              />
            )}
            
            {framework === 'ray' && (
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: '#f3f3f3', 
                borderRadius: '6px',
                fontSize: '13px'
              }}>
                <div style={{ fontWeight: '500', marginBottom: '6px' }}>📦 Storage Configuration:</div>
                <div style={{ color: '#666', lineHeight: '1.6' }}>
                  • Mount Path: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>/mnt/cfs</code><br/>
                  • Data Path: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>/mnt/cfs/rl-data</code><br/>
                  • Storage Class: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>cfs-turbo-sc</code><br/>
                  • Access Mode: <code style={{ background: '#fff', padding: '2px 6px', borderRadius: '3px' }}>ReadWriteMany</code>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label>Environment Name:</label>
            <Input
              placeholder="Enter environment name"
              value={name}
              onChange={(value) => setName(value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Framework:</label>
            <Select
              value={framework}
              onChange={handleFrameworkChange}
              options={frameworkOptions}
              style={{ width: '100%' }}
              placeholder="Select framework"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Docker Image:</label>
            <Input
              placeholder="Enter Docker image"
              value={image}
              onChange={(value) => setImage(value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Replicas:</label>
            <InputNumber
              min={1}
              max={10}
              value={replicas}
              onChange={(value) => setReplicas(typeof value === 'number' ? value : parseInt(value as string, 10) || 1)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label>Namespace:</label>
            <Input
              placeholder="Enter namespace"
              value={namespace}
              onChange={(value) => setNamespace(value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: '20px' }}>
          <Space>
            <Button 
              theme="default" 
              onClick={onClose} 
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              theme="primary" 
              loading={loading} 
              onClick={handleSubmit}
            >
              创建环境
            </Button>
          </Space>
        </div>
      </div>
    </Dialog>
  );
};

export default CreateEnvironmentDialog;