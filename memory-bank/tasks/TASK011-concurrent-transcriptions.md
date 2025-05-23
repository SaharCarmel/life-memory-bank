# [TASK011] - Concurrent Transcriptions

**Status:** Pending  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
Enable concurrent transcriptions so multiple recordings can be transcribed simultaneously instead of one at a time.

## Thought Process
Currently, the WhisperService is limited to 1 concurrent job (`maxConcurrentJobs: 1`). This means users have to wait for each transcription to complete before starting another one. For users with multiple recordings, this creates a poor experience.

The implementation needs to:
1. Increase the concurrent job limit (3-5 simultaneous jobs recommended)
2. Ensure proper process management for multiple Python worker processes
3. Update the UI to handle multiple simultaneous progress indicators
4. Consider system resource limits (CPU/memory) when setting the concurrent limit
5. Implement proper queue management when the limit is exceeded

## Implementation Plan
- [ ] Modify WhisperService constructor to accept higher maxConcurrentJobs (default: 3)
- [ ] Update UI to show multiple progress bars for different recordings
- [ ] Add queue status indication when jobs are waiting
- [ ] Test resource usage with multiple concurrent jobs
- [ ] Add setting to allow users to configure concurrent job limit
- [ ] Ensure proper cleanup when jobs are cancelled or fail

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 11.1 | Update WhisperService maxConcurrentJobs | Not Started | | Change from 1 to 3-5 |
| 11.2 | Test multiple process management | Not Started | | Ensure Python workers don't conflict |
| 11.3 | Update UI for multiple progress indicators | Not Started | | Show all active transcriptions |
| 11.4 | Add queue management UI | Not Started | | Show waiting/queued jobs |
| 11.5 | Add user setting for concurrent limit | Not Started | | Allow user to configure based on system |
| 11.6 | Performance testing | Not Started | | Test with 3-5 concurrent jobs |

## Progress Log
### 2025-05-23
- Task created
- Initial analysis of current limitation
- Defined implementation approach
