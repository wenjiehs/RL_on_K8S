import React, { useState } from 'react';
import { Dialog, Button, MessagePlugin, Space, Select, Input, Textarea, Upload } from 'tdesign-react';
import { AddIcon, FolderIcon, UploadIcon } from 'tdesign-icons-react';
import type { UploadFile } from 'tdesign-react';

interface CreateDatasetDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  namespace: string;
}

const CreateDatasetDialog: React.FC<CreateDatasetDialogProps> = ({
  visible,
  onClose,
  onSuccess,
  namespace,
}) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [experimentId, setExperimentId] = useState('');
  const [dataType, setDataType] = useState('raw');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<UploadFile[]>([]);

  const dataTypeOptions = [
    { label: 'Raw Data', value: 'raw' },
    { label: 'Training Data', value: 'train' },
    { label: 'Evaluation Data', value: 'eval' },
    { label: 'Model Files', value: 'model' },
  ];

  const handleSubmit = async () => {
    if (!name) {
      MessagePlugin.warning('Please enter dataset name');
      return;
    }

    if (!experimentId) {
      MessagePlugin.warning('Please enter experiment ID');
      return;
    }

    setLoading(true);
    try {
      // Create dataset
      const response = await fetch('http://localhost:8080/api/datasets/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          experimentId,
          dataType,
          description,
          namespace,
          tags: {},
        }),
      });

      const data = await response.json();

      if (response.ok) {
        MessagePlugin.success(`Dataset ${name} created successfully`);
        
        // Upload files if any
        if (files.length > 0) {
          await uploadFiles(name);
        }
        
        onSuccess();
        onClose();
        resetForm();
      } else {
        MessagePlugin.error(data.error || 'Failed to create dataset');
      }
    } catch (error) {
      MessagePlugin.error('Network error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (datasetName: string) => {
    for (const file of files) {
      if (!file.raw) continue;

      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(file.raw.size / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.raw.size);
        const chunk = file.raw.slice(start, end);

        const formData = new FormData();
        formData.append('file', chunk);
        formData.append('datasetName', datasetName);
        formData.append('namespace', namespace);
        formData.append('fileName', file.name || '');
        formData.append('chunkIndex', i.toString());
        formData.append('totalChunks', totalChunks.toString());

        try {
          await fetch('http://localhost:8080/api/datasets/upload', {
            method: 'POST',
            body: formData,
          });
        } catch (error) {
          console.error('Failed to upload chunk:', error);
        }
      }
    }
  };

  const resetForm = () => {
    setName('');
    setExperimentId('');
    setDataType('raw');
    setDescription('');
    setFiles([]);
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
          <FolderIcon size="20px" style={{ color: 'var(--tc-brand-color)' }} />
          <span>Create New Dataset</span>
        </div>
      }
      onClose={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button theme="primary" loading={loading} onClick={handleSubmit} icon={<AddIcon />}>
            Create Dataset
          </Button>
        </Space>
      }
      width={600}
      destroyOnClose
      mode="modal"
    >
      <div style={{ padding: '8px 0' }}>
        {/* Dataset Name */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Dataset Name <span style={{ color: '#e34d59' }}>*</span>
          </div>
          <Input
            placeholder="e.g., cartpole-dataset-1"
            value={name}
            onChange={(value) => setName(value)}
          />
        </div>

        {/* Experiment ID */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Experiment ID <span style={{ color: '#e34d59' }}>*</span>
          </div>
          <Input
            placeholder="e.g., exp-001"
            value={experimentId}
            onChange={(value) => setExperimentId(value)}
          />
          <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)', marginTop: '6px' }}>
            💡 Used to organize datasets in the storage hierarchy
          </div>
        </div>

        {/* Data Type */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Data Type <span style={{ color: '#e34d59' }}>*</span>
          </div>
          <Select
            value={dataType}
            onChange={(value) => setDataType(value as string)}
            options={dataTypeOptions}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)', marginTop: '6px' }}>
            📁 Storage path: /cfs/rl-data/{experimentId}/{dataType}/{'{date}'}
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Description
          </div>
          <Textarea
            placeholder="Optional description for this dataset"
            value={description}
            onChange={(value) => setDescription(value)}
            autosize={{ minRows: 3, maxRows: 6 }}
          />
        </div>

        {/* File Upload */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>
            Upload Files (Optional)
          </div>
          <Upload
            files={files}
            onChange={setFiles}
            theme="file-flow"
            multiple
            draggable
            placeholder="Click or drag files here to upload"
            tips="Support multiple files upload"
          />
        </div>
      </div>
    </Dialog>
  );
};

export default CreateDatasetDialog;