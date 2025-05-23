import { ipcMain } from 'electron';
import { configService } from '../config/ConfigService';

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
}
