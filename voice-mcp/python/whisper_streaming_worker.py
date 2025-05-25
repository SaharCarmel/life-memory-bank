#!/usr/bin/env python3
"""
Whisper streaming transcription worker for real-time processing.
Optimized for fast chunk processing with persistent model loading.
"""

import sys
import json
import argparse
import traceback
import os
import warnings
import time
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

# Global model instance for persistent loading
LOADED_MODEL = None
LOADED_MODEL_NAME = None

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


def emit_result(text: str, language: str, segments: list, confidence: float = None) -> None:
    """Send transcription result to parent process."""
    emit_message("result", 
                text=text, 
                language=language, 
                segments=segments, 
                confidence=confidence)


def load_model_if_needed(model_name: str = "tiny") -> whisper.Whisper:
    """Load the Whisper model if not already loaded or if different model requested."""
    global LOADED_MODEL, LOADED_MODEL_NAME
    
    if LOADED_MODEL is None or LOADED_MODEL_NAME != model_name:
        try:
            emit_progress(10, f"Loading Whisper model: {model_name}")
            
            # Prefer CPU for real-time processing (more consistent)
            device = "cpu"
            if torch.cuda.is_available() and model_name in ["tiny", "base"]:
                # Only use GPU for small models to avoid memory issues
                device = "cuda"
            
            LOADED_MODEL = whisper.load_model(model_name, device=device)
            LOADED_MODEL_NAME = model_name
            
            emit_progress(20, f"Model {model_name} loaded on {device}")
            
        except Exception as e:
            emit_error(f"Failed to load model: {str(e)}", traceback.format_exc())
            raise
    
    return LOADED_MODEL


def calculate_confidence(result: Dict[str, Any]) -> float:
    """Calculate average confidence from segments."""
    if "segments" not in result or not result["segments"]:
        return 0.0
    
    total_confidence = 0.0
    segment_count = 0
    
    for segment in result["segments"]:
        if "avg_logprob" in segment:
            # Convert log probability to confidence (0-1)
            confidence = min(1.0, max(0.0, (segment["avg_logprob"] + 1.0)))
            total_confidence += confidence
            segment_count += 1
    
    return total_confidence / segment_count if segment_count > 0 else 0.0


def transcribe_chunk_fast(model: whisper.Whisper, audio_path: str, chunk_id: str = None, language: str = None) -> Dict[str, Any]:
    """Transcribe audio chunk optimized for speed."""
    try:
        emit_progress(30, f"Processing chunk {chunk_id}")
        
        # Verify file exists
        if not Path(audio_path).exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
        start_time = time.time()
        
        # Fast transcription options for real-time processing
        result = model.transcribe(
            audio_path,
            language=language,  # Use specified language or auto-detect
            verbose=False,  # Keep quiet
            word_timestamps=False,  # Disable for speed
            fp16=False,  # Use fp32 for consistency
            temperature=0.0,  # Deterministic results
            beam_size=1,  # Faster beam search
            best_of=1,  # Single best result
            patience=1.0,  # Standard patience
            length_penalty=1.0,  # Standard length penalty
            suppress_tokens="-1",  # Default suppression
            initial_prompt=None,  # No prompt for generic transcription
            condition_on_previous_text=False,  # Independent chunk processing
            compression_ratio_threshold=2.4,  # Default threshold
            logprob_threshold=-1.0,  # Default threshold
            no_speech_threshold=0.6  # Default threshold
        )
        
        processing_time = time.time() - start_time
        emit_progress(80, f"Transcription completed in {processing_time:.1f}s")
        
        # Calculate confidence
        confidence = calculate_confidence(result)
        
        # Extract segments with timestamps
        segments = []
        if "segments" in result:
            for segment in result["segments"]:
                segments.append({
                    "start": float(segment.get("start", 0)),
                    "end": float(segment.get("end", 0)),
                    "text": segment.get("text", "").strip()
                })
        
        emit_progress(90, "Processing complete")
        
        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language", "unknown"),
            "segments": segments,
            "confidence": confidence,
            "processing_time": processing_time
        }
        
    except Exception as e:
        emit_error(f"Chunk transcription failed: {str(e)}", traceback.format_exc())
        raise


def batch_transcribe_chunks(model_name: str, chunk_files: list) -> None:
    """Process multiple chunks in batch for efficiency."""
    try:
        emit_progress(0, "Starting batch transcription")
        
        # Load model once for all chunks
        model = load_model_if_needed(model_name)
        
        total_chunks = len(chunk_files)
        for i, chunk_info in enumerate(chunk_files):
            chunk_file = chunk_info["file"]
            chunk_id = chunk_info.get("id", f"chunk_{i}")
            
            try:
                emit_progress(30 + (i * 60 // total_chunks), f"Processing chunk {i+1}/{total_chunks}")
                
                result = transcribe_chunk_fast(model, chunk_file, chunk_id)
                
                # Emit individual chunk result
                emit_message("chunk_result",
                            chunk_id=chunk_id,
                            text=result["text"],
                            language=result["language"],
                            segments=result["segments"],
                            confidence=result["confidence"])
                
            except Exception as e:
                emit_message("chunk_error",
                            chunk_id=chunk_id,
                            error=str(e))
        
        emit_progress(100, "Batch processing complete")
        
    except Exception as e:
        emit_error(f"Batch transcription failed: {str(e)}", traceback.format_exc())


def single_chunk_transcribe(model_name: str, audio_file: str, chunk_id: str = None, language: str = None) -> None:
    """Process a single chunk for real-time transcription."""
    try:
        emit_progress(0, "Starting real-time transcription")
        
        # Load model
        model = load_model_if_needed(model_name)
        
        # Transcribe chunk
        result = transcribe_chunk_fast(model, audio_file, chunk_id, language)
        
        # Send result
        emit_progress(100, "Transcription complete")
        emit_result(
            text=result["text"],
            language=result["language"],
            segments=result["segments"],
            confidence=result["confidence"]
        )
        
    except Exception as e:
        emit_error(f"Single chunk transcription failed: {str(e)}", traceback.format_exc())


def keep_model_warm(model_name: str = "tiny") -> None:
    """Keep model loaded and warm for faster subsequent processing."""
    try:
        model = load_model_if_needed(model_name)
        emit_message("model_ready", model_name=model_name)
        
        # Keep process alive to maintain model in memory
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        emit_message("model_shutdown", model_name=model_name)
    except Exception as e:
        emit_error(f"Model warming failed: {str(e)}", traceback.format_exc())


def main():
    """Main entry point for the streaming whisper worker."""
    parser = argparse.ArgumentParser(description="Whisper streaming transcription worker")
    parser.add_argument("command", choices=["single", "batch", "warm"], 
                       help="Processing mode")
    parser.add_argument("--audio-file", help="Path to audio file (for single mode)")
    parser.add_argument("--chunk-id", help="Chunk identifier")
    parser.add_argument("--chunk-files", help="JSON list of chunk files (for batch mode)")
    parser.add_argument("--model", default="tiny", 
                       choices=["tiny", "base", "small", "medium", "large", "turbo"],
                       help="Whisper model to use")
    parser.add_argument("--language", help="Language code for Whisper (optional)")
    parser.add_argument("--output", help="Output file for transcript (optional)")
    
    args = parser.parse_args()
    
    try:
        if args.command == "single":
            if not args.audio_file:
                raise ValueError("--audio-file required for single mode")
            single_chunk_transcribe(args.model, args.audio_file, args.chunk_id, args.language)
            
        elif args.command == "batch":
            if not args.chunk_files:
                raise ValueError("--chunk-files required for batch mode")
            chunk_files = json.loads(args.chunk_files)
            batch_transcribe_chunks(args.model, chunk_files)
            
        elif args.command == "warm":
            keep_model_warm(args.model)
        
        # Save to file if requested
        if args.output and args.command == "single":
            # Note: For streaming, output saving is handled by the service
            pass
            
    except KeyboardInterrupt:
        emit_message("cancelled", reason="User interrupted")
        sys.exit(1)
    except Exception as e:
        emit_error(f"Unexpected error: {str(e)}", traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
