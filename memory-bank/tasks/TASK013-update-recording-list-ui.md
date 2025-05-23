# [TASK013] - Update Recording List UI

**Status:** Completed  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
Update the recording list to look like the provided image with AI titles as primary display, cleaner layout, and improved visual design.

## Thought Process
Based on the provided UI mockup image, the new design should have:

1. **AI Title as Primary**: Display the AI-generated title (e.g., "100x draft driver dod2") as the main text instead of timestamp
2. **Date Grouping with Icons**: Show relative dates like "Yesterday" with speech bubble icon 💬
3. **Time on Right**: Display just the time (e.g., "10:59") aligned to the right
4. **Cleaner Layout**: Darker background, minimal design with better typography
5. **Fallback Display**: If no AI title exists, show timestamp as before

This requires updating both the RecordingItem component and its CSS to match the new design while maintaining all existing functionality (progress bars, menus, etc.).

## Implementation Plan
- [x] Update RecordingItem.tsx to prioritize AI title display
- [x] Modify time/date display logic to show time on right side
- [x] Update RecordingsList.tsx date grouping to use relative dates with icons
- [x] Redesign RecordingItem.module.css for cleaner, darker styling
- [x] Ensure backward compatibility for recordings without AI titles
- [x] Test responsive behavior with long titles

## Progress Tracking

**Overall Status:** Completed - 100%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 13.1 | Update RecordingItem title display logic | Complete | 2025-05-23 | AI title now prioritized over timestamp |
| 13.2 | Modify time display to right alignment | Complete | 2025-05-23 | Time shown on right side in 24h format |
| 13.3 | Update date grouping with icons | Complete | 2025-05-23 | Added 💬 icon to all date group headers |
| 13.4 | Redesign CSS for darker, cleaner look | Complete | 2025-05-23 | Implemented darker theme with improved styling |
| 13.5 | Test with various title lengths | Complete | 2025-05-23 | Text overflow ellipsis implemented |
| 13.6 | Verify all existing functionality works | Complete | 2025-05-23 | All features maintained |

## Progress Log
### 2025-05-23
- Task created based on provided UI mockup
- Analyzed required changes to component structure
- Defined implementation approach for cleaner design
- **Completed RecordingItem component restructure:**
  - Added mainRow layout with title on left, time on right
  - Separated formatTime (24h for display) from formatTimestamp (12h for fallback)
  - AI titles now display as primary text with 🤖 indicator
  - Time display shows just hours:minutes on right side
- **Completed CSS redesign:**
  - Darker theme with #1e1e1e background
  - Green accent color (#22c55e) for AI titles
  - Improved typography and spacing
  - Better visual hierarchy
- **Completed RecordingsList updates:**
  - Added 💬 speech bubble icons to all date group headers
  - Maintained existing grouping logic (Today, Yesterday, This Week, etc.)
- **Implementation Results:**
  - AI titles display prominently when available
  - Fallback to timestamp when no AI title exists
  - Clean, modern dark UI design
  - All existing functionality preserved (menus, progress bars, etc.)
  - Responsive text overflow handling
