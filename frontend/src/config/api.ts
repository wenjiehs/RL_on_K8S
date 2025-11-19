// API配置文件
export const API_CONFIG = {
  BASE_URL: 'http://localhost:8080',
  ENDPOINTS: {
    NAMESPACES: '/api/namespaces',
    ENVIRONMENTS: '/api/environments',
    DATASETS: '/api/datasets',
    TRAINING_JOBS: '/api/training-jobs',
    CLUSTER_STATUS: '/api/cluster/status',
  }
};

// 获取完整的API URL
export const getApiUrl = (endpoint: keyof typeof API_CONFIG.ENDPOINTS): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS[endpoint]}`;
};