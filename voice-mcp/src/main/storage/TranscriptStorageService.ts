import * as fs from 'fs';
import * as path from 'path';
import { TranscriptStorage } from './types';

export class TranscriptStorageService {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  public getTranscriptPath(recordingFilepath: string): string {
    const dir = path.dirname(recordingFilepath);
    const basename = path.basename(recordingFilepath, '.webm');
    return path.join(dir, `${basename}.transcript.json`);
  }

  public async hasTranscript(recordingFilepath: string): Promise<boolean> {
    const transcriptPath = this.getTranscriptPath(recordingFilepath);
    try {
      await fs.promises.access(transcriptPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async saveTranscript(recordingId: string, recordingFilepath: string, transcript: TranscriptStorage['result']): Promise<string> {
    try {
      const transcriptPath = this.getTranscriptPath(recordingFilepath);
      
      const transcriptData: TranscriptStorage = {
        recordingId,
        transcribedAt: new Date(),
        result: transcript,
        version: '1.0'
      };

      await fs.promises.writeFile(transcriptPath, JSON.stringify(transcriptData, null, 2), 'utf8');
      
      console.log(`Transcript saved: ${transcriptPath}`);
      return transcriptPath;
    } catch (error) {
      console.error(`Failed to save transcript for recording ${recordingId}:`, error);
      throw new Error(`Failed to save transcript: ${error}`);
    }
  }

  public async loadTranscript(recordingFilepath: string): Promise<TranscriptStorage['result'] | null> {
    try {
      const transcriptPath = this.getTranscriptPath(recordingFilepath);
      
      if (!await this.hasTranscript(recordingFilepath)) {
        return null;
      }

      const data = await fs.promises.readFile(transcriptPath, 'utf8');
      const transcriptData: TranscriptStorage = JSON.parse(data);
      
      return transcriptData.result;
    } catch (error) {
      console.error(`Failed to load transcript from ${recordingFilepath}:`, error);
      return null;
    }
  }

  public async deleteTranscript(recordingFilepath: string): Promise<void> {
    try {
      const transcriptPath = this.getTranscriptPath(recordingFilepath);
      
      if (await this.hasTranscript(recordingFilepath)) {
        await fs.promises.unlink(transcriptPath);
        console.log(`Transcript deleted: ${transcriptPath}`);
      }
    } catch (error) {
      console.error(`Failed to delete transcript for ${recordingFilepath}:`, error);
      throw new Error(`Failed to delete transcript: ${error}`);
    }
  }

  public async updateTranscriptStatus(recordingId: string, status: 'none' | 'processing' | 'completed' | 'failed', error?: string, progress?: number): Promise<void> {
    // This method would typically update a database or metadata file
    // For now, we'll just log the status update
    console.log(`Transcript status updated for ${recordingId}: ${status}`, { error, progress });
  }
}
