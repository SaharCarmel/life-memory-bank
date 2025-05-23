#!/usr/bin/env python3
"""
Whisper transcription worker for VoiceMCP.
Communicates with Node.js via JSON messages over stdout/stderr.
"""

import sys
import json
import argparse
import traceback
import os
import warnings
from pathlib import Path
from typing import Dict, Any, Optional

# Suppress warnings and redirect whisper output to stderr
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

try:
    import whisper
    import torch
    import numpy as np
except ImportError as e:
    print(json.dumps({
        "type": "error",
        "error": f"Missing dependency: {e}. Please ensure all dependencies are installed."
    }), flush=True)
    sys.exit(1)


def emit_message(message_type: str, **kwargs) -> None:
    """Send a JSON message to the parent process via stdout."""
    message = {
        "type": message_type,
        **kwargs
    }
    print(json.dumps(message), flush=True)


def emit_progress(progress: int, message: str = "") -> None:
    """Send progress update to parent process."""
    emit_message("progress", progress=progress, message=message)


def emit_error(error: str, details: Optional[str] = None) -> None:
    """Send error message to parent process."""
    emit_message("error", error=error, details=details)


def emit_result(text: str, language: str, segments: list) -> None:
    """Send transcription result to parent process."""
    emit_message("result", text=text, language=language, segments=segments)


def load_model(model_name: str = "turbo") -> whisper.Whisper:
    """Load the Whisper model."""
    try:
        emit_progress(5, f"Loading Whisper model: {model_name}")
        
        # Check if CUDA is available, but prefer CPU for consistency
        device = "cpu"
        if torch.cuda.is_available():
            emit_progress(10, "CUDA detected, but using CPU for stability")
        
        model = whisper.load_model(model_name, device=device)
        emit_progress(20, f"Model loaded successfully on {device}")
        
        return model
    except Exception as e:
        emit_error(f"Failed to load model: {str(e)}", traceback.format_exc())
        raise


def transcribe_audio(model: whisper.Whisper, audio_path: str) -> Dict[str, Any]:
    """Transcribe audio file using Whisper."""
    try:
        emit_progress(25, "Loading audio file...")
        
        # Verify file exists
        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        emit_progress(30, "Starting transcription...")
        
        # Transcribe with auto language detection
        result = model.transcribe(
            audio_path,
            language=None,  # Auto-detect language
            verbose=False,
            word_timestamps=False,  # Keep it simple for now
            fp16=False  # Use fp32 for CPU compatibility
        )
        
        emit_progress(85, "Processing transcription results...")
        
        # Extract segments with timestamps
        segments = []
        if "segments" in result:
            for segment in result["segments"]:
                segments.append({
                    "start": float(segment.get("start", 0)),
                    "end": float(segment.get("end", 0)),
                    "text": segment.get("text", "").strip()
                })
        
        emit_progress(95, "Transcription complete")
        
        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language", "unknown"),
            "segments": segments
        }
        
    except Exception as e:
        emit_error(f"Transcription failed: {str(e)}", traceback.format_exc())
        raise


def main():
    """Main entry point for the whisper worker."""
    parser = argparse.ArgumentParser(description="Whisper transcription worker")
    parser.add_argument("audio_file", help="Path to audio file to transcribe")
    parser.add_argument("--model", default="turbo", help="Whisper model to use (default: turbo)")
    parser.add_argument("--output", help="Output file for transcript (optional)")
    
    args = parser.parse_args()
    
    try:
        emit_progress(0, "Starting transcription worker")
        
        # Load model
        model = load_model(args.model)
        
        # Transcribe audio
        result = transcribe_audio(model, args.audio_file)
        
        # Save to file if requested
        if args.output:
            emit_progress(98, "Saving transcript to file...")
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        # Send result
        emit_progress(100, "Complete")
        emit_result(
            text=result["text"],
            language=result["language"],
            segments=result["segments"]
        )
        
    except KeyboardInterrupt:
        emit_error("Transcription cancelled by user")
        sys.exit(1)
    except Exception as e:
        emit_error(f"Unexpected error: {str(e)}", traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
