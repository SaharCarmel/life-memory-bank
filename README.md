# VoiceMCP

A macOS desktop application for recording voice memos with automatic transcription using Whisper AI and MCP integration. Record, transcribe, and query your voice recordings with support for both Hebrew and English languages.

## Features

- 🎙️ Clean, minimalist interface for voice recording
- 🤖 Automatic transcription using Whisper AI
- 🌐 Support for Hebrew and English languages
- 🔍 Full-text search across transcripts
- 🏷️ Tag-based organization system
- 📊 MCP integration for external access
- 💾 Local storage with SQLite
- 📱 Native macOS experience

## Prerequisites

- Node.js v20.x or later
- Git
- macOS operating system

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/voice-mcp.git
   cd voice-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## Development

### Project Structure

```
voice-mcp/
├── src/
│   ├── main/           # Electron main process
│   │   ├── audio/      # Audio recording functionality
│   │   ├── whisper/    # Whisper integration
│   │   ├── storage/    # Database & file management
│   │   └── mcp/        # MCP server implementation
│   ├── renderer/       # Electron renderer process
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom React hooks
│   │   └── styles/     # CSS/SCSS styles
│   └── shared/         # Shared types and utilities
├── models/             # Whisper model storage
├── assets/            # Application assets
└── tests/             # Test files
```

### Available Scripts

- `npm start` - Start the application in development mode
- `npm run debug` - Start the application with remote debugging enabled
- `npm run package` - Package the application for distribution
- `npm run make` - Create platform-specific distributables
- `npm test` - Run the test suite
- `npm run lint` - Run ESLint checks
- `npm run format` - Format code with Prettier

### Debugging

VoiceMCP is configured for remote debugging using Chrome DevTools, providing a powerful way to inspect, debug, and profile the application.

#### Starting in Debug Mode

```bash
# Start the app with remote debugging enabled
npm run debug
```

#### Connecting with Chrome DevTools

1. Launch Chrome/Chromium browser
2. Navigate to `chrome://inspect`
3. Under "Remote Target", find your Electron app
4. Click "inspect" to open the DevTools connected to your app

#### What You Can Debug

- **DOM/UI**: Inspect and modify the renderer process HTML/CSS
- **JavaScript**: Set breakpoints, watch variables, and step through code
- **Network**: Monitor HTTP requests and WebSocket connections
- **Performance**: Profile CPU usage and identify bottlenecks
- **Memory**: Take heap snapshots to find memory leaks
- **Console**: Execute JavaScript in the context of the app

#### Tips for Effective Debugging

- Use named functions instead of anonymous ones for better stack traces
- Add source maps for easier debugging of transpiled TypeScript
- Leverage conditional breakpoints for complex scenarios
- Use the "Elements" tab to debug UI issues
- Check the "Application" tab to inspect storage

### Technology Stack

- **Framework**: Electron
- **Language**: TypeScript
- **Transcription**: Whisper AI (small multilingual model)
- **Database**: SQLite
- **Build System**: Electron Forge with Webpack
- **Testing**: Jest

## MCP Integration

VoiceMCP provides an MCP server that exposes tools and resources for accessing recordings and transcripts:

### Tools
- Get transcript by recording ID
- Search across transcripts
- Generate summaries
- Query recordings by metadata

### Resources
- Access to recordings
- Transcript data
- Recording metadata
- Search results

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow the established code style
- Use conventional commits

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [OpenAI Whisper](https://github.com/openai/whisper) for transcription capabilities
- [Electron](https://www.electronjs.org/) for the application framework
- [Model Context Protocol](https://github.com/modelcontextprotocol) for MCP implementation

## Support

For support, please open an issue in the GitHub repository.
