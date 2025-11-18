import React, { useState } from 'react';
import { Dialog, Button, Space, Select, Input, InputNumber, Loading } from 'tdesign-react';
// @ts-nocheck
import { AddIcon, ServerIcon } from 'tdesign-icons-react';

interface CreateEnvironmentDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEnvironmentDialog: React.FC<CreateEnvironmentDialogProps> = ({ visible, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [framework, setFramework] = useState('ray');
  const [image, setImage] = useState('rayproject/ray:latest');
  const [replicas, setReplicas] = useState(1);
  const [namespace, setNamespace] = useState('default');

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

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Please enter environment name');
      return;
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
        onSuccess();
        alert('Environment created successfully!');
      } else {
        const error = await response.json();
        alert('Failed to create environment: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Network error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFrameworkChange = (value: any) => {
    setFramework(value);
    if (typeof value === 'string' && predefinedImages[value as keyof typeof predefinedImages]) {
      setImage(predefinedImages[value as keyof typeof predefinedImages]);
    }
  };

  if (!visible) return null;

  return (
    <Dialog
      visible={visible}
      onClose={onClose}
      header="Create New Environment"
      width={600}
      destroyOnClose
      mode="modal"
    >
      <div style={{ padding: '20px' }}>
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
              Create Environment
            </Button>
          </Space>
        </div>
      </div>
    </Dialog>
  );
};

export default CreateEnvironmentDialog;