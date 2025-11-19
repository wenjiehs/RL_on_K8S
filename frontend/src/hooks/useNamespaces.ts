import { useState, useEffect } from 'react';
import { MessagePlugin } from 'tdesign-react';
import { getApiUrl } from '../config/api';

interface Namespace {
  name: string;
  status: string;
  labels?: Record<string, string>;
  created: string;
}

interface UseNamespacesReturn {
  namespaces: Namespace[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useNamespaces = (): UseNamespacesReturn => {
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNamespaces = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(getApiUrl('NAMESPACES'));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        // 转换为前端需要的格式
        const formattedNamespaces = data.map((ns: Namespace) => ({
          label: ns.name,
          value: ns.name,
          ...ns
        }));
        setNamespaces(formattedNamespaces);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch namespaces';
      setError(errorMessage);
      MessagePlugin.error(`获取命名空间失败: ${errorMessage}`);
      
      // 设置默认命名空间作为fallback
      setNamespaces([
        { label: 'default', value: 'default', name: 'default', status: 'Active', created: '' },
        { label: 'ray-test', value: 'ray-test', name: 'ray-test', status: 'Active', created: '' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNamespaces();
  }, []);

  return {
    namespaces,
    loading,
    error,
    refetch: fetchNamespaces
  };
};