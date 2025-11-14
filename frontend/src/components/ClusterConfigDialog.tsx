import React, { useState, useRef } from 'react';
import { Dialog, Button, MessagePlugin, Space, Divider, Upload } from 'tdesign-react';
import { LinkIcon, CloudIcon, UploadIcon, CheckCircleIcon } from 'tdesign-icons-react';
import type { UploadFile } from 'tdesign-react';

interface ClusterConfigDialogProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (nodes: any[]) => void;
}

interface ContextInfo {
  name: string;
  cluster: string;
  user: string;
}

const ClusterConfigDialog: React.FC<ClusterConfigDialogProps> = ({ visible, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [apiServer, setApiServer] = useState<string>('');
  const [contexts, setContexts] = useState<ContextInfo[]>([]);
  const [selectedContext, setSelectedContext] = useState<string>('');
  const [currentContext, setCurrentContext] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
      
      // Parse kubeconfig to get contexts
      try {
        const base64Content = btoa(content);
        const response = await fetch('http://localhost:8080/api/cluster/parse-kubeconfig', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            kubeConfig: base64Content,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setContexts(data.contexts || []);
          setCurrentContext(data.currentContext || '');
          setSelectedContext(data.currentContext || '');
        }
      } catch (error) {
        console.error('Failed to parse kubeconfig:', error);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (!fileContent) {
      MessagePlugin.warning('Please upload a kubeconfig file');
      return;
    }

    if (!selectedContext) {
      MessagePlugin.warning('Please select a context');
      return;
    }

    setLoading(true);
    try {
      // Encode kubeconfig to base64
      const base64Content = btoa(fileContent);

      const response = await fetch('http://localhost:8080/api/cluster/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kubeConfig: base64Content,
          apiServer: apiServer || undefined,
          context: selectedContext,
        }),
      });

      const data = await response.json();

      if (response.ok && data.connected) {
        MessagePlugin.success(data.message);
        onSuccess(data.nodes || []);
        onClose();
        // Reset form
        setFileContent('');
        setFileName('');
        setApiServer('');
        setContexts([]);
        setSelectedContext('');
        setCurrentContext('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        MessagePlugin.error(data.message || 'Failed to connect to cluster');
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

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog
      visible={visible}
      header={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CloudIcon size="20px" style={{ color: 'var(--tc-primary)' }} />
          <span>Configure Kubernetes Cluster</span>
        </div>
      }
      onClose={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button theme="primary" loading={loading} onClick={handleSubmit} icon={<LinkIcon />}>
            Connect to Cluster
          </Button>
        </Space>
      }
      width={680}
      destroyOnClose
      mode="modal"
      attach="body"
    >
      <div style={{ padding: '8px 0' }}>
        {/* Info Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #e6f2ff 0%, #f0f5ff 100%)',
            padding: '16px',
            borderRadius: '6px',
            marginBottom: '24px',
            border: '1px solid #b3d8ff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <CloudIcon size="20px" style={{ color: 'var(--tc-primary)', marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--tc-text-primary)', marginBottom: '8px' }}>
                Connect to Your Kubernetes Cluster
              </div>
              <div style={{ fontSize: '13px', color: 'var(--tc-text-secondary)', lineHeight: '1.6' }}>
                Upload your kubeconfig file to establish a secure connection to your Kubernetes cluster.
              </div>
            </div>
          </div>
        </div>

        {/* Context Selection */}
        {contexts.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <CloudIcon size="16px" style={{ color: 'var(--tc-primary)' }} />
              <span style={{ fontWeight: '500', fontSize: '14px' }}>Kubernetes Context</span>
              <span style={{ color: '#e34d59', marginLeft: '2px' }}>*</span>
            </div>
            <select
              value={selectedContext}
              onChange={(e) => setSelectedContext(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '14px',
                border: '1px solid var(--tc-border-color)',
                borderRadius: '4px',
                background: '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--tc-primary)';
                e.target.style.boxShadow = '0 0 0 3px rgba(13, 110, 255, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--tc-border-color)';
                e.target.style.boxShadow = 'none';
              }}
            >
              {contexts.map((ctx) => (
                <option key={ctx.name} value={ctx.name}>
                  {ctx.name} {ctx.name === currentContext ? '(current)' : ''} - Cluster: {ctx.cluster}
                </option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)', marginTop: '6px' }}>
              Select the context you want to connect to
            </div>
          </div>
        )}

        {/* API Server URL Section */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <CloudIcon size="16px" style={{ color: 'var(--tc-primary)' }} />
            <span style={{ fontWeight: '500', fontSize: '14px' }}>API Server URL (Optional)</span>
          </div>
          <input
            type="text"
            placeholder="https://your-k8s-api-server:6443"
            value={apiServer}
            onChange={(e) => setApiServer(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '14px',
              border: '1px solid var(--tc-border-color)',
              borderRadius: '4px',
              fontFamily: 'monospace',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--tc-primary)';
              e.target.style.boxShadow = '0 0 0 3px rgba(13, 110, 255, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--tc-border-color)';
              e.target.style.boxShadow = 'none';
            }}
          />
          <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)', marginTop: '6px' }}>
            Override the API server URL from kubeconfig (leave empty to use the one in kubeconfig)
          </div>
        </div>

        {/* File Upload Section */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <UploadIcon size="16px" style={{ color: 'var(--tc-primary)' }} />
            <span style={{ fontWeight: '500', fontSize: '14px' }}>Kubeconfig File</span>
            <span style={{ color: '#e34d59', marginLeft: '2px' }}>*</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          <div
            onClick={handleSelectFile}
            style={{
              border: '2px dashed var(--tc-border-color)',
              borderRadius: '6px',
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: fileName ? '#f0f5ff' : '#fafafa',
              borderColor: fileName ? 'var(--tc-primary)' : 'var(--tc-border-color)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--tc-primary)';
              e.currentTarget.style.background = '#f0f5ff';
            }}
            onMouseLeave={(e) => {
              if (!fileName) {
                e.currentTarget.style.borderColor = 'var(--tc-border-color)';
                e.currentTarget.style.background = '#fafafa';
              }
            }}
          >
            {fileName ? (
              <div>
                <CheckCircleIcon size="48px" style={{ color: 'var(--tc-primary)', marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--tc-text-primary)', marginBottom: '4px' }}>
                  {fileName}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)' }}>
                  Click to select a different file
                </div>
              </div>
            ) : (
              <div>
                <UploadIcon size="48px" style={{ color: 'var(--tc-text-placeholder)', marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--tc-text-primary)', marginBottom: '4px' }}>
                  Click to upload kubeconfig file
                </div>
                <div style={{ fontSize: '12px', color: 'var(--tc-text-secondary)' }}>
                  Supports any kubeconfig file format
                </div>
              </div>
            )}
          </div>
        </div>

        <Divider />

        {/* Help Section */}
        <div
          style={{
            background: '#fafafa',
            padding: '16px',
            borderRadius: '6px',
            fontSize: '13px',
            color: 'var(--tc-text-secondary)',
          }}
        >
          <div style={{ fontWeight: '500', color: 'var(--tc-text-primary)', marginBottom: '12px' }}>
            📝 How to get your kubeconfig file:
          </div>
          
          <div style={{ marginBottom: '12px' }}>
            <strong>Default location:</strong>
          </div>
          <pre
            style={{
              background: '#fff',
              padding: '12px',
              borderRadius: '4px',
              border: '1px solid var(--tc-border-color)',
              overflow: 'auto',
              marginBottom: '12px',
              fontFamily: 'monospace',
              fontSize: '12px',
            }}
          >
            ~/.kube/config
          </pre>

          <div style={{ marginBottom: '8px' }}>
            <strong>Or export from your cluster:</strong>
          </div>
          <pre
            style={{
              background: '#fff',
              padding: '12px',
              borderRadius: '4px',
              border: '1px solid var(--tc-border-color)',
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: '1.5',
            }}
          >
{`# View current config
kubectl config view --raw

# Export to file
kubectl config view --raw > my-kubeconfig.yaml`}
          </pre>

          <div style={{ marginTop: '12px', padding: '8px', background: '#fff3e6', borderRadius: '4px', border: '1px solid #ed7b2f' }}>
            <strong style={{ color: '#ed7b2f' }}>⚠️ Security Note:</strong>
            <div style={{ marginTop: '4px', fontSize: '12px' }}>
              Your kubeconfig file contains sensitive credentials. Never share it publicly or commit it to version control.
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ClusterConfigDialog;