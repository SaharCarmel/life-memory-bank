import * as fs from 'fs';
import * as path from 'path';
import { AIContentStorage } from './types';

export class AIContentStorageService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  public getAIContentPath(recordingFilepath: string): string {
    const dir = path.dirname(recordingFilepath);
    const basename = path.basename(recordingFilepath, '.webm');
    return path.join(dir, `${basename}.ai.json`);
  }

  public async hasAIContent(recordingFilepath: string): Promise<boolean> {
    const aiPath = this.getAIContentPath(recordingFilepath);
    try {
      await fs.promises.access(aiPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async saveAIContent(recordingId: string, recordingFilepath: string, title: string, summary: string): Promise<string> {
    try {
      const aiPath = this.getAIContentPath(recordingFilepath);
      
      const aiData: AIContentStorage = {
        recordingId,
        generatedAt: new Date(),
        title,
        summary,
        version: '1.0'
      };

      await fs.promises.writeFile(aiPath, JSON.stringify(aiData, null, 2), 'utf8');
      
      console.log(`AI content saved: ${aiPath}`);
      return aiPath;
    } catch (error) {
      console.error(`Failed to save AI content for recording ${recordingId}:`, error);
      throw new Error(`Failed to save AI content: ${error}`);
    }
  }

  public async getAIContent(recordingFilepath: string): Promise<{ title: string; summary: string } | null> {
    try {
      const aiPath = this.getAIContentPath(recordingFilepath);
      
      if (!await this.hasAIContent(recordingFilepath)) {
        return null;
      }

      const data = await fs.promises.readFile(aiPath, 'utf8');
      const aiData: AIContentStorage = JSON.parse(data);
      
      return {
        title: aiData.title,
        summary: aiData.summary
      };
    } catch (error) {
      console.error(`Failed to load AI content from ${recordingFilepath}:`, error);
      return null;
    }
  }

  public async deleteAIContent(recordingFilepath: string): Promise<void> {
    try {
      const aiPath = this.getAIContentPath(recordingFilepath);
      
      if (await this.hasAIContent(recordingFilepath)) {
        await fs.promises.unlink(aiPath);
        console.log(`AI content deleted: ${aiPath}`);
      }
    } catch (error) {
      console.error(`Failed to delete AI content for ${recordingFilepath}:`, error);
      throw new Error(`Failed to delete AI content: ${error}`);
    }
  }

  public async updateAIStatus(recordingId: string, status: 'none' | 'processing' | 'completed' | 'failed', error?: string, progress?: number): Promise<void> {
    // This method would typically update a database or metadata file
    // For now, we'll just log the status update
    console.log(`AI status updated for ${recordingId}: ${status}`, { error, progress });
  }
}
