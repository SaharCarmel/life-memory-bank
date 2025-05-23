import React, { useState, useEffect } from 'react';
import styles from './SettingsWindow.module.css';

interface SettingsWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

interface OpenAIConfig {
  apiKey: string;
  model: string;
  temperature: number;
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'openai'>('openai');
  const [openaiConfig, setOpenaiConfig] = useState<OpenAIConfig>({
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
    }
  }, [isOpen]);

  const loadCurrentConfig = async () => {
    try {
      setIsLoading(true);
      const config = await window.electron.config.getOpenAIConfig();
      if (config) {
        setOpenaiConfig({
          apiKey: config.hasApiKey ? '••••••••••••••••' : '', // Mask existing key
          model: config.model || 'gpt-4o',
          temperature: config.temperature || 0
        });
        setHasExistingKey(config.hasApiKey);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setMessage(null);

      // Only update API key if it's not the masked value
      const configToSave = {
        ...openaiConfig,
        apiKey: openaiConfig.apiKey === '••••••••••••••••' ? undefined : openaiConfig.apiKey
      };

      // Validate API key format if provided
      if (configToSave.apiKey && !configToSave.apiKey.startsWith('sk-')) {
        throw new Error('OpenAI API key must start with "sk-"');
      }

      await window.electron.config.setOpenAIConfig(configToSave);
      
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Close after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to save settings' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setMessage(null);
    onClose();
  };

  const handleApiKeyChange = (value: string) => {
    setOpenaiConfig(prev => ({ ...prev, apiKey: value }));
    setHasExistingKey(false); // Clear existing key flag when user types
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Settings</h2>
          <button className={styles.closeButton} onClick={handleCancel}>
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'openai' ? styles.active : ''}`}
              onClick={() => setActiveTab('openai')}
            >
              OpenAI
            </button>
          </div>

          <div className={styles.tabContent}>
            {activeTab === 'openai' && (
              <div className={styles.section}>
                <h3>OpenAI Configuration</h3>
                <p className={styles.description}>
                  Configure your OpenAI API key to enable AI-powered features like smart recording names and summaries.
                </p>

                <div className={styles.field}>
                  <label htmlFor="apiKey">API Key</label>
                  <input
                    id="apiKey"
                    type="password"
                    value={openaiConfig.apiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder={hasExistingKey ? 'API key is configured' : 'sk-...'}
                    className={styles.input}
                  />
                  <small className={styles.hint}>
                    Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">OpenAI Platform</a>
                  </small>
                </div>

                <div className={styles.field}>
                  <label htmlFor="model">Model</label>
                  <select
                    id="model"
                    value={openaiConfig.model}
                    onChange={(e) => setOpenaiConfig(prev => ({ ...prev, model: e.target.value }))}
                    className={styles.select}
                  >
                    <option value="gpt-4o">GPT-4o (Recommended)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label htmlFor="temperature">Temperature</label>
                  <input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={openaiConfig.temperature}
                    onChange={(e) => setOpenaiConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className={styles.input}
                  />
                  <small className={styles.hint}>
                    Controls randomness (0 = deterministic, 2 = very creative)
                  </small>
                </div>
              </div>
            )}
          </div>

          {message && (
            <div className={`${styles.message} ${styles[message.type]}`}>
              {message.text}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button 
            className={styles.cancelButton} 
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className={styles.saveButton} 
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
