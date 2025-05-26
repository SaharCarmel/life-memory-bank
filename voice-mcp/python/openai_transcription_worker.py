#!/usr/bin/env python3
"""
OpenAI Transcription Worker with File Truncation

This worker handles transcription using OpenAI's Speech-to-Text API (Whisper).
For files larger than 25MB, it simply truncates them to 24MB to fit within OpenAI's limits.

Usage:
    python openai_transcription_worker.py audio_file.webm 
    [--output output.json] [--api-key key] [--model whisper-1]

Output format (JSON):
    - progress: {"type": "progress", "progress": 0-100, "message": "..."}
    - result: {"type": "result", "text": "...", "language": "...", 
               "segments": [...]}
    - error: {"type": "error", "error": "...", "details": "..."}
"""

import sys
import json
import os
import argparse
import tempfile
import shutil
import traceback
from pathlib import Path
from typing import Dict, Any, List, Optional

def log_debug(message: str):
    """Log debug message to stderr for debugging"""
    print(f"[DEBUG] {message}", file=sys.stderr, flush=True)

# Log startup
log_debug("OpenAI transcription worker starting...")

try:
    from openai import OpenAI
    import openai
    log_debug("OpenAI imports successful")
except ImportError as e:
    log_debug(f"OpenAI import failed: {e}")
    error_msg = {"type": "error", "error": "OpenAI package not installed"}
    print(json.dumps(error_msg))
    sys.exit(1)

try:
    from pydub import AudioSegment
    from pydub.utils import which
    log_debug("PyDub imports successful")
except ImportError as e:
    log_debug(f"PyDub import failed: {e}")
    error_msg = {"type": "error", "error": "PyDub package not installed. Install with: pip install pydub"}
    print(json.dumps(error_msg))
    sys.exit(1)

# Constants
COST_PER_MINUTE = 0.006  # $0.006 per minute as of 2025
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB limit
TARGET_FILE_SIZE = 24 * 1024 * 1024  # 24MB target to stay safely under limit

log_debug(f"Constants loaded: MAX_FILE_SIZE={MAX_FILE_SIZE}, TARGET_FILE_SIZE={TARGET_FILE_SIZE}")


def emit_progress(progress: int, message: str = ""):
    """Emit progress update to stdout"""
    output = {"type": "progress", "progress": progress, "message": message}
    print(json.dumps(output), flush=True)
    log_debug(f"Progress {progress}%: {message}")


def emit_result(text: str, language: str, segments: List[Dict]):
    """Emit successful transcription result"""
    output = {
        "type": "result",
        "text": text,
        "language": language,
        "segments": segments
    }
    print(json.dumps(output), flush=True)
    log_debug(f"Result emitted: {len(text)} chars, {len(segments)} segments, language: {language}")


def emit_error(error: str, details: str = ""):
    """Emit error message"""
    output = {"type": "error", "error": error, "details": details}
    print(json.dumps(output), flush=True)
    log_debug(f"Error emitted: {error} | Details: {details}")


def get_file_size(filepath: str) -> int:
    """Get file size in bytes"""
    try:
        size = os.path.getsize(filepath)
        log_debug(f"File size: {size} bytes ({size / (1024*1024):.1f}MB)")
        return size
    except OSError as e:
        log_debug(f"Failed to get file size: {e}")
        raise ValueError(f"Cannot access file: {e}")


def estimate_audio_duration(filepath: str) -> float:
    """Estimate audio duration from file size"""
    try:
        file_size = get_file_size(filepath)
        # Rough estimate: WebM/Opus at 128kbps ≈ 16KB/s
        estimated_duration = file_size / (16 * 1024)
        duration = max(1.0, estimated_duration)  # Minimum 1 second
        log_debug(f"Estimated duration: {duration:.1f} seconds")
        return duration
    except Exception as e:
        log_debug(f"Failed to estimate duration: {e}")
        return 60.0  # Default to 1 minute if estimation fails


def calculate_estimated_cost(filepath: str) -> float:
    """Calculate estimated cost for transcription"""
    duration_seconds = estimate_audio_duration(filepath)
    duration_minutes = duration_seconds / 60.0
    cost = duration_minutes * COST_PER_MINUTE
    log_debug(f"Estimated cost: ${cost:.4f} ({duration_minutes:.1f} minutes)")
    return cost


def validate_file_basic(filepath: str) -> None:
    """Basic file validation (existence and format)"""
    log_debug(f"Validating file: {filepath}")
    
    if not os.path.exists(filepath):
        log_debug(f"File not found: {filepath}")
        raise ValueError(f"File not found: {filepath}")
    
    # Check file extension (OpenAI supports these formats)
    supported_extensions = {'.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm'}
    file_ext = Path(filepath).suffix.lower()
    log_debug(f"File extension: {file_ext}")
    
    if file_ext not in supported_extensions:
        log_debug(f"Unsupported format: {file_ext}")
        raise ValueError(f"Unsupported file format: {file_ext}. Supported: {', '.join(supported_extensions)}")
    
    log_debug("File validation passed")


def truncate_audio_file(filepath: str, target_size: int) -> str:
    """Truncate audio file to target size and return path to truncated file"""
    log_debug(f"Starting audio truncation: {filepath} -> {target_size} bytes")
    emit_progress(15, "Loading audio file for truncation...")
    
    # Load the audio file
    file_ext = Path(filepath).suffix.lower()
    log_debug(f"Loading audio file with extension: {file_ext}")
    
    try:
        if file_ext == '.webm':
            audio = AudioSegment.from_file(filepath, format="webm")
        elif file_ext == '.mp3':
            audio = AudioSegment.from_mp3(filepath)
        elif file_ext == '.wav':
            audio = AudioSegment.from_wav(filepath)
        elif file_ext == '.m4a':
            audio = AudioSegment.from_file(filepath, format="m4a")
        else:
            audio = AudioSegment.from_file(filepath)
        
        log_debug(f"Audio loaded successfully: {len(audio)}ms duration")
    except Exception as e:
        log_debug(f"Failed to load audio: {e}")
        log_debug(f"Traceback: {traceback.format_exc()}")
        raise
    
    emit_progress(25, "Calculating truncation point...")
    
    # Calculate how much audio to keep based on target file size
    original_size = get_file_size(filepath)
    size_ratio = target_size / original_size
    log_debug(f"Size ratio: {size_ratio:.3f} (target: {target_size}, original: {original_size})")
    
    # Truncate audio to the calculated duration
    original_duration = len(audio)
    target_duration = int(original_duration * size_ratio)
    log_debug(f"Duration: {original_duration}ms -> {target_duration}ms")
    
    emit_progress(35, f"Truncating to {target_duration/1000:.1f} seconds...")
    truncated_audio = audio[:target_duration]
    log_debug(f"Audio truncated to {len(truncated_audio)}ms")
    
    # Save truncated audio to temporary file
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
    temp_path = temp_file.name
    temp_file.close()
    log_debug(f"Created temp file: {temp_path}")
    
    emit_progress(45, "Saving truncated file...")
    try:
        truncated_audio.export(temp_path, format="mp3", bitrate="128k")
        log_debug("Audio export completed")
    except Exception as e:
        log_debug(f"Failed to export audio: {e}")
        log_debug(f"Traceback: {traceback.format_exc()}")
        raise
    
    # Verify the truncated file size
    truncated_size = get_file_size(temp_path)
    emit_progress(50, f"Truncated file size: {truncated_size/(1024*1024):.1f}MB")
    log_debug(f"Truncation completed: {temp_path} ({truncated_size} bytes)")
    
    return temp_path


def create_openai_client(api_key: Optional[str] = None) -> OpenAI:
    """Create OpenAI client with API key"""
    log_debug("Creating OpenAI client...")
    
    # Try to get API key from parameter, environment, or fail
    if not api_key:
        api_key = os.getenv('OPENAI_API_KEY')
        log_debug("Using API key from environment")
    else:
        log_debug("Using API key from parameter")
    
    if not api_key:
        log_debug("No OpenAI API key found")
        raise ValueError("OpenAI API key not provided. Set OPENAI_API_KEY environment variable or pass --api-key")
    
    # Don't log the full API key for security
    log_debug(f"API key found: {api_key[:10]}...")
    
    try:
        client = OpenAI(api_key=api_key)
        log_debug("OpenAI client created successfully")
        return client
    except Exception as e:
        log_debug(f"Failed to create OpenAI client: {e}")
        raise


def convert_segments_format(openai_segments: List[Any]) -> List[Dict]:
    """Convert OpenAI segment format to match local Whisper format
    
    OpenAI returns TranscriptionSegment objects (Pydantic models), not dicts,
    so we need to access attributes directly instead of using .get()
    """
    log_debug(f"Converting {len(openai_segments)} segments")
    
    segments = []
    for segment in openai_segments:
        try:
            converted = {
                "id": getattr(segment, "id", 0),
                "seek": getattr(segment, "seek", 0),
                "start": getattr(segment, "start", 0.0),
                "end": getattr(segment, "end", 0.0),
                "text": getattr(segment, "text", ""),
                "tokens": getattr(segment, "tokens", []),
                "temperature": getattr(segment, "temperature", 0.0),
                "avg_logprob": getattr(segment, "avg_logprob", 0.0),
                "compression_ratio": getattr(segment, "compression_ratio", 0.0),
                "no_speech_prob": getattr(segment, "no_speech_prob", 0.0)
            }
            segments.append(converted)
            log_debug(f"Converted segment {converted['id']}: {converted['start']:.1f}s-{converted['end']:.1f}s")
        except Exception as e:
            log_debug(f"Failed to convert segment: {e}")
            # Skip problematic segments rather than failing completely
            continue
    
    log_debug(f"Converted {len(segments)} segments successfully")
    return segments


def transcribe_with_openai(
    filepath: str,
    client: OpenAI,
    model: str = "whisper-1",
    language: Optional[str] = None
) -> Dict[str, Any]:
    """Transcribe audio file using OpenAI API, truncating if necessary"""
    
    log_debug(f"Starting transcription: {filepath}")
    
    emit_progress(5, "Validating file...")
    validate_file_basic(filepath)
    
    emit_progress(10, "Checking file size...")
    file_size = get_file_size(filepath)
    
    # Determine which file to use for transcription
    transcription_file = filepath
    temp_file_to_cleanup = None
    
    if file_size > MAX_FILE_SIZE:
        size_mb = file_size / (1024 * 1024)
        emit_progress(12, f"File too large ({size_mb:.1f}MB), truncating to 24MB...")
        log_debug(f"File too large ({size_mb:.1f}MB), starting truncation")
        
        try:
            transcription_file = truncate_audio_file(filepath, TARGET_FILE_SIZE)
            temp_file_to_cleanup = transcription_file
            log_debug(f"Truncation completed: {transcription_file}")
        except Exception as e:
            log_debug(f"Truncation failed: {e}")
            raise ValueError(f"Failed to truncate audio file: {e}")
    else:
        emit_progress(15, "File size OK, processing normally...")
        log_debug("File size within limits, proceeding normally")
    
    try:
        # Calculate estimated cost
        emit_progress(55, "Calculating estimated cost...")
        estimated_cost = calculate_estimated_cost(transcription_file)
        emit_progress(60, f"Estimated cost: ${estimated_cost:.4f}")
        
        emit_progress(65, "Uploading file to OpenAI...")
        log_debug(f"Opening file for OpenAI: {transcription_file}")
        
        with open(transcription_file, "rb") as audio_file:
            log_debug("File opened successfully")
            
            # Create transcription request
            transcription_args = {
                "file": audio_file,
                "model": model,
                "response_format": "verbose_json",  # Get detailed response with segments
                "temperature": 0  # Deterministic output
            }
            
            # Add language if specified
            if language:
                transcription_args["language"] = language
                log_debug(f"Using language: {language}")
            
            emit_progress(75, "Processing transcription...")
            log_debug(f"Making OpenAI API call with model: {model}")
            
            # Make API call
            try:
                transcript = client.audio.transcriptions.create(**transcription_args)
                log_debug("OpenAI API call completed successfully")
            except Exception as e:
                log_debug(f"OpenAI API call failed: {e}")
                log_debug(f"Traceback: {traceback.format_exc()}")
                raise
            
            emit_progress(90, "Processing response...")
            
            # Extract data from response
            text = transcript.text
            detected_language = getattr(transcript, 'language', language or 'unknown')
            log_debug(f"Transcription result: {len(text)} chars, language: {detected_language}")
            
            # Convert segments if available
            segments = []
            if hasattr(transcript, 'segments') and transcript.segments:
                log_debug(f"Found {len(transcript.segments)} segments in response")
                segments = convert_segments_format(transcript.segments)
                log_debug(f"Extracted {len(segments)} segments")
            else:
                log_debug("No segments in response")
            
            emit_progress(100, "Transcription completed")
            log_debug("Transcription completed successfully")
            
            return {
                "text": text,
                "language": detected_language,
                "segments": segments
            }
            
    except openai.AuthenticationError as e:
        log_debug(f"OpenAI authentication error: {e}")
        raise ValueError(f"Authentication failed: {e}")
    except openai.RateLimitError as e:
        log_debug(f"OpenAI rate limit error: {e}")
        raise ValueError(f"Rate limit exceeded: {e}")
    except openai.BadRequestError as e:
        log_debug(f"OpenAI bad request error: {e}")
        raise ValueError(f"Bad request: {e}")
    except openai.APIError as e:
        log_debug(f"OpenAI API error: {e}")
        raise ValueError(f"OpenAI API error: {e}")
    except Exception as e:
        log_debug(f"Unexpected error in transcription: {e}")
        log_debug(f"Traceback: {traceback.format_exc()}")
        raise ValueError(f"Transcription failed: {e}")
    
    finally:
        # Clean up temporary file if we created one
        if temp_file_to_cleanup and os.path.exists(temp_file_to_cleanup):
            try:
                log_debug(f"Cleaning up temp file: {temp_file_to_cleanup}")
                os.unlink(temp_file_to_cleanup)
                log_debug("Temp file cleaned up successfully")
            except Exception as e:
                log_debug(f"Failed to clean up temp file: {e}")


def save_output(result: Dict[str, Any], output_path: Optional[str]) -> None:
    """Save transcription result to file if output path specified"""
    if output_path:
        try:
            log_debug(f"Saving output to: {output_path}")
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            log_debug("Output saved successfully")
        except Exception as e:
            log_debug(f"Failed to save output: {e}")
            emit_error(f"Failed to save output file: {e}")


def main():
    """Main transcription worker function"""
    log_debug("Main function starting")
    
    parser = argparse.ArgumentParser(description='OpenAI Transcription Worker with File Truncation')
    parser.add_argument('audio_file', help='Path to audio file to transcribe')
    parser.add_argument('--output', '-o', help='Output file path for transcription result')
    parser.add_argument('--api-key', help='OpenAI API key (or set OPENAI_API_KEY env var)')
    parser.add_argument('--model', default='whisper-1', help='OpenAI model to use (default: whisper-1)')
    parser.add_argument('--language', help='Language code (e.g., "en", "es", "fr") for language-specific processing')
    
    try:
        args = parser.parse_args()
        log_debug(f"Arguments parsed: audio_file={args.audio_file}, model={args.model}, language={args.language}")
    except Exception as e:
        log_debug(f"Failed to parse arguments: {e}")
        raise
    
    try:
        emit_progress(0, "Starting OpenAI transcription...")
        
        # Create OpenAI client
        emit_progress(2, "Initializing OpenAI client...")
        client = create_openai_client(args.api_key)
        
        # Perform transcription (with truncation if needed)
        log_debug("Starting transcription process")
        result = transcribe_with_openai(
            args.audio_file,
            client,
            model=args.model,
            language=args.language
        )
        
        # Save output file if requested
        if args.output:
            save_output(result, args.output)
        
        # Emit final result
        log_debug("Emitting final result")
        emit_result(result["text"], result["language"], result["segments"])
        log_debug("OpenAI transcription worker completed successfully")
        
    except ValueError as e:
        log_debug(f"ValueError in main: {e}")
        emit_error(str(e))
        sys.exit(1)
    except KeyboardInterrupt:
        log_debug("Transcription cancelled by user")
        emit_error("Transcription cancelled by user")
        sys.exit(1)
    except Exception as e:
        log_debug(f"Unexpected error in main: {e}")
        log_debug(f"Traceback: {traceback.format_exc()}")
        emit_error(f"Unexpected error: {e}", str(type(e).__name__))
        sys.exit(1)


if __name__ == "__main__":
    log_debug("Script starting as main module")
    main()
