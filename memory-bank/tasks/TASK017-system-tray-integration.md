# [TASK017] - System Tray Integration

**Status:** Pending  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
Implement system tray functionality to provide quick access to meeting recording controls and status indicators without requiring the main window to be open.

## Thought Process
The system tray is crucial for meeting recording functionality because:

1. **Always Available**: Users need quick access to recording controls during meetings
2. **Status Visibility**: Clear indication of current recording state
3. **Minimal Interruption**: Tray interactions don't disrupt the meeting window
4. **Quick Actions**: Start/stop recording, meeting mode toggle, open main app

**System Tray States:**
- **Gray**: Monitoring for meetings (idle)
- **Yellow**: Meeting detected, awaiting user action
- **Red**: Recording in progress with timer
- **Green**: Processing/transcribing completed recording
- **Blue**: Meeting mode manually enabled

**Tray Menu Structure:**
```
🎤 VoiceMCP
├── Meeting Mode: [On/Off]
├── Recording: [Start/Stop] (00:05:23)
├── ─────────────────
├── Quick Record
├── Open Main Window
├── Settings
├── ─────────────────
└── Quit
```

## Implementation Plan
- [ ] Add Electron system tray support
- [ ] Create dynamic tray icons for different states
- [ ] Implement tray menu with meeting controls
- [ ] Add recording timer display in tray
- [ ] Create meeting detection notifications
- [ ] Implement quick actions (start/stop recording)
- [ ] Add meeting mode toggle
- [ ] Connect tray to main application state
- [ ] Handle tray clicks and menu interactions
- [ ] Test tray behavior across different scenarios

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 17.1 | Set up Electron Tray module | Not Started | | Basic tray integration |
| 17.2 | Create dynamic tray icons | Not Started | | Different states (gray/yellow/red/green/blue) |
| 17.3 | Implement tray menu structure | Not Started | | Meeting controls and options |
| 17.4 | Add recording timer to tray | Not Started | | Live duration display |
| 17.5 | Create meeting detection notifications | Not Started | | "Meeting detected?" prompts |
| 17.6 | Implement quick recording actions | Not Started | | Start/stop from tray |
| 17.7 | Add meeting mode toggle | Not Started | | Manual meeting mode activation |
| 17.8 | Connect to main app state | Not Started | | Sync with main window |
| 17.9 | Handle tray interactions | Not Started | | Click events, menu selections |
| 17.10 | Test tray functionality | Not Started | | Cross-platform behavior |

## Technical Details

### Tray Icon Assets Needed:
- `tray-idle.png` - Gray microphone (monitoring)
- `tray-detected.png` - Yellow microphone (meeting detected)
- `tray-recording.png` - Red microphone (recording active)
- `tray-processing.png` - Green microphone (processing)
- `tray-meeting-mode.png` - Blue microphone (meeting mode on)

### Menu State Management:
- Dynamic menu items based on current state
- Timer updates every second during recording
- Meeting mode persistence across sessions
- Integration with main window visibility

### Notifications:
- Native macOS notifications for meeting detection
- Non-intrusive prompts with action buttons
- User preference for notification frequency

## Progress Log
### 2025-05-23
- Task created for system tray integration
- Defined tray states and menu structure
- Planned icon assets and interaction flows
- Outlined notification system approach
