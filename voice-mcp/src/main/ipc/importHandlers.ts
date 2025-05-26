import { ipcMain, dialog } from 'electron';
import { AudioImportService, ValidationResult, DuplicateResult } from '../audio/AudioImportService';
import { StorageService } from '../storage/StorageService';

let storageService: StorageService;
let audioImportService: AudioImportService;

export function initializeImportHandlers(storage: StorageService) {
  console.log('[ImportHandlers] Initializing import handlers...');
  storageService = storage;
  audioImportService = new AudioImportService(storage.getBasePath());
  console.log('[ImportHandlers] AudioImportService created with base path:', storage.getBasePath());

  // Show file picker dialog for selecting audio files
  ipcMain.handle('import:select-files', async (event) => {
    console.log('[ImportHandlers] File selection requested');
    try {
      const filters = AudioImportService.getFilePickerFilters();
      console.log('[ImportHandlers] File picker filters:', filters);
      
      const result = await dialog.showOpenDialog({
        title: 'Import Audio Files',
        filters: filters,
        properties: ['openFile', 'multiSelections']
      });

      console.log('[ImportHandlers] File picker result:', result);

      if (result.canceled || !result.filePaths.length) {
        console.log('[ImportHandlers] File selection canceled or no files selected');
        return { success: false, canceled: true };
      }

      console.log('[ImportHandlers] Files selected:', result.filePaths);
      return {
        success: true,
        filePaths: result.filePaths
      };
    } catch (error) {
      console.error('[ImportHandlers] Error in import:select-files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Simplified import files handler that matches frontend expectation
  ipcMain.handle('import:import-files', async (event, filePaths: string[]) => {
    console.log('[ImportHandlers] Import files requested for:', filePaths);
    
    try {
      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
        const error = 'No file paths provided or invalid input';
        console.error('[ImportHandlers]', error);
        return {
          success: false,
          error: error,
          imported: 0,
          failed: filePaths?.length || 0
        };
      }

      console.log('[ImportHandlers] Starting validation for', filePaths.length, 'files');
      
      // Step 1: Validate files
      const validationResults = await audioImportService.validateAudioFiles(filePaths);
      console.log('[ImportHandlers] Validation results:', validationResults);

      const validFiles = validationResults.filter(result => result.isValid);
      const invalidFiles = validationResults.filter(result => !result.isValid);

      console.log('[ImportHandlers] Valid files:', validFiles.length, 'Invalid files:', invalidFiles.length);

      if (invalidFiles.length > 0) {
        console.warn('[ImportHandlers] Invalid files found:', invalidFiles.map(f => ({ path: f.file.path, error: f.error })));
      }

      if (validFiles.length === 0) {
        const error = 'No valid audio files found';
        console.error('[ImportHandlers]', error);
        return {
          success: false,
          error: error,
          imported: 0,
          failed: filePaths.length,
          errors: invalidFiles.map(f => `${f.file.path}: ${f.error}`)
        };
      }

      // Step 2: Check for duplicates
      console.log('[ImportHandlers] Checking for duplicates...');
      const existingRecordings = await storageService.listRecordings();
      console.log('[ImportHandlers] Found', existingRecordings.length, 'existing recordings');
      
      const duplicateResults = await audioImportService.checkForDuplicates(
        validFiles,
        existingRecordings
      );
      console.log('[ImportHandlers] Duplicate check results:', duplicateResults);

      const filesToImport = duplicateResults.filter(result => !result.isDuplicate);
      const duplicateFiles = duplicateResults.filter(result => result.isDuplicate);

      console.log('[ImportHandlers] Files to import:', filesToImport.length, 'Duplicates:', duplicateFiles.length);

      if (duplicateFiles.length > 0) {
        console.warn('[ImportHandlers] Duplicate files found:', duplicateFiles.map(f => f.file.path));
      }

      if (filesToImport.length === 0) {
        const error = 'All files are duplicates or invalid';
        console.warn('[ImportHandlers]', error);
        return {
          success: false,
          error: error,
          imported: 0,
          failed: filePaths.length,
          errors: ['All selected files are duplicates or invalid']
        };
      }

      // Step 3: Convert DuplicateResult[] back to ValidationResult[] for importAudioFiles
      const validationResultsToImport: ValidationResult[] = filesToImport.map(dupResult => {
        // Find the original validation result
        const originalValidation = validFiles.find(vr => vr.file.path === dupResult.file.path);
        if (!originalValidation) {
          throw new Error(`Could not find validation result for ${dupResult.file.path}`);
        }
        return originalValidation;
      });

      // Step 4: Import files
      console.log('[ImportHandlers] Starting import of', validationResultsToImport.length, 'files');
      
      const importResults = await audioImportService.importAudioFiles(
        validationResultsToImport,
        {},
        (fileIndex, progress) => {
          console.log('[ImportHandlers] Import progress - File', fileIndex, 'Progress:', progress);
          // Send progress updates to renderer
          event.sender.send('import:progress', {
            fileIndex,
            progress
          });
        }
      );

      console.log('[ImportHandlers] Import results:', importResults);

      // Step 5: Add successful imports to storage
      console.log('[ImportHandlers] Adding successful imports to storage...');
      let successfulImports = 0;
      let failedImports = 0;
      const errors: string[] = [];

      for (const result of importResults) {
        if (result.success && result.recordingId && result.filepath && result.metadata) {
          try {
            console.log('[ImportHandlers] Adding recording to storage:', result.recordingId);
            
            // Create recording metadata entry
            const metadata = {
              id: result.recordingId,
              filename: result.file.originalName || `imported-${Date.now()}.webm`,
              filepath: result.filepath,
              startTime: new Date(),
              endTime: new Date(Date.now() + (result.metadata.duration || 0) * 1000),
              duration: result.metadata.duration || 0,
              size: result.metadata.convertedSize || 0,
              format: 'webm',
              transcriptStatus: 'none' as const,
              aiStatus: 'none' as const
            };

            await storageService.importRecording(metadata);
            console.log('[ImportHandlers] Successfully added recording to storage:', result.recordingId);
            successfulImports++;
          } catch (error) {
            console.error('[ImportHandlers] Failed to add imported recording to storage:', result.recordingId, error);
            failedImports++;
            errors.push(`Failed to save ${result.file.originalName || 'unknown'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          console.error('[ImportHandlers] Import result missing required fields:', result);
          failedImports++;
          errors.push(`Import failed for ${result.file?.originalName || 'unknown file'}: ${result.error || 'Unknown error'}`);
        }
      }

      console.log('[ImportHandlers] Import summary - Successful:', successfulImports, 'Failed:', failedImports);

      return {
        success: successfulImports > 0,
        imported: successfulImports,
        failed: failedImports + invalidFiles.length + duplicateFiles.length,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('[ImportHandlers] Error in import:import-files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        imported: 0,
        failed: filePaths?.length || 0
      };
    }
  });

  // Legacy handlers for more complex workflows
  ipcMain.handle('import:validateFiles', async (event, filePaths: string[]) => {
    console.log('[ImportHandlers] Validation requested for:', filePaths);
    try {
      const validationResults = await audioImportService.validateAudioFiles(filePaths);
      console.log('[ImportHandlers] Validation completed:', validationResults);
      
      return {
        success: true,
        validationResults
      };
    } catch (error) {
      console.error('[ImportHandlers] Error in import:validateFiles:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('import:checkDuplicates', async (event, validationResults) => {
    console.log('[ImportHandlers] Duplicate check requested for:', validationResults?.length, 'files');
    try {
      const existingRecordings = await storageService.listRecordings();
      console.log('[ImportHandlers] Checking against', existingRecordings.length, 'existing recordings');
      
      const duplicateResults = await audioImportService.checkForDuplicates(
        validationResults,
        existingRecordings
      );
      
      console.log('[ImportHandlers] Duplicate check completed:', duplicateResults);
      
      return {
        success: true,
        duplicateResults
      };
    } catch (error) {
      console.error('[ImportHandlers] Error in import:checkDuplicates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('import:getSupportedExtensions', async () => {
    try {
      const extensions = AudioImportService.getSupportedExtensions();
      console.log('[ImportHandlers] Supported extensions:', extensions);
      return {
        success: true,
        extensions: extensions
      };
    } catch (error) {
      console.error('[ImportHandlers] Error getting supported extensions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('[ImportHandlers] All import handlers registered successfully');
}
