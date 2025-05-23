# [TASK014] - Import External Recordings

**Status:** Pending  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
Add the ability to load external recordings from the user's file system into VoiceMCP for transcription and AI processing.

## Thought Process
Currently, VoiceMCP only works with recordings made within the app. Users should be able to import existing audio files (meetings, interviews, lectures, etc.) to leverage the transcription and AI summary features.

The implementation needs to:
1. **File Selection**: Provide multiple ways to import (file picker, drag-and-drop)
2. **Format Support**: Handle common audio formats (MP3, WAV, M4A, AAC, FLAC, OGG, WebM)
3. **File Processing**: Copy files to VoiceMCP storage structure, generate metadata
4. **Integration**: Make imported files work seamlessly with existing transcription/AI features
5. **User Experience**: Clear progress indication, error handling, file validation

Key considerations:
- File size limits (large files may impact performance)
- Audio format conversion if needed for consistency
- Metadata extraction (duration, format, bitrate)
- Storage organization alongside recorded files

## Implementation Plan
- [ ] Add import button to main UI
- [ ] Implement file picker dialog with audio format filters
- [ ] Add drag-and-drop support to recordings list area
- [ ] Create file validation and metadata extraction logic
- [ ] Implement file copying to VoiceMCP storage structure
- [ ] Add progress indication for import process
- [ ] Update StorageService to handle imported files
- [ ] Add visual distinction for imported vs recorded files
- [ ] Test with various audio formats and file sizes

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 14.1 | Add import button to UI | Not Started | | Main import entry point |
| 14.2 | Implement file picker dialog | Not Started | | Filter for audio formats |
| 14.3 | Add drag-and-drop support | Not Started | | Drop zone in recordings list |
| 14.4 | Create file validation logic | Not Started | | Check format, size, duration |
| 14.5 | Implement metadata extraction | Not Started | | Get duration, format info |
| 14.6 | Update StorageService for imports | Not Started | | Handle external file copying |
| 14.7 | Add import progress indication | Not Started | | Show copy/process progress |
| 14.8 | Add visual distinction in UI | Not Started | | Icon/badge for imported files |
| 14.9 | Test with various formats | Not Started | | MP3, WAV, M4A, etc. |

## Progress Log
### 2025-05-23
- Task created
- Analyzed requirements for external file import
- Defined comprehensive approach including UI and backend changes
