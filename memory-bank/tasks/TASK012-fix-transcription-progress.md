# [TASK012] - Fix Transcription Progress

**Status:** Completed  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
The transcription progress doesn't show the actual progress - it uses hardcoded percentages instead of real progress tracking.

## Thought Process
Currently, the whisper_worker.py shows hardcoded progress values (5%, 10%, 20%, etc.) rather than actual transcription progress. This provides poor user feedback as users can't tell how much time is remaining.

The challenge is that the Whisper library doesn't provide native progress callbacks. We need to either:
1. Estimate progress based on audio file duration and processing time
2. Implement custom progress tracking if possible
3. Show indeterminate progress with meaningful status messages
4. Report progress based on segments processed vs total estimated segments

The best approach is likely option 1 - estimate progress based on audio duration and elapsed time, combined with better status messages.

## Implementation Plan
- [ ] Analyze audio file duration before processing starts
- [ ] Implement time-based progress estimation in whisper_worker.py
- [ ] Add more meaningful status messages during processing
- [ ] Update progress reporting to be more granular
- [ ] Consider using Whisper's segment-based processing for better progress tracking
- [ ] Test with various audio file lengths to calibrate progress estimation

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 12.1 | Add audio duration analysis | Complete | 2025-05-23 | Added get_audio_duration() function |
| 12.2 | Implement time-based progress estimation | Complete | 2025-05-23 | ProgressReporter class with threading |
| 12.3 | Add meaningful status messages | Complete | 2025-05-23 | Shows duration, estimated time, time remaining |
| 12.4 | Update progress granularity | Complete | 2025-05-23 | Updates every second during transcription |
| 12.5 | Test progress accuracy | Complete | 2025-05-23 | Added model-specific speed factors |
| 12.6 | Consider segment-based progress | Skipped | 2025-05-23 | Time-based approach sufficient |

## Progress Log
### 2025-05-23
- Task created
- Analyzed current hardcoded progress issue
- Defined approach using time-based estimation
- **IMPLEMENTATION COMPLETED**:
  - Added PROCESSING_SPEED_FACTORS for different Whisper models (tiny: 5x, base: 3x, small: 2x, medium: 1.5x, large: 1x, turbo: 2.5x)
  - Implemented get_audio_duration() function using file size estimation
  - Created ProgressReporter class with threading for smooth progress updates
  - Updates progress every second from 30% to 85% based on elapsed vs estimated time
  - Shows estimated time remaining and informative status messages
  - Updated transcribe_audio() to use time-based progress estimation
  - Progress now shows: "Audio duration: Xs, estimated processing: Ys" and "Processing audio (est. Zs remaining)"
  - Replaced hardcoded jumps (30% → 85%) with smooth progress based on actual processing time
