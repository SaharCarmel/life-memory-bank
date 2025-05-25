import { app, safeStorage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  temperature: number;
}

interface StoredOpenAIConfig {
  encryptedApiKey?: string;
  model: string;
  temperature: number;
}

export interface RealTimeTranscriptionConfig {
  enabled: boolean;
  whisperModel: 'tiny' | 'base' | 'small';
  chunkDuration: number; // in seconds
  chunkOverlap: number; // in seconds
  maxConcurrentJobs: number;
  enableSegmentMerging: boolean;
  autoStartForRecordings: boolean;
  language?: string; // optional language hint for Whisper
}

export interface ConfigData {
  openai?: OpenAIConfig;
  realTimeTranscription?: RealTimeTranscriptionConfig;
}

interface StoredConfigData {
  openai?: StoredOpenAIConfig;
  realTimeTranscription?: RealTimeTranscriptionConfig;
}

export class ConfigService {
  private configPath: string;
  private config: ConfigData = {};

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
    } catch (error) {
      console.log('No existing config found, starting fresh');
      this.config = {};
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(configData);
      
      // Decrypt sensitive data if it exists
      if (parsed.openai?.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
        const decryptedKey = safeStorage.decryptString(
          Buffer.from(parsed.openai.encryptedApiKey, 'base64')
        );
        this.config.openai = {
          ...parsed.openai,
          apiKey: decryptedKey
        };
        // Remove the encrypted key property
        const { encryptedApiKey, ...openaiConfig } = parsed.openai;
        this.config.openai = { ...openaiConfig, apiKey: decryptedKey };
      } else {
        this.config = parsed;
      }
    } catch (error) {
      throw new Error(`Failed to load config: ${error}`);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      let configToSave: StoredConfigData = { ...this.config };
      
      // Encrypt sensitive data before saving
      if (this.config.openai?.apiKey && safeStorage.isEncryptionAvailable()) {
        const encryptedKey = safeStorage.encryptString(this.config.openai.apiKey);
        const { apiKey, ...openaiConfig } = this.config.openai;
        configToSave = {
          ...configToSave,
          openai: { 
            ...openaiConfig, 
            encryptedApiKey: encryptedKey.toString('base64') 
          }
        };
      }

      await fs.writeFile(this.configPath, JSON.stringify(configToSave, null, 2));
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  async getOpenAIConfig(): Promise<OpenAIConfig | null> {
    return this.config.openai || null;
  }

  async setOpenAIConfig(config: OpenAIConfig): Promise<void> {
    this.config.openai = config;
    await this.saveConfig();
  }

  async getOpenAIApiKey(): Promise<string | null> {
    return this.config.openai?.apiKey || null;
  }

  async hasOpenAIConfig(): Promise<boolean> {
    const config = await this.getOpenAIConfig();
    return !!(config?.apiKey);
  }

  async validateOpenAIKey(apiKey: string): Promise<boolean> {
    // Basic validation - check if it looks like an OpenAI key
    return apiKey.startsWith('sk-') && apiKey.length > 20;
  }

  getDefaultRealTimeTranscriptionConfig(): RealTimeTranscriptionConfig {
    return {
      enabled: false,
      whisperModel: 'tiny',
      chunkDuration: 5, // 5 seconds
      chunkOverlap: 1, // 1 second overlap
      maxConcurrentJobs: 2,
      enableSegmentMerging: true,
      autoStartForRecordings: false,
      language: undefined // auto-detect
    };
  }

  async getRealTimeTranscriptionConfig(): Promise<RealTimeTranscriptionConfig> {
    const defaults = this.getDefaultRealTimeTranscriptionConfig();
    const saved = this.config.realTimeTranscription;
    
    if (!saved) {
      return defaults;
    }
    
    // Merge saved config with defaults to ensure all fields are present
    return {
      ...defaults,
      ...saved
    };
  }

  async setRealTimeTranscriptionConfig(config: RealTimeTranscriptionConfig): Promise<void> {
    this.config.realTimeTranscription = config;
    await this.saveConfig();
  }

  async updateRealTimeTranscriptionConfig(updates: Partial<RealTimeTranscriptionConfig>): Promise<void> {
    const current = await this.getRealTimeTranscriptionConfig();
    const updated = { ...current, ...updates };
    await this.setRealTimeTranscriptionConfig(updated);
  }

  async isRealTimeTranscriptionEnabled(): Promise<boolean> {
    const config = await this.getRealTimeTranscriptionConfig();
    return config.enabled;
  }

  async clearConfig(): Promise<void> {
    this.config = {};
    await this.saveConfig();
  }
}

// Singleton instance
export const configService = new ConfigService();
