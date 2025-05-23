# [TASK012] - Fix Transcription Progress

**Status:** Pending  
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

**Overall Status:** Not Started - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 12.1 | Add audio duration analysis | Not Started | | Get file duration before processing |
| 12.2 | Implement time-based progress estimation | Not Started | | Progress = elapsed_time / estimated_total_time |
| 12.3 | Add meaningful status messages | Not Started | | "Loading model", "Processing audio", etc. |
| 12.4 | Update progress granularity | Not Started | | Report progress more frequently |
| 12.5 | Test progress accuracy | Not Started | | Verify with different file lengths |
| 12.6 | Consider segment-based progress | Not Started | | If Whisper supports it |

## Progress Log
### 2025-05-23
- Task created
- Analyzed current hardcoded progress issue
- Defined approach using time-based estimation
