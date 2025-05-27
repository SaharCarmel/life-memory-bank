# [TASK025] - Fix Recording Refresh After Stop

**Status:** Pending  
**Added:** 2025-05-26  
**Updated:** 2025-05-26

## Original Request
User reports: "I can't see records after I stop recording. Maybe a refresh problem?"

## Problem Analysis
After recording stops, the recordings list is not automatically refreshing to show the new recording. This suggests an issue in the refresh mechanism chain:

1. **Event Flow**: Recording stop → File finalization → Event emission → UI refresh
2. **Current Implementation**: 
   - `audioHandlers.ts` emits `RECORDING_COMPLETED` event after 500ms delay
   - `RecordingsList.tsx` listens for this event and calls `loadRecordings()`
   - `StorageService.listRecordings()` scans filesystem and enhances with metadata

## Potential Root Causes
1. **Timing Issue**: 500ms delay insufficient for file system operations
2. **Caching Issue**: RecordingStorageService caching stale data
3. **Event Chain Issue**: Event not firing or listener not working
4. **Database Sync Issue**: Race condition between file creation and database updates
5. **File System Delay**: macOS file system notifications delayed

## Implementation Plan

### Phase 1: Diagnostic Enhancement
1. **Add Debug Logging**
   - Enhanced logging in audioHandlers.ts recording stop flow
   - Debug logs in RecordingsList.tsx event handlers
   - Timing logs in StorageService.listRecordings()
   - File system operation logging

2. **Event Verification**
   - Verify RECORDING_COMPLETED event is being emitted
   - Confirm event listeners are properly attached
   - Test event propagation through preload script

### Phase 2: Timing Improvements
1. **Increase Delay**
   - Extend delay from 500ms to 1000ms or 1500ms
   - Make delay configurable for testing

2. **File System Verification**
   - Add file existence check before emitting event
   - Wait for file size to stabilize before event emission
   - Implement retry mechanism for file system operations

### Phase 3: Caching and Refresh Fixes
1. **Clear Storage Cache**
   - Implement cache clearing in RecordingStorageService
   - Force fresh filesystem scan on recording completion

2. **Enhanced Refresh Strategy**
   - Multiple refresh attempts with exponential backoff
   - Force UI re-render after recording completion
   - Add manual refresh button as fallback

### Phase 4: Alternative Event Sources
1. **File System Watchers**
   - Implement filesystem watching for recording directory
   - Use Node.js fs.watch() as backup event source

2. **Polling Fallback**
   - Implement periodic polling as last resort
   - Short-term polling after recording events

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Add comprehensive debug logging | Not Started | 2025-05-26 | Track event flow and timing |
| 1.2 | Verify event emission and listener attachment | Not Started | 2025-05-26 | Ensure events are properly working |
| 1.3 | Test file system timing and delays | Not Started | 2025-05-26 | Identify optimal delay timing |
| 2.1 | Implement configurable delay with file verification | Not Started | 2025-05-26 | Replace fixed 500ms delay |
| 2.2 | Add retry mechanism for file operations | Not Started | 2025-05-26 | Handle filesystem delays |
| 3.1 | Clear storage caches on recording completion | Not Started | 2025-05-26 | Prevent stale data issues |
| 3.2 | Implement enhanced refresh strategy | Not Started | 2025-05-26 | Multiple refresh attempts |
| 4.1 | Add filesystem watcher backup | Not Started | 2025-05-26 | Alternative event source |
| 4.2 | Implement manual refresh button | Not Started | 2025-05-26 | User fallback option |

## Progress Log
### 2025-05-26
- Created task to systematically investigate and fix recording refresh issue
- Analyzed current event flow: audioHandlers → preload → RecordingsList
- Identified potential timing and caching issues
- Planned phased approach: diagnostics → timing → caching → alternatives

## Technical Notes
- Current delay: 500ms in audioHandlers.ts
- Event: RECORDING_COMPLETED sent to all windows
- Listener: RecordingsList.tsx calls loadRecordings() 
- Storage: StorageService.listRecordings() scans filesystem
- Issue likely in timing between file finalization and UI refresh

## Expected Outcome
Recordings should appear immediately in the list after stopping recording, with no manual refresh required.
