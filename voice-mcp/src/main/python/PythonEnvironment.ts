import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';

export interface PythonSetupOptions {
  pythonPath?: string;
  forceReinstall?: boolean;
}

export interface PythonSetupResult {
  success: boolean;
  pythonPath: string;
  venvPath: string;
  error?: string;
}

export class PythonEnvironment {
  private basePath: string;
  private venvPath: string;
  private pythonExecutable: string;

  constructor() {
    // Use app resources path for Python environment
    this.basePath = path.join(app.getAppPath(), 'python');
    this.venvPath = path.join(this.basePath, '.venv');
    
    // Platform-specific Python executable path
    const isWindows = process.platform === 'win32';
    this.pythonExecutable = isWindows 
      ? path.join(this.venvPath, 'Scripts', 'python.exe')
      : path.join(this.venvPath, 'bin', 'python');
  }

  /**
   * Check if Python environment is properly set up
   */
  async isEnvironmentReady(): Promise<boolean> {
    try {
      // Check if virtual environment exists
      if (!fs.existsSync(this.venvPath)) {
        return false;
      }

      // Check if Python executable exists
      if (!fs.existsSync(this.pythonExecutable)) {
        return false;
      }

      // Check if whisper is installed
      const result = await this.runPythonCommand(['-c', 'import whisper; print("OK")']);
      return result.success && result.stdout.trim() === 'OK';
    } catch (error) {
      console.error('Error checking Python environment:', error);
      return false;
    }
  }

  /**
   * Set up the Python environment with uv
   */
  async setup(options: PythonSetupOptions = {}): Promise<PythonSetupResult> {
    try {
      console.log('Setting up Python environment...');

      // Check if uv is available
      const uvAvailable = await this.checkUvAvailable();
      if (!uvAvailable) {
        return {
          success: false,
          pythonPath: '',
          venvPath: '',
          error: 'uv package manager not found. Please install uv first.'
        };
      }

      // Create virtual environment if it doesn't exist or force reinstall
      if (!fs.existsSync(this.venvPath) || options.forceReinstall) {
        console.log('Creating virtual environment...');
        await this.createVirtualEnvironment();
      }

      // Install dependencies
      console.log('Installing Python dependencies...');
      await this.installDependencies();

      // Verify installation
      const isReady = await this.isEnvironmentReady();
      if (!isReady) {
        throw new Error('Environment setup completed but verification failed');
      }

      console.log('Python environment setup complete');

      return {
        success: true,
        pythonPath: this.pythonExecutable,
        venvPath: this.venvPath
      };

    } catch (error) {
      console.error('Python environment setup failed:', error);
      return {
        success: false,
        pythonPath: '',
        venvPath: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get the path to the Python executable
   */
  getPythonPath(): string {
    return this.pythonExecutable;
  }

  /**
   * Get the path to the whisper worker script
   */
  getWorkerScriptPath(): string {
    return path.join(this.basePath, 'whisper_worker.py');
  }

  /**
   * Get the path to the OpenAI transcription worker script
   */
  getOpenAIWorkerScriptPath(): string {
    return path.join(this.basePath, 'openai_transcription_worker.py');
  }

  /**
   * Run a Python command in the virtual environment
   */
  async runPythonCommand(args: string[], options: { timeout?: number } = {}): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }> {
    return new Promise((resolve) => {
      const timeout = options.timeout || 30000; // 30 seconds default
      
      const child = spawn(this.pythonExecutable, args, {
        cwd: this.basePath,
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout;

      // Set up timeout
      timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        resolve({
          success: false,
          stdout,
          stderr: stderr + '\nProcess timed out',
          exitCode: null
        });
      }, timeout);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          stdout,
          stderr: stderr + '\n' + error.message,
          exitCode: null
        });
      });
    });
  }

  /**
   * Check if uv package manager is available
   */
  private async checkUvAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('uv', ['--version'], { stdio: 'pipe' });
      
      child.on('close', (code) => {
        resolve(code === 0);
      });

      child.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Create virtual environment using uv
   */
  private async createVirtualEnvironment(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Remove existing venv if it exists
      if (fs.existsSync(this.venvPath)) {
        fs.rmSync(this.venvPath, { recursive: true, force: true });
      }

      // Create new virtual environment
      const child = spawn('uv', ['venv', '.venv'], {
        cwd: this.basePath,
        stdio: 'pipe'
      });

      let stderr = '';

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('Virtual environment created successfully');
          resolve();
        } else {
          reject(new Error(`Failed to create virtual environment: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to spawn uv: ${error.message}`));
      });
    });
  }

  /**
   * Install dependencies using uv
   */
  private async installDependencies(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Install dependencies from pyproject.toml
      const child = spawn('uv', ['sync'], {
        cwd: this.basePath,
        stdio: 'pipe'
      });

      let stderr = '';

      child.stdout?.on('data', (data) => {
        console.log('uv sync:', data.toString().trim());
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        console.error('uv sync error:', data.toString().trim());
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('Dependencies installed successfully');
          resolve();
        } else {
          reject(new Error(`Failed to install dependencies: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to spawn uv sync: ${error.message}`));
      });
    });
  }

  /**
   * Clean up the Python environment
   */
  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.venvPath)) {
        fs.rmSync(this.venvPath, { recursive: true, force: true });
        console.log('Python environment cleaned up');
      }
    } catch (error) {
      console.error('Error cleaning up Python environment:', error);
    }
  }
}
