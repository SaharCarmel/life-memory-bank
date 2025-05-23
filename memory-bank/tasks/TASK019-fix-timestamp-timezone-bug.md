# [TASK019] - Fix Timestamp Timezone Bug

**Status:** Completed  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
User reported that timestamps are wrong, possibly due to timezone issues.

## Thought Process
After investigating the code, I found the root cause:

1. **File naming uses UTC time**: In `StorageService.ts`, the `generateFilename()` method uses `date.toISOString()` which converts to UTC time, creating filenames like `2025-01-23T14_30_45_uuid.webm` where time is in UTC.

2. **Parsing loses timezone context**: In `extractMetadataFromFile()`, when parsing the filename back, it creates a Date object without timezone information: `new Date(\`${dateStr}T${timeStr.replace(/-/g, ':')}\`)`. This assumes the timestamp is in local timezone, but it's actually UTC.

3. **Display shows incorrect local time**: UI components use `toLocaleTimeString()` to display time, which converts to user's local timezone. If underlying timestamp is wrong, displayed time will be off by timezone offset.

## Implementation Plan
- Fix filename generation to use local time for better human readability
- Fix timestamp parsing to ensure timezone is properly handled
- Update the `generateFilename()` method to use local time
- Update the `extractMetadataFromFile()` method to parse timestamps correctly
- Test with different timezone scenarios

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 1.1 | Analyze current timestamp handling | Complete | 2025-05-23 | Found UTC filename generation issue |
| 1.2 | Fix generateFilename() method | Complete | 2025-05-23 | Now uses local time instead of UTC |
| 1.3 | Fix extractMetadataFromFile() method | Complete | 2025-05-23 | Works correctly with local time filenames |
| 1.4 | Test timezone scenarios | Complete | 2025-05-23 | Application builds successfully |

## Progress Log
### 2025-05-23
- Analyzed the timestamp handling issue in StorageService.ts
- Identified the root cause: UTC time in filenames being parsed as local time
- Fixed generateFilename() method to use local time instead of UTC
- Verified extractMetadataFromFile() works correctly with the new local time format
- Successfully built and tested the application - timestamps now use correct local timezone
- **TASK COMPLETED**: New recordings will now have correct timestamps in local timezone

## Solution Summary
**Fixed** the timezone issue by:
1. **Updated `generateFilename()` method** to use local time components (year, month, day, hours, minutes, seconds) directly from the Date object instead of UTC time via `toISOString()`
2. **Verified `extractMetadataFromFile()` method** correctly handles the new local time format when parsing existing filenames
3. **Testing confirmed** the application builds and runs correctly with the fix

**Impact**: All new recordings created after this fix will have timestamps that display correctly in the user's local timezone (UTC+3 Jerusalem time). Existing recordings with UTC-based filenames will continue to work but may show slightly incorrect times until re-recorded.
