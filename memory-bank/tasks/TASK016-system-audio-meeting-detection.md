# [TASK016] - System Audio Capture & Meeting Detection

**Status:** Pending  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
Implement system audio capture combined with microphone recording to detect and record meetings. The app should monitor system audio activity and prompt users when a potential meeting is detected.

## Thought Process
This is the core foundation for meeting recording functionality. The implementation needs to:

1. **Dual Audio Capture**: Record both system audio (meeting participants) and microphone (user's voice)
2. **Meeting Detection**: Monitor audio patterns to identify potential meetings vs music/videos
3. **User Interaction**: Prompt user when meeting activity is detected
4. **macOS Integration**: Use ScreenCaptureKit API for system audio capture
5. **Permission Handling**: Manage screen recording and microphone permissions
6. **Privacy-First Approach**: Comprehensive privacy safeguards and user control

### User Requirements (Clarified 2025-05-23)
- **Audio Format**: WebM/Opus (same as microphone), 128kbps
- **Detection Strategy**: Conservative (miss some rather than false positives)
- **User Notifications**: macOS system notifications 
- **Recording Behavior**: Always ask user before starting (no auto-record)
- **Privacy**: Comprehensive privacy controls and safeguards

### Technical Architecture

#### Audio Pipeline
```
System Audio (ScreenCaptureKit) → Privacy Filter → Meeting Detector
Microphone (MediaRecorder) → Audio Mixer → Dual-Channel Recording
```

#### Meeting Detection Flow
1. **Audio Monitoring**: Background system audio analysis
2. **Pattern Recognition**: Detect conversational patterns (75%+ confidence)
3. **User Notification**: macOS system notification with meeting context
4. **User Choice**: Start Recording / Dismiss / Never for this app
5. **Recording**: Dual-channel recording with visual indicators

#### Privacy Architecture
- **Application Filtering**: Blacklist sensitive apps (banking, password managers)
- **Content Detection**: Pause during password fields and sensitive forms
- **Local Processing**: No cloud transmission of system audio
- **Encryption**: In-memory audio stream encryption
- **Visual Indicators**: Always show when system audio is active
- **Data Control**: Easy deletion, export, and retention controls

### Key Technical Challenges
- macOS requires Screen Recording permission for system audio
- Audio synchronization between system and microphone streams
- Pattern recognition for meeting vs non-meeting audio (conservative approach)
- Resource management for longer recordings
- Privacy filtering of sensitive applications and content
- Real-time audio processing without performance impact

## Implementation Plan

### Phase 1: Privacy Foundation (Days 1-2)
- [ ] Create privacy settings system and UI
- [ ] Implement app detection and filtering logic
- [ ] Add visual recording indicators (menu bar, dock badge)
- [ ] Set up secure audio buffer management with encryption
- [ ] Design permission request flow with clear explanations

### Phase 2: System Audio Capture (Days 3-4)
- [ ] Research and integrate ScreenCaptureKit API
- [ ] Create SystemAudioService for audio capture
- [ ] Handle macOS Screen Recording permissions
- [ ] Implement secure audio streaming with privacy filters
- [ ] Test basic system audio capture functionality

### Phase 3: Audio Processing & Mixing (Days 5-6)
- [ ] Create AudioMixer service for dual-channel recording
- [ ] Implement audio synchronization between system and mic
- [ ] Handle timing, buffering, and clock drift issues
- [ ] Ensure WebM/Opus output format compatibility
- [ ] Test with various audio scenarios and latency

### Phase 4: Meeting Detection (Days 7-8)
- [ ] Create MeetingDetector with conservative algorithms
- [ ] Implement speech pattern analysis (300-3000 Hz range)
- [ ] Add conversation detection (30-second buffer, speaker changes)
- [ ] Filter out media playback patterns (music, videos)
- [ ] Achieve 75%+ confidence threshold for detection

### Phase 5: Notification System (Days 9-10)
- [ ] Integrate with macOS notification center
- [ ] Design contextual notification content
- [ ] Implement quick actions (Start/Dismiss/Settings)
- [ ] Add smart timing (notify during conversation lulls)
- [ ] Handle notification preferences and permissions

### Phase 6: Integration & Testing (Days 11-12)
- [ ] Update existing recording UI for meeting mode
- [ ] Integrate with current RecorderService architecture
- [ ] Add meeting-specific metadata and naming
- [ ] Comprehensive testing with real meeting platforms
- [ ] Performance optimization and error handling

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 16.1 | Privacy settings and app filtering | Not Started | | Foundation for secure recording |
| 16.2 | ScreenCaptureKit integration | Not Started | | macOS system audio capture |
| 16.3 | SystemAudioService creation | Not Started | | Service for system audio handling |
| 16.4 | Audio synchronization and mixing | Not Started | | Combine system + mic audio |
| 16.5 | Meeting detection algorithms | Not Started | | Conservative pattern analysis |
| 16.6 | macOS notification system | Not Started | | User notification and approval |
| 16.7 | Permission handling flow | Not Started | | Screen recording permissions |
| 16.8 | Visual recording indicators | Not Started | | Menu bar and dock status |
| 16.9 | Integration with existing UI | Not Started | | Update RecorderService |
| 16.10 | Testing with meeting platforms | Not Started | | Zoom, Teams, Meet validation |

## Progress Log
### 2025-05-23
- Task created for meeting recording foundation
- Analyzed technical requirements for system audio capture
- Defined dual-channel recording approach
- Planned integration with existing RecorderService
- **Planning Session Completed**: Comprehensive plan developed with user requirements
  - Established conservative detection strategy (75%+ confidence)
  - Defined privacy-first architecture with application filtering
  - Planned macOS system notification integration
  - Designed dual-channel audio pipeline with WebM/Opus format
  - Created detailed 12-day implementation roadmap

## Technical Notes

### Privacy Implementation Details
- **Blacklisted App Categories**: Banking apps, password managers, medical software
- **Content Detection**: Monitor for password fields, financial forms, sensitive data entry
- **Audio Encryption**: AES-256 encryption for in-memory audio buffers
- **Visual Indicators**: Red recording dot in menu bar, dock badge, notification center status
- **Data Retention**: Configurable auto-deletion after 30/90/365 days

### Meeting Detection Criteria
- **Minimum Duration**: 30 seconds of sustained conversation
- **Speaker Detection**: Multiple speakers with back-and-forth patterns
- **Frequency Analysis**: Human speech range (300-3000 Hz)
- **Confidence Threshold**: 75% minimum to trigger notification
- **Exclusion Patterns**: Single-direction audio, music, system sounds

### System Notification Design
```
🎙️ VoiceMCP: Potential Meeting Detected
"Zoom Meeting" appears to have an active conversation.
Would you like to record this meeting?

[Start Recording] [Dismiss] [Settings]
```

### Audio Architecture
- **Input Sources**: ScreenCaptureKit (system) + MediaRecorder (microphone)
- **Processing**: Real-time privacy filtering and pattern analysis
- **Output Format**: WebM/Opus, dual-channel (L: system, R: microphone)
- **Synchronization**: Timestamp-based alignment with drift compensation
- **Quality**: 128kbps bitrate matching existing microphone settings
