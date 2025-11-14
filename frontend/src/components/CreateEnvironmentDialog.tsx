import React, { useState } from 'react';
import { Dialog, Button, MessagePlugin, Space, Select, Input, InputNumber } from 'tdesign-react';
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
  const [image, setImage] = useState('');
  const [replicas, setReplicas] = useState(1);
  const [namespace, setNamespace] = useState('default');

  const frameworkOptions = [
    { label: 'Ray', value: 'ray' },
    { label: 'Horovod', value: 'horovod' },
    { label: 'DeepSpeed', value: 'deepspeed' },
    { label: 'Custom', value: 'custom' },
  ];

  const predefinedImages: Record<string, string> = {
    ray: 'rayproject/ray:latest',
    horovod: 'horovod/horovod:latest',
    deepspeed: 'deepspeed/deepspeed:latest',
  };

  // Image options for each framework
  const getImageOptions = (fw: string) => {
    const options = [];
    if (fw === 'ray') {
      options.push(
        { label: 'rayproject/ray:latest', value: 'rayproject/ray:latest' },
        { label: 'rayproject/ray:2.9.0', value: 'rayproject/ray:2.9.0' },
        { label: 'rayproject/ray:nightly', value: 'rayproject/ray:nightly' },
      );
    } else if (fw === 'horovod') {
      options.push(
        { label: 'horovod/horovod:latest', value: 'horovod/horovod:latest' },
        { label: 'horovod/horovod:0.28.1-tf2.11.0-torch1.13.1-mxnet1.9.1-py3.9', value: 'horovod/horovod:0.28.1-tf2.11.0-torch1.13.1-mxnet1.9.1-py3.9' },
      );
    } else if (fw === 'deepspeed') {
      options.push(
        { label: 'deepspeed/deepspeed:latest', value: 'deepspeed/deepspeed:latest' },
        { label: 'deepspeed/deepspeed:v0.12.3', value: 'deepspeed/deepspeed:v0.12.3' },
      );
    }
    return options;
  };

  const handleFrameworkChange = (value: string) => {
    setFramework(value);
    if (value !== 'custom' && predefinedImages[value]) {
      setImage(predefinedImages[value]);
    } else {
      setImage('');
    }
  };

  const handleSubmit = async () => {
    if (!name) {
      MessagePlugin.warning('Please enter environment name');
      return;
    }

    if (!image) {
      MessagePlugin.warning('Please enter image');
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

      const data = await response.json();

      if (response.ok) {
        MessagePlugin.success(`Environment ${name} created successfully`);
        onSuccess();
        onClose();
        // Reset form
        setName('');
        setFramework('ray');
        setImage('');
        setReplicas(1);
        setNamespace('default');
      } else {
        MessagePlugin.error(data.error || 'Failed to create environment');
      }
    } catch (error) {
      MessagePlugin.error('Network error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      visible={visible}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ServerIcon size="20px" style={{ color: 'var(--tc-primary)' }} />
          <span>Create New Environment</span>
        </div>
      }
      onClose={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button theme="primary" loading={loading} onClick={handleSubmit} icon={<AddIcon />}>
            Create Environment
          </Button>
        </Space>
      }
      width={600}
      destroyOnClose
      mode="modal"
    >
      <div style={{ padding: '8px 0' }}>
        {/* Environment Name */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Environment Name <span style={{ color: '#e34d59' }}>*</span>
          </div>
          <Input
            placeholder="e.g., cartpole-env-1"
            value={name}
            onChange={(value) => setName(value)}
          />
        </div>

        {/* Framework */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Framework <span style={{ color: '#e34d59' }}>*</span>
          </div>
          <Select
            value={framework}
            onChange={handleFrameworkChange}
            options={frameworkOptions}
            style={{ width: '100%' }}
          />
        </div>

        {/* Image */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Container Image <span style={{ color: '#e34d59' }}>*</span>
          </div>
          {framework === 'custom' ? (
            <Input
              placeholder="e.g., myregistry/myimage:tag"
              value={image}
              onChange={(value) => setImage(value)}
            />
          ) : (
            <>
              <Select
                value={image}
                onChange={(value) => setImage(value as string)}
                options={getImageOptions(framework)}
                style={{ width: '100%' }}
                filterable
                creatable
                placeholder="Select or enter custom image"
              />
              <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)', marginTop: '6px' }}>
                💡 Select a predefined image or type to enter a custom one
              </div>
            </>
          )}
        </div>

        {/* Replicas */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Initial Replicas
          </div>
          <InputNumber
            value={replicas}
            onChange={(value) => setReplicas(value as number)}
            min={0}
            max={100}
            style={{ width: '100%' }}
          />
        </div>

        {/* Namespace */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Namespace
          </div>
          <Input
            placeholder="default"
            value={namespace}
            onChange={(value) => setNamespace(value)}
          />
        </div>
      </div>
    </Dialog>
  );
};

export default CreateEnvironmentDialog;