import { useState, useEffect } from 'react';

export interface ConfigOption {
  label: string;
  value: string;
  description: string;
  path?: string;
}

export interface TrainingMethod {
  label: string;
  value: string;
  description: string;
  compatibleTypes: string[];
}

export interface DatasetOption {
  label: string;
  value: string;
  path: string;
  description: string;
  format: string;
}

export interface TrainingConfig {
  baseModels: ConfigOption[];
  trainingTypes: ConfigOption[];
  trainingMethods: TrainingMethod[];
  dpoDatasets: DatasetOption[];
  commonImages: ConfigOption[];
}

export const useTrainingConfig = () => {
  const [config, setConfig] = useState<TrainingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8080/api/training-config');
      
      if (!response.ok) {
        throw new Error('Failed to fetch training configuration');
      }
      
      const data = await response.json();
      setConfig(data);
    } catch (err: any) {
      console.error('Failed to load training config:', err);
      setError(err.message || 'Failed to load training configuration');
    } finally {
      setLoading(false);
    }
  };

  const reloadConfig = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/training-config/reload', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to reload training configuration');
      }
      
      const data = await response.json();
      setConfig(data.config);
      return { success: true, message: data.message };
    } catch (err: any) {
      console.error('Failed to reload training config:', err);
      return { success: false, message: err.message };
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    reloadConfig,
    refetch: fetchConfig,
  };
};