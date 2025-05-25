import * as fs from 'fs';
import * as path from 'path';
import { PythonEnvironment } from '../python/PythonEnvironment';
import { AudioConverter } from '../audio/AudioConverter';
import { RealTimeJob, TranscriptionResult } from './types';
import { ProcessingChunk } from '../../renderer/services/RecorderService';

export class TranscriptionProcessor {
  private pythonEnv: PythonEnvironment;
  private tempDir: string;

  constructor(pythonEnv: PythonEnvironment, tempDir: string) {
    this.pythonEnv = pythonEnv;
    this.tempDir = tempDir;
  }

  /**
   * Create temporary file from chunk data
   */
  async createTempFile(chunk: ProcessingChunk): Promise<string> {
    const tempFilePath = path.join(this.tempDir, `${chunk.id}.webm`);
    
    // Convert ArrayBuffer to Buffer properly
    const buffer = Buffer.from(new Uint8Array(chunk.data));
    
    // Write chunk data to temp file
    await fs.promises.writeFile(tempFilePath, buffer);
    
    console.log(`Created temp file: ${tempFilePath}, size: ${buffer.length} bytes`);
    
    return tempFilePath;
  }

  /**
   * Clean up a temporary file
   */
  async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        console.log(`Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      console.warn(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  /**
   * Transcribe a chunk using Whisper
   */
  async transcribeChunk(job: RealTimeJob, filePath: string, whisperModel: string, language?: string): Promise<TranscriptionResult> {
    let wavFilePath: string | undefined;
    
    try {
      // Convert WebM to WAV for Whisper compatibility
      const baseName = path.basename(filePath, '.webm');
      wavFilePath = path.join(path.dirname(filePath), `${baseName}.wav`);
      
      console.log(`Converting WebM to WAV: ${filePath} -> ${wavFilePath}`);
      const conversionResult = await AudioConverter.webmToWav(filePath, wavFilePath);
      
      if (!conversionResult.success) {
        throw new Error(`Audio conversion failed: ${conversionResult.error}`);
      }

      // Get the correct path to the Python script
      // Python path is like: /path/to/voice-mcp/python/.venv/bin/python
      // We need to get back to the python directory: /path/to/voice-mcp/python/
      const pythonDir = path.dirname(path.dirname(path.dirname(this.pythonEnv.getPythonPath())));
      const scriptPath = path.join(pythonDir, 'whisper_streaming_worker.py');
      
      // Build command arguments
      const args = [
        scriptPath,
        'single',
        '--audio-file', wavFilePath,
        '--chunk-id', job.chunkId,
        '--model', whisperModel
      ];
      
      // Add language parameter if specified
      if (language) {
        args.push('--language', language);
      }
      
      const result = await this.pythonEnv.runPythonCommand(args);

      if (!result.success) {
        throw new Error(result.stderr || 'Failed to transcribe chunk');
      }

      // Parse the result from the Python worker
      const output = result.stdout || '';
      const lines = output.split('\n').filter((line: string) => line.trim());
      
      let transcriptionResult: TranscriptionResult = {
        text: '',
        language: 'unknown',
        confidence: 0.0
      };

      // Process JSON messages from the Python worker
      for (const line of lines) {
        try {
          const message = JSON.parse(line);
          
          if (message.type === 'result') {
            transcriptionResult = {
              text: message.text || '',
              language: message.language || 'unknown',
              confidence: message.confidence || 0.0
            };
            break;
          } else if (message.type === 'error') {
            throw new Error(message.error || 'Transcription failed');
          }
        } catch (parseError) {
          // Skip non-JSON lines (progress messages, etc.)
          continue;
        }
      }

      // Validate result
      if (!transcriptionResult.text && transcriptionResult.text !== '') {
        throw new Error('No transcription result received from Python worker');
      }

      return transcriptionResult;

    } catch (error) {
      console.error(`Failed to transcribe chunk ${job.chunkId}:`, error);
      throw error;
    } finally {
      // Clean up converted WAV file immediately
      if (wavFilePath && fs.existsSync(wavFilePath)) {
        try {
          await fs.promises.unlink(wavFilePath);
          console.log(`Cleaned up WAV file: ${wavFilePath}`);
        } catch (cleanupError) {
          console.warn(`Failed to cleanup WAV file ${wavFilePath}:`, cleanupError);
        }
      }
    }
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDirectory(): Promise<void> {
    try {
      await fs.promises.mkdir(this.tempDir, { recursive: true });
      console.log(`Temp directory ensured: ${this.tempDir}`);
    } catch (error) {
      console.error(`Failed to create temp directory ${this.tempDir}:`, error);
      throw error;
    }
  }

  /**
   * Clean up old temp files
   */
  async cleanupOldTempFiles(maxAge: number): Promise<number> {
    let deletedCount = 0;
    
    try {
      const files = await fs.promises.readdir(this.tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await this.cleanupTempFile(filePath);
          deletedCount++;
        }
      }
      
      console.log(`Cleaned up ${deletedCount} old temp files`);
    } catch (error) {
      console.warn('Failed to cleanup old temp files:', error);
    }
    
    return deletedCount;
  }
}
