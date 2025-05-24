# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Changelog system with automated workflow

## [0.1.0] - 2025-05-23

### Added
- Complete Electron application setup with React and TypeScript
- Voice recording functionality with real-time audio visualization
- Audio level monitoring during recording
- Recording file storage with organized structure (~/Documents/VoiceMCP/)
- Recordings list UI with collapsible sidebar
- Recording deletion functionality
- Local Whisper AI transcription (multilingual small model)
- OpenAI integration with LangChain for AI processing
- AI-powered summary generation for recordings
- Streaming AI responses with progress indicators
- Python environment setup with uv package manager
- Production build system with DMG creation
- Service container architecture with dependency injection
- Type-safe event system with IPC bridge
- Window management with state persistence
- Recording playback controls
- Transcript viewer with word-level timestamps
- AI summary viewer component
- Real-time updates when new recordings are created
- Recording metadata display (duration, date, file size)
- Date-based grouping in recordings list
- Settings window for configuration

### Fixed
- Webpack build errors with HTML generation conflict
- Recording functionality integration between UI and backend
- TypeScript issues with IPC type definitions
- Timezone display bug in recording timestamps
- Audio visualization rendering issues
- Memory leaks in audio processing

### Technical
- Built on Electron with React frontend
- Node.js backend with SQLite database
- Web Audio API for recording and processing
- MediaRecorder API for audio capture
- Python workers for AI processing
- Webpack configuration with multiple targets
- CSS Modules for component styling
- IPC communication between renderer and main processes

## Development History

### Project Setup (May 19-22, 2025)
- [TASK001] Initial project structure and configuration
- [TASK002] Project initialization with package management
- [TASK003] Electron application framework setup
- [TASK004] Build system configuration with Webpack
- [TASK005] Basic application structure with React integration

### Core Features (May 22-23, 2025)
- [TASK006] Voice recording functionality implementation
- [TASK007] Recordings list UI with sidebar navigation
- [TASK008] Whisper transcription integration
- [TASK009] OpenAI integration with LangChain
- [TASK010] AI summary button with progress indicators

### Recent Enhancements (May 23, 2025)
- [TASK013] Updated recording list UI with AI-generated titles - Completed on 2025-05-23
- [TASK019] Fixed timezone bug in timestamp display - Completed on 2025-05-23  
- [TASK012] Improved transcription progress with time-based estimation and smooth progress indicators - Completed on 2025-05-23

### Pending Features
- [TASK011] Concurrent transcriptions support
- [TASK014] External recording import functionality
- [TASK015] Cloud-based OpenAI speech-to-text option
- [TASK016] System audio capture with meeting detection
- [TASK017] System tray integration for background operation
- [TASK018] Calendar integration for meeting prediction

---

## Release Notes

### v0.1.0 - Initial Release
This is the first functional release of VoiceMCP, featuring:
- Complete voice recording and transcription workflow
- AI-powered summary generation
- Local processing with Whisper AI
- Organized storage and retrieval system
- Production-ready Electron application

The application successfully records voice memos, transcribes them using local AI models, and provides intelligent summaries for easy reference and organization.
