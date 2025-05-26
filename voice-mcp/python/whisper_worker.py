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
import threading
import time
import signal
from pathlib import Path
from typing import Dict, Any, Optional

# Suppress warnings
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

try:
    import whisper
    import torch
except ImportError as e:
    print(json.dumps({
        "type": "error",
        "error": f"Missing dependency: {e}. Please ensure all dependencies are installed."
    }), flush=True)
    sys.exit(1)

# Processing speed factors by model (real-time multiplier)
PROCESSING_SPEED_FACTORS = {
    "tiny": 5.0,    # 5x real-time (fastest)
    "base": 3.0,    # 3x real-time
    "small": 2.0,   # 2x real-time
    "medium": 1.5,  # 1.5x real-time
    "large": 1.0,   # 1x real-time
    "turbo": 2.5    # 2.5x real-time (optimized)
}


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


def get_audio_duration(audio_path: str) -> float:
    """Get estimated duration of audio file in seconds."""
    try:
        file_size = os.path.getsize(audio_path)
        # Rough estimate: WebM/Opus at 128kbps = ~16KB/s
        estimated_duration = file_size / (16 * 1024)
        return max(estimated_duration, 1.0)  # At least 1 second
    except Exception:
        return 60.0  # Default to 1 minute if we can't determine


class ProgressReporter:
    """Thread-based progress reporter for time-based estimation."""
    
    def __init__(self, duration: float, model_name: str):
        self.duration = duration
        self.model_name = model_name
        self.start_time = time.time()
        self.stop_event = threading.Event()
        self.thread = None
        
        # Get processing speed factor
        self.speed_factor = PROCESSING_SPEED_FACTORS.get(model_name, 2.0)
        self.estimated_processing_time = duration / self.speed_factor
        
    def start(self):
        """Start the progress reporting thread."""
        self.thread = threading.Thread(target=self._report_progress)
        self.thread.daemon = True
        self.thread.start()
        
    def stop(self):
        """Stop the progress reporting thread."""
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=1.0)
            
    def _report_progress(self):
        """Report progress based on elapsed time."""
        while not self.stop_event.is_set():
            elapsed = time.time() - self.start_time
            
            # Calculate progress (30% to 85% range)
            if elapsed < self.estimated_processing_time:
                progress_ratio = elapsed / self.estimated_processing_time
                progress = 30 + int(progress_ratio * 55)  # Map to 30-85%
                
                remaining_time = self.estimated_processing_time - elapsed
                emit_progress(progress, f"Processing audio (est. {int(remaining_time)}s remaining)")
            else:
                # If we've exceeded estimated time, show 85% and keep waiting
                emit_progress(85, "Processing audio (finalizing...)")
                
            time.sleep(1.0)


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


def transcribe_audio(model: whisper.Whisper, audio_path: str, model_name: str = "turbo") -> Dict[str, Any]:
    """Transcribe audio file using Whisper with time-based progress estimation."""
    try:
        emit_progress(25, "Analyzing audio file...")
        
        # Verify file exists
        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        audio_duration = get_audio_duration(audio_path)
        speed_factor = PROCESSING_SPEED_FACTORS.get(model_name, 2.0)
        estimated_time = audio_duration / speed_factor
        
        emit_progress(30, f"Audio duration: {int(audio_duration)}s, estimated processing: {int(estimated_time)}s")
        
        # Start progress reporter
        progress_reporter = ProgressReporter(audio_duration, model_name)
        progress_reporter.start()
        
        try:
            # Transcribe with verbose=False to avoid output conflicts
            result = model.transcribe(
                audio_path,
                language=None,  # Auto-detect language
                verbose=False,  # Keep quiet to avoid JSON parsing issues
                word_timestamps=False,
                fp16=False
            )
        finally:
            # Stop progress reporter
            progress_reporter.stop()
        
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


# Global flag for graceful shutdown
shutdown_requested = False

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    global shutdown_requested
    shutdown_requested = True
    emit_error("Transcription cancelled by signal")
    sys.exit(1)

def main():
    """Main entry point for the whisper worker."""
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    parser = argparse.ArgumentParser(description="Whisper transcription worker")
    parser.add_argument("audio_file", help="Path to audio file to transcribe")
    parser.add_argument("--model", default="turbo", help="Whisper model to use (default: turbo)")
    parser.add_argument("--output", help="Output file for transcript (optional)")
    
    args = parser.parse_args()
    
    try:
        emit_progress(0, "Starting transcription worker")
        
        # Check for shutdown before loading model
        if shutdown_requested:
            return
            
        # Load model
        model = load_model(args.model)
        
        # Check for shutdown before transcription
        if shutdown_requested:
            return
            
        # Transcribe audio
        result = transcribe_audio(model, args.audio_file, args.model)
        
        # Check for shutdown before saving
        if shutdown_requested:
            return
        
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
