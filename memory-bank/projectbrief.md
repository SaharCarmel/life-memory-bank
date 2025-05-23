# Voice MCP Project Brief

## Project Overview
A macOS desktop application for recording voice memos with automatic transcription using Whisper AI and MCP integration for accessing and querying transcripts. The application will support both Hebrew and English languages, providing a seamless way to record, transcribe, and later reference voice recordings.

## Core Requirements

### Recording Functionality
- Clean, minimalist interface for voice recording
- Basic playback controls (play, pause, seek)
- Audio visualization during recording
- Support for long-form recordings
- Automatic file management and organization

### Transcription Engine
- Integration with OpenAI's Whisper for transcription
- Using "small" multilingual model (244M parameters)
- Automatic language detection for Hebrew and English
- Word-level timestamp support
- High accuracy transcription with minimal latency

### Storage & Organization
- SQLite database for metadata and transcript storage
- Efficient file system organization for audio files
- Tag-based organization system
- Automatic date-based categorization
- Full-text search capabilities

### MCP Integration
- Custom MCP server for external access to recordings
- Tools for transcript retrieval and querying
- Resource endpoints for accessing recordings
- Support for various transcript formats (text, JSON, SRT)
- Search and filtering capabilities

## Technical Specifications

### Application Stack
- **Frontend**: Electron for desktop application
- **Backend**: Node.js for application logic
- **Database**: SQLite for data persistence
- **Transcription**: Whisper AI (small multilingual model)
- **MCP Server**: TypeScript implementation
- **Audio Processing**: Web Audio API

### Key Features
1. Voice Recording
   - High-quality audio capture
   - Real-time audio visualization
   - Recording pause/resume support
   - Automatic silence detection

2. Transcription
   - Automatic language detection
   - Support for Hebrew and English
   - Word-level timestamps
   - Confidence scores for transcriptions

3. Organization
   - Tag-based organization
   - Date-based automatic categorization
   - Full-text search across transcripts
   - Custom metadata support

4. MCP Tools & Resources
   - Transcript retrieval
   - Content searching
   - Metadata access
   - Summary generation

### Performance Requirements
- Fast application startup time
- Responsive recording interface
- Efficient transcription processing
- Quick search and retrieval
- Minimal resource usage when idle

### Security Considerations
- Secure storage of recordings and transcripts
- Local-only processing (no cloud dependencies)
- Data integrity protection
- Proper error handling and recovery

## Success Criteria
1. Successful voice recording with high audio quality
2. Accurate transcription in both Hebrew and English
3. Efficient organization and retrieval system
4. Functional MCP integration for external access
5. Responsive and intuitive user interface
6. Reliable performance with minimal resource usage

## Constraints
- Local processing only (no cloud dependencies)
- macOS compatibility required
- Memory and storage optimization for large recordings
- Support for both Hebrew and English text rendering

## Future Considerations
1. Support for additional languages
2. Advanced audio processing features
3. Enhanced search capabilities
4. Integration with other note-taking systems
5. Export functionality for various formats
6. Backup and sync capabilities

This project brief serves as the foundation for developing a powerful voice recording and transcription tool that leverages modern AI capabilities while maintaining a simple and efficient user experience.
