import { ipcMain } from 'electron';
import { configService, RealTimeTranscriptionConfig } from '../config/ConfigService';

export function setupConfigHandlers(): void {
  // Get OpenAI configuration
  ipcMain.handle('config:getOpenAI', async () => {
    try {
      const config = await configService.getOpenAIConfig();
      // Don't send the API key to renderer for security
      if (config) {
        return {
          model: config.model,
          temperature: config.temperature,
          hasApiKey: !!config.apiKey
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to get OpenAI config:', error);
      throw error;
    }
  });

  // Set OpenAI configuration
  ipcMain.handle('config:setOpenAI', async (_, config: {
    apiKey: string;
    model: string;
    temperature: number;
  }) => {
    try {
      // Validate API key
      const isValid = await configService.validateOpenAIKey(config.apiKey);
      if (!isValid) {
        throw new Error('Invalid OpenAI API key format');
      }

      await configService.setOpenAIConfig(config);
      return { success: true };
    } catch (error) {
      console.error('Failed to set OpenAI config:', error);
      throw error;
    }
  });

  // Check if OpenAI is configured
  ipcMain.handle('config:hasOpenAI', async () => {
    try {
      return await configService.hasOpenAIConfig();
    } catch (error) {
      console.error('Failed to check OpenAI config:', error);
      return false;
    }
  });

  // Clear configuration
  ipcMain.handle('config:clear', async () => {
    try {
      await configService.clearConfig();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear config:', error);
      throw error;
    }
  });

  // Test OpenAI connection
  ipcMain.handle('config:testOpenAI', async (_, apiKey: string) => {
    try {
      // Basic validation
      const isValid = await configService.validateOpenAIKey(apiKey);
      if (!isValid) {
        return { success: false, error: 'Invalid API key format' };
      }

      // TODO: Add actual API test call here
      // For now, just validate the format
      return { success: true };
    } catch (error) {
      console.error('Failed to test OpenAI config:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Get real-time transcription configuration
  ipcMain.handle('config:getRealTimeTranscription', async () => {
    try {
      return await configService.getRealTimeTranscriptionConfig();
    } catch (error) {
      console.error('Failed to get real-time transcription config:', error);
      throw error;
    }
  });

  // Set real-time transcription configuration
  ipcMain.handle('config:setRealTimeTranscription', async (_, config: RealTimeTranscriptionConfig) => {
    try {
      await configService.setRealTimeTranscriptionConfig(config);
      return { success: true };
    } catch (error) {
      console.error('Failed to set real-time transcription config:', error);
      throw error;
    }
  });

  // Update real-time transcription configuration
  ipcMain.handle('config:updateRealTimeTranscription', async (_, updates: Partial<RealTimeTranscriptionConfig>) => {
    try {
      await configService.updateRealTimeTranscriptionConfig(updates);
      return { success: true };
    } catch (error) {
      console.error('Failed to update real-time transcription config:', error);
      throw error;
    }
  });

  // Check if real-time transcription is enabled
  ipcMain.handle('config:isRealTimeTranscriptionEnabled', async () => {
    try {
      return await configService.isRealTimeTranscriptionEnabled();
    } catch (error) {
      console.error('Failed to check real-time transcription status:', error);
      return false;
    }
  });

  // Get default real-time transcription configuration
  ipcMain.handle('config:getDefaultRealTimeTranscription', async () => {
    try {
      return configService.getDefaultRealTimeTranscriptionConfig();
    } catch (error) {
      console.error('Failed to get default real-time transcription config:', error);
      throw error;
    }
  });
}
