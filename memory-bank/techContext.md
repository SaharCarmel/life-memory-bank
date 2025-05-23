# Technical Context

## Development Environment

### Core Technologies
- **Node.js**: v20.x or later
- **Electron**: v28.x or later
- **TypeScript**: v5.x
- **SQLite**: v3.x
- **Whisper**: Small multilingual model (244M parameters)

### Development Tools
- **Package Manager**: npm/yarn
- **Build System**: electron-builder
- **Testing Framework**: Jest
- **Code Quality**:
  - ESLint
  - Prettier
  - TypeScript strict mode
  - Husky for git hooks

### IDE Configuration
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Project Structure

```
voice-mcp/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── audio/           # Audio recording & processing
│   │   ├── whisper/         # Whisper integration
│   │   ├── storage/         # Database & file management
│   │   └── mcp/             # MCP server implementation
│   ├── renderer/            # Electron renderer process
│   │   ├── components/      # React components
│   │   ├── hooks/          # Custom React hooks
│   │   └── styles/         # CSS/SCSS styles
│   └── shared/             # Shared types and utilities
├── mcp-server/             # MCP server implementation
├── electron-builder.json   # Electron build configuration
├── package.json           # Project dependencies
└── tsconfig.json         # TypeScript configuration
```

## Dependencies

### Production Dependencies
```json
{
  "dependencies": {
    "electron": "^28.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "sqlite3": "^5.1.6",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "web-audio-api": "^0.2.2",
    "node-whisper": "^0.1.0",
    "typescript": "^5.0.0"
  }
}
```

### Development Dependencies
```json
{
  "devDependencies": {
    "electron-builder": "^24.0.0",
    "jest": "^29.0.0",
    "@types/react": "^18.2.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "husky": "^8.0.0"
  }
}
```

## Whisper Integration

### Model Configuration
```typescript
interface WhisperConfig {
  modelPath: string;
  modelType: "small";
  language: "auto" | "en" | "he";
  device: "cpu" | "cuda";
  computeType: "float32" | "float16";
}

const defaultConfig: WhisperConfig = {
  modelPath: "./models/whisper-small-multilingual",
  modelType: "small",
  language: "auto",
  device: "cpu",
  computeType: "float32"
};
```

### Audio Processing Pipeline
```typescript
interface AudioConfig {
  sampleRate: 16000;
  channels: 1;
  format: "wav";
  bitDepth: 16;
}

interface ProcessingPipeline {
  preprocess: (audio: Buffer) => Promise<Buffer>;
  transcribe: (audio: Buffer) => Promise<Transcript>;
  postprocess: (transcript: Transcript) => Promise<ProcessedTranscript>;
}
```

## Database Schema

### Recordings Table
```sql
CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  duration INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  language TEXT,
  transcript_path TEXT,
  processed BOOLEAN DEFAULT FALSE,
  metadata JSON
);
```

### Tags Table
```sql
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Recording Tags Table
```sql
CREATE TABLE recording_tags (
  recording_id TEXT,
  tag_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recording_id, tag_id),
  FOREIGN KEY (recording_id) REFERENCES recordings(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
```

## MCP Server Configuration

### Server Setup
```typescript
interface MCPServerConfig {
  name: "voice-memory";
  version: "1.0.0";
  capabilities: {
    tools: true;
    resources: true;
  };
}
```

### Tool Definitions
```typescript
interface ToolDefinitions {
  "get_transcript": {
    description: string;
    inputSchema: JSONSchema;
    handler: (args: any) => Promise<any>;
  };
  "get_summary": {
    description: string;
    inputSchema: JSONSchema;
    handler: (args: any) => Promise<any>;
  };
  "query_recordings": {
    description: string;
    inputSchema: JSONSchema;
    handler: (args: any) => Promise<any>;
  };
}
```

## Build & Deployment

### Build Configuration
```json
{
  "appId": "com.voicemcp.app",
  "productName": "VoiceMCP",
  "directories": {
    "output": "dist"
  },
  "files": [
    "build/**/*",
    "node_modules/**/*"
  ],
  "mac": {
    "category": "public.app-category.productivity"
  }
}
```

### Development Scripts
```json
{
  "scripts": {
    "start": "electron .",
    "build": "tsc && electron-builder",
    "test": "jest",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "prepare": "husky install"
  }
}
```

## Testing Strategy

### Unit Tests
- Component testing with React Testing Library
- Business logic testing with Jest
- MCP tool testing with mock data

### Integration Tests
- End-to-end recording flow
- Transcription pipeline testing
- MCP server integration testing

### Performance Tests
- Audio processing benchmarks
- Transcription speed measurements
- Search performance testing

## Security Considerations

### Data Protection
- Local file encryption
- Secure storage of sensitive data
- Access control for MCP resources

### Error Handling
- Graceful degradation
- User-friendly error messages
- Automatic error recovery where possible

## Development Workflow

### Git Workflow
1. Feature branches from main
2. Pull request review required
3. Automated testing on PR
4. Squash merge to main

### Code Quality
- ESLint rules enforcement
- Prettier formatting
- TypeScript strict mode
- Pre-commit hooks for linting and testing

### Documentation
- TSDoc for API documentation
- README.md for setup instructions
- CONTRIBUTING.md for development guidelines
- CHANGELOG.md for version history

## Debugging

### Electron Remote Debugging

#### Configuration
- **Enable Remote Debugging Port**:
  ```typescript
  // In main process
  app.commandLine.appendSwitch('remote-debugging-port', '9222');
  ```
  
- **Start with Debug Flag**:
  ```bash
  # Alternative approach using command line
  electron . --remote-debugging-port=9222
  ```

- **Package.json Script**:
  ```json
  "scripts": {
    "start": "electron .",
    "debug": "electron . --remote-debugging-port=9222"
  }
  ```

#### Connecting with Chrome DevTools
1. Start the Electron app with debugging enabled
2. Open Chrome/Chromium browser
3. Navigate to `chrome://inspect`
4. Find your Electron app under "Remote Target"
5. Click "inspect" to open DevTools

#### Debugging Capabilities
- **DOM Inspection**: Examine and modify the DOM tree
- **JavaScript Debugging**: 
  - Set breakpoints
  - Step through code execution
  - Inspect variables and scope
  - Evaluate expressions in console
- **Network Monitoring**: Track network requests and responses
- **Performance Profiling**: Analyze performance bottlenecks
- **Memory Analysis**: Detect memory leaks and usage patterns

#### Best Practices
- Enable source maps for easier debugging of transpiled code
- Use named functions instead of anonymous ones for better stack traces
- Add debug logging that can be conditionally enabled
- For renderer process debugging, use contextIsolation: false during development
- Create dedicated debug builds with extended logging

#### Common Debugging Scenarios
- **IPC Communication**: Monitor main-renderer communication
- **Renderer Performance**: Identify UI bottlenecks
- **Event Handling**: Debug event propagation issues
- **Memory Management**: Locate memory leaks with heap snapshots

This technical context provides a comprehensive overview of the development environment, tools, and configurations needed to build and maintain the Voice MCP application.
