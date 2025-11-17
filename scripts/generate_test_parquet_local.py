#!/usr/bin/env python3
"""
Generate test Parquet files for Data Management testing (Local version)
Uses /tmp directory instead of /cfs for local testing
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

def generate_training_data():
    """Generate sample training data"""
    np.random.seed(42)
    n_samples = 1000
    
    data = {
        'episode_id': range(n_samples),
        'timestamp': [datetime.now() - timedelta(hours=i) for i in range(n_samples)],
        'state_dim_0': np.random.randn(n_samples),
        'state_dim_1': np.random.randn(n_samples),
        'state_dim_2': np.random.randn(n_samples),
        'action': np.random.choice(['up', 'down', 'left', 'right'], n_samples),
        'reward': np.random.randn(n_samples) * 10,
        'done': np.random.choice([True, False], n_samples),
        'q_value': np.random.randn(n_samples) * 100,
        'loss': np.abs(np.random.randn(n_samples)),
    }
    
    df = pd.DataFrame(data)
    return df

def generate_evaluation_data():
    """Generate sample evaluation data"""
    np.random.seed(123)
    n_episodes = 100
    
    data = {
        'episode_id': range(n_episodes),
        'total_reward': np.random.randn(n_episodes) * 100 + 500,
        'episode_length': np.random.randint(50, 500, n_episodes),
        'success_rate': np.random.uniform(0.5, 1.0, n_episodes),
        'avg_q_value': np.random.randn(n_episodes) * 50 + 200,
        'exploration_rate': np.linspace(1.0, 0.1, n_episodes),
        'timestamp': [datetime.now() - timedelta(days=i) for i in range(n_episodes)],
    }
    
    df = pd.DataFrame(data)
    return df

def generate_model_metadata():
    """Generate model checkpoint metadata"""
    data = {
        'checkpoint_id': ['ckpt_001', 'ckpt_002', 'ckpt_003', 'ckpt_004', 'ckpt_005'],
        'epoch': [10, 20, 30, 40, 50],
        'train_loss': [0.5, 0.3, 0.2, 0.15, 0.12],
        'val_loss': [0.6, 0.35, 0.25, 0.18, 0.15],
        'accuracy': [0.85, 0.90, 0.92, 0.94, 0.95],
        'learning_rate': [0.001, 0.0005, 0.0002, 0.0001, 0.00005],
        'timestamp': [datetime.now() - timedelta(hours=i*2) for i in range(5)],
        'model_size_mb': [125.5, 125.8, 126.2, 126.5, 126.8],
    }
    
    df = pd.DataFrame(data)
    return df

def main():
    # Use /tmp for local testing (instead of /cfs which is read-only)
    base_path = "/tmp/rl-data"
    experiment_id = "exp-001"
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Create directories
    paths = {
        'train': os.path.join(base_path, experiment_id, 'train', date_str),
        'eval': os.path.join(base_path, experiment_id, 'eval', date_str),
        'model': os.path.join(base_path, experiment_id, 'model', date_str),
        'raw': os.path.join(base_path, experiment_id, 'raw', date_str),
    }
    
    for path in paths.values():
        os.makedirs(path, exist_ok=True)
        print(f"✅ Created directory: {path}")
    
    # Generate and save training data
    print("\n📊 Generating training data...")
    train_df = generate_training_data()
    train_path = os.path.join(paths['train'], 'training_episodes.parquet')
    train_df.to_parquet(train_path, engine='pyarrow', compression='snappy')
    print(f"✅ Saved: {train_path}")
    print(f"   Shape: {train_df.shape}")
    print(f"   Columns: {list(train_df.columns)}")
    
    # Generate and save evaluation data
    print("\n📊 Generating evaluation data...")
    eval_df = generate_evaluation_data()
    eval_path = os.path.join(paths['eval'], 'evaluation_results.parquet')
    eval_df.to_parquet(eval_path, engine='pyarrow', compression='snappy')
    print(f"✅ Saved: {eval_path}")
    print(f"   Shape: {eval_df.shape}")
    print(f"   Columns: {list(eval_df.columns)}")
    
    # Generate and save model metadata
    print("\n📊 Generating model metadata...")
    model_df = generate_model_metadata()
    model_path = os.path.join(paths['model'], 'checkpoint_metadata.parquet')
    model_df.to_parquet(model_path, engine='pyarrow', compression='snappy')
    print(f"✅ Saved: {model_path}")
    print(f"   Shape: {model_df.shape}")
    print(f"   Columns: {list(model_df.columns)}")
    
    # Create some raw data files (CSV for comparison)
    print("\n📄 Generating raw data...")
    raw_df = train_df.head(100)
    raw_csv_path = os.path.join(paths['raw'], 'raw_episodes.csv')
    raw_df.to_csv(raw_csv_path, index=False)
    print(f"✅ Saved: {raw_csv_path}")
    
    raw_json_path = os.path.join(paths['raw'], 'config.json')
    with open(raw_json_path, 'w') as f:
        f.write('''{
  "experiment_id": "exp-001",
  "algorithm": "DQN",
  "environment": "CartPole-v1",
  "hyperparameters": {
    "learning_rate": 0.001,
    "gamma": 0.99,
    "epsilon_start": 1.0,
    "epsilon_end": 0.01,
    "epsilon_decay": 0.995,
    "batch_size": 64,
    "memory_size": 10000
  },
  "created_at": "''' + datetime.now().isoformat() + '''"
}''')
    print(f"✅ Saved: {raw_json_path}")
    
    print("\n" + "="*60)
    print("🎉 Test data generation complete!")
    print("="*60)
    print(f"\n📁 Base path: {base_path}/{experiment_id}")
    print(f"\n📝 Next steps:")
    print(f"   1. Update backend CFSBasePath to: {base_path}")
    print(f"   2. Test API: curl 'http://localhost:8080/api/datasets/parquet-preview?path={train_path}'")
    print(f"   3. Browse files in the Data Management interface")
    print()

if __name__ == '__main__':
    main()