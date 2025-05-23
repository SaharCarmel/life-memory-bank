# [TASK015] - OpenAI Speech-to-Text Integration

**Status:** Pending  
**Added:** 2025-05-23  
**Updated:** 2025-05-23

## Original Request
Enable transcription using OpenAI's Speech-to-Text API as an alternative to local Whisper processing.

## Thought Process
Since VoiceMCP already has OpenAI integration for AI summaries, we can leverage the same API configuration to offer cloud-based transcription. This provides users with a choice between local Whisper processing and OpenAI's hosted Whisper API.

**Benefits of OpenAI Speech-to-Text:**
- Faster processing (no local model loading time)
- No GPU/CPU requirements on user's machine
- Potentially better accuracy with latest models
- Supports multiple languages and formats

**Considerations:**
- Requires internet connection
- API costs ($0.006 per minute of audio)
- 25MB file size limit per request
- Privacy concerns (audio sent to OpenAI)
- Need to handle API rate limits and errors

**Implementation approach:**
1. Create OpenAITranscriptionService alongside existing WhisperService
2. Add transcription provider selection in settings
3. Update UI to show which service is being used
4. Implement proper error handling for API failures
5. Show cost estimates before transcription

## Implementation Plan
- [ ] Create OpenAITranscriptionService class
- [ ] Add transcription provider setting (Local Whisper vs OpenAI)
- [ ] Update transcription handlers to route to appropriate service
- [ ] Add file size validation for OpenAI limits
- [ ] Implement cost estimation and display
- [ ] Add different progress indication for API calls
- [ ] Update UI to show transcription method
- [ ] Add error handling for API failures and rate limits
- [ ] Test with various audio formats and sizes

## Progress Tracking

**Overall Status:** Not Started - 0%

### Subtasks
| ID | Description | Status | Updated | Notes |
|----|-------------|--------|---------|-------|
| 15.1 | Create OpenAITranscriptionService | Not Started | | New service class for API calls |
| 15.2 | Add provider selection setting | Not Started | | Local vs OpenAI choice |
| 15.3 | Update transcription routing logic | Not Started | | Route to correct service |
| 15.4 | Add file size validation | Not Started | | Check 25MB limit for OpenAI |
| 15.5 | Implement cost estimation | Not Started | | Show estimated cost before transcription |
| 15.6 | Add API progress indication | Not Started | | Different UI for upload/processing |
| 15.7 | Update UI with provider indicators | Not Started | | Show which service was used |
| 15.8 | Add comprehensive error handling | Not Started | | API failures, rate limits, etc. |
| 15.9 | Test API integration | Not Started | | Verify with OpenAI API |

## Progress Log
### 2025-05-23
- Task created
- Analyzed OpenAI Speech-to-Text API requirements
- Defined implementation approach leveraging existing OpenAI setup
- Referenced API documentation: https://platform.openai.com/docs/guides/speech-to-text
