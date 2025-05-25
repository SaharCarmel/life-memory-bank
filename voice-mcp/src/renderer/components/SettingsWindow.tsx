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

interface RealTimeTranscriptionConfig {
  enabled: boolean;
  whisperModel: 'tiny' | 'base' | 'small';
  chunkDuration: number;
  chunkOverlap: number;
  maxConcurrentJobs: number;
  enableSegmentMerging: boolean;
  autoStartForRecordings: boolean;
  language?: string;
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'openai' | 'transcription'>('openai');
  const [openaiConfig, setOpenaiConfig] = useState<OpenAIConfig>({
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0
  });
  const [transcriptionConfig, setTranscriptionConfig] = useState<RealTimeTranscriptionConfig>({
    enabled: false,
    whisperModel: 'tiny',
    chunkDuration: 5,
    chunkOverlap: 1,
    maxConcurrentJobs: 2,
    enableSegmentMerging: true,
    autoStartForRecordings: false,
    language: undefined
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
      
      // Load OpenAI config
      const openaiConfig = await window.electron.config.getOpenAIConfig();
      if (openaiConfig) {
        setOpenaiConfig({
          apiKey: openaiConfig.hasApiKey ? '••••••••••••••••' : '', // Mask existing key
          model: openaiConfig.model || 'gpt-4o',
          temperature: openaiConfig.temperature || 0
        });
        setHasExistingKey(openaiConfig.hasApiKey);
      }

      // Load real-time transcription config
      const rtConfig = await window.electron.config.getRealTimeTranscriptionConfig();
      if (rtConfig) {
        setTranscriptionConfig(rtConfig);
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

      if (activeTab === 'openai') {
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
      } else if (activeTab === 'transcription') {
        // Validate transcription config
        if (transcriptionConfig.chunkOverlap >= transcriptionConfig.chunkDuration) {
          throw new Error('Chunk overlap must be less than chunk duration');
        }
        
        if (transcriptionConfig.chunkDuration < 2 || transcriptionConfig.chunkDuration > 30) {
          throw new Error('Chunk duration must be between 2 and 30 seconds');
        }
        
        if (transcriptionConfig.chunkOverlap < 0.5 || transcriptionConfig.chunkOverlap > 5) {
          throw new Error('Chunk overlap must be between 0.5 and 5 seconds');
        }

        await window.electron.config.setRealTimeTranscriptionConfig(transcriptionConfig);
      }
      
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
            <button 
              className={`${styles.tab} ${activeTab === 'transcription' ? styles.active : ''}`}
              onClick={() => setActiveTab('transcription')}
            >
              Real-time Transcription
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

            {activeTab === 'transcription' && (
              <div className={styles.section}>
                <h3>Real-time Transcription</h3>
                <p className={styles.description}>
                  Configure real-time transcription settings for live transcript display during recording.
                </p>

                <div className={styles.field}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={transcriptionConfig.enabled}
                      onChange={(e) => setTranscriptionConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      className={styles.checkbox}
                    />
                    Enable Real-time Transcription
                  </label>
                  <small className={styles.hint}>
                    Show live transcription while recording (requires more CPU resources)
                  </small>
                </div>

                <div className={styles.field}>
                  <label htmlFor="whisperModel">Whisper Model</label>
                  <select
                    id="whisperModel"
                    value={transcriptionConfig.whisperModel}
                    onChange={(e) => setTranscriptionConfig(prev => ({ ...prev, whisperModel: e.target.value as 'tiny' | 'base' | 'small' }))}
                    className={styles.select}
                    disabled={!transcriptionConfig.enabled}
                  >
                    <option value="tiny">Tiny (Fastest, less accurate)</option>
                    <option value="base">Base (Balanced)</option>
                    <option value="small">Small (Slower, more accurate)</option>
                  </select>
                  <small className={styles.hint}>
                    Larger models are more accurate but slower
                  </small>
                </div>

                <div className={styles.field}>
                  <label htmlFor="language">Language (Optional)</label>
                  <select
                    id="language"
                    value={transcriptionConfig.language || ''}
                    onChange={(e) => setTranscriptionConfig(prev => ({ ...prev, language: e.target.value || undefined }))}
                    className={styles.select}
                    disabled={!transcriptionConfig.enabled}
                  >
                    <option value="">Auto-detect</option>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="it">Italian</option>
                    <option value="pt">Portuguese</option>
                    <option value="ru">Russian</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                    <option value="zh">Chinese</option>
                  </select>
                  <small className={styles.hint}>
                    Specify language for better accuracy, or leave as auto-detect
                  </small>
                </div>

                <div className={styles.field}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={transcriptionConfig.autoStartForRecordings}
                      onChange={(e) => setTranscriptionConfig(prev => ({ ...prev, autoStartForRecordings: e.target.checked }))}
                      className={styles.checkbox}
                      disabled={!transcriptionConfig.enabled}
                    />
                    Auto-start for new recordings
                  </label>
                  <small className={styles.hint}>
                    Automatically start real-time transcription when recording begins
                  </small>
                </div>

                <div className={styles.field}>
                  <label htmlFor="maxConcurrentJobs">Max Concurrent Jobs</label>
                  <input
                    id="maxConcurrentJobs"
                    type="number"
                    min="1"
                    max="4"
                    value={transcriptionConfig.maxConcurrentJobs}
                    onChange={(e) => setTranscriptionConfig(prev => ({ ...prev, maxConcurrentJobs: parseInt(e.target.value) }))}
                    className={styles.input}
                    disabled={!transcriptionConfig.enabled}
                  />
                  <small className={styles.hint}>
                    Number of audio chunks to process simultaneously (1-4)
                  </small>
                </div>

                <div className={styles.field}>
                  <label htmlFor="chunkDuration">Chunk Duration (seconds)</label>
                  <input
                    id="chunkDuration"
                    type="number"
                    min="2"
                    max="30"
                    step="0.5"
                    value={transcriptionConfig.chunkDuration}
                    onChange={(e) => setTranscriptionConfig(prev => ({ ...prev, chunkDuration: parseFloat(e.target.value) }))}
                    className={styles.input}
                    disabled={!transcriptionConfig.enabled}
                  />
                  <small className={styles.hint}>
                    Length of audio chunks for processing (2-30 seconds). Shorter = more real-time, longer = more efficient
                  </small>
                </div>

                <div className={styles.field}>
                  <label htmlFor="chunkOverlap">Chunk Overlap (seconds)</label>
                  <input
                    id="chunkOverlap"
                    type="number"
                    min="0.5"
                    max="5"
                    step="0.5"
                    value={transcriptionConfig.chunkOverlap}
                    onChange={(e) => setTranscriptionConfig(prev => ({ ...prev, chunkOverlap: parseFloat(e.target.value) }))}
                    className={styles.input}
                    disabled={!transcriptionConfig.enabled}
                  />
                  <small className={styles.hint}>
                    Overlap between chunks for better continuity (0.5-5 seconds, must be less than chunk duration)
                  </small>
                </div>

                <div className={styles.field}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={transcriptionConfig.enableSegmentMerging}
                      onChange={(e) => setTranscriptionConfig(prev => ({ ...prev, enableSegmentMerging: e.target.checked }))}
                      className={styles.checkbox}
                      disabled={!transcriptionConfig.enabled}
                    />
                    Enable Smart Segment Merging
                  </label>
                  <small className={styles.hint}>
                    Intelligently merge overlapping transcript segments for better readability
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
