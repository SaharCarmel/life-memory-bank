# [TASK018] - Calendar Integration & Meeting Prediction

**Status:** Pending  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
Integrate with calendar systems to predict upcoming meetings and automatically suggest recording when meetings are detected. Use calendar data to improve meeting detection and provide smart naming for recordings.

## Thought Process
Calendar integration enhances the meeting recording experience by:

1. **Predictive Recording**: Alert users before meetings start
2. **Smart Naming**: Use calendar event titles for recording names
3. **Context Awareness**: Know when you're likely to be in a meeting
4. **Attendee Information**: Capture participant details for better organization
5. **Meeting Duration**: Estimate recording length from calendar events

**Calendar Sources to Support:**
- **macOS Calendar.app** (EventKit framework)
- **Google Calendar** (Google Calendar API)
- **Microsoft Outlook** (Microsoft Graph API)
- **Exchange/Office 365** (EWS or Graph API)

**Integration Workflow:**
1. Request calendar permissions
2. Monitor upcoming events (next 15-30 minutes)
3. Pre-prompt: "Meeting '[Event Title]' starts in 5 minutes. Enable auto-record?"
4. During meeting: Use event title for recording name
5. Post-meeting: Add attendee info to recording metadata

## Implementation Plan
- [ ] Research calendar API access on macOS (EventKit)
- [ ] Implement CalendarService for event monitoring
- [ ] Add calendar permission requests
- [ ] Create meeting prediction logic (upcoming events)
- [ ] Implement pre-meeting notifications
- [ ] Add smart recording naming from calendar events
- [ ] Extract and store attendee information
- [ ] Add meeting duration estimation
- [ ] Implement Google Calendar API integration
- [ ] Add Outlook/Exchange support
- [ ] Create calendar settings UI
- [ ] Test with various calendar platforms

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 18.1 | Research macOS EventKit API | Not Started | | Native calendar access |
| 18.2 | Create CalendarService | Not Started | | Core calendar integration service |
| 18.3 | Add calendar permissions | Not Started | | Request user authorization |
| 18.4 | Implement meeting prediction | Not Started | | Monitor upcoming events |
| 18.5 | Create pre-meeting notifications | Not Started | | "Meeting starts soon" alerts |
| 18.6 | Add smart recording naming | Not Started | | Use calendar event titles |
| 18.7 | Extract attendee information | Not Started | | Capture participant data |
| 18.8 | Add Google Calendar integration | Not Started | | Google Calendar API |
| 18.9 | Implement Outlook support | Not Started | | Microsoft Graph API |
| 18.10 | Create calendar settings UI | Not Started | | User configuration interface |
| 18.11 | Test cross-platform calendar sync | Not Started | | Validate with different calendars |

## Technical Details

### EventKit Integration (macOS):
```swift
// Request calendar access
EKEventStore.requestAccess(to: .event) { granted, error in
    // Handle permission result
}

// Monitor upcoming events
let predicate = eventStore.predicateForEvents(
    withStart: Date(),
    end: Date().addingTimeInterval(1800), // 30 minutes
    calendars: nil
)
```

### Meeting Detection Logic:
- Event duration > 15 minutes = likely meeting
- Keywords in title: "meeting", "call", "standup", "sync", "review"
- Multiple attendees (>1 person)
- Video call links in description (Zoom, Teams, Meet)

### Smart Features:
- **Auto-Enable Meeting Mode**: 5 minutes before calendar events
- **Recording Names**: "[Event Title] - [Date]"
- **Metadata Enhancement**: 
  - Meeting organizer
  - Attendee list
  - Calendar source
  - Original event duration
  - Meeting location/video link

### Privacy Considerations:
- Calendar data stays local (no cloud storage)
- User control over which calendars to monitor
- Opt-in for each calendar source
- Clear data usage explanation

### Settings UI:
```
Calendar Integration
├── ☑ Enable meeting prediction
├── ☑ Auto-enable meeting mode
├── ☐ Google Calendar
├── ☑ macOS Calendar
├── ☐ Outlook/Exchange
├── Prediction time: [15] minutes before
└── Auto-record meetings: [Ask each time ▼]
```

## Progress Log
### 2025-05-23
- Task created for calendar integration
- Researched EventKit and calendar API options
- Defined meeting prediction logic and smart features
- Planned privacy-first approach for calendar data
