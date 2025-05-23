#!/usr/bin/env python3
"""
AI worker for VoiceMCP using LangChain and OpenAI.
Handles title generation and summarization from transcripts.
Communicates with Node.js via JSON messages over stdout/stderr.
"""

import sys
import json
import argparse
import traceback
import os
import warnings
from typing import Dict, Any, Optional

# Suppress warnings
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

try:
    from langchain_openai import ChatOpenAI
    from langchain.prompts import ChatPromptTemplate
    from langchain.schema import HumanMessage, SystemMessage
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


def emit_result(title: str, summary: str) -> None:
    """Send AI processing result to parent process."""
    emit_message("result", title=title, summary=summary)


def create_openai_client(api_key: str, model: str = "gpt-4o") -> ChatOpenAI:
    """Create OpenAI client with LangChain."""
    try:
        return ChatOpenAI(
            model=model,
            temperature=0,
            api_key=api_key,
            max_retries=3,
            request_timeout=60
        )
    except Exception as e:
        emit_error(f"Failed to create OpenAI client: {str(e)}", traceback.format_exc())
        raise


def generate_title(llm: ChatOpenAI, transcript: str) -> str:
    """Generate a concise title from the transcript."""
    try:
        emit_progress(25, "Generating title...")
        
        # Create title generation prompt
        title_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert at creating concise, descriptive titles for audio transcripts. 
            Generate a clear, specific title that captures the main topic or purpose of the conversation.
            
            Guidelines:
            - Keep it under 60 characters
            - Be specific and descriptive
            - Use title case
            - Avoid generic words like "Recording" or "Audio"
            - Focus on the main topic, purpose, or key discussion points
            
            Examples:
            - "Weekly Team Standup - Sprint Planning"
            - "Customer Interview - Product Feedback"
            - "Board Meeting - Q4 Budget Review"
            - "Training Session - New Employee Onboarding"
            """),
            ("human", "Generate a title for this transcript:\n\n{transcript}")
        ])
        
        # Generate title
        chain = title_prompt | llm
        result = chain.invoke({"transcript": transcript[:2000]})  # Limit input length
        
        title = result.content.strip().strip('"').strip("'")
        emit_progress(50, "Title generated")
        
        return title
        
    except Exception as e:
        emit_error(f"Title generation failed: {str(e)}", traceback.format_exc())
        return "Untitled Recording"


def generate_summary(llm: ChatOpenAI, transcript: str) -> str:
    """Generate a summary from the transcript."""
    try:
        emit_progress(75, "Generating summary...")
        
        # Create summary generation prompt
        summary_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert at creating concise, informative summaries of audio transcripts.
            Generate a clear summary that captures the key points, decisions, and outcomes.
            
            Guidelines:
            - Keep it between 100-300 words
            - Use bullet points for key items when appropriate
            - Focus on actionable items, decisions, and important information
            - Be objective and factual
            - Include relevant context and outcomes
            
            Format your response as a well-structured summary with clear sections if needed.
            """),
            ("human", "Generate a summary for this transcript:\n\n{transcript}")
        ])
        
        # Generate summary
        chain = summary_prompt | llm
        result = chain.invoke({"transcript": transcript[:4000]})  # Limit input length
        
        summary = result.content.strip()
        emit_progress(95, "Summary generated")
        
        return summary
        
    except Exception as e:
        emit_error(f"Summary generation failed: {str(e)}", traceback.format_exc())
        return "Summary generation failed."


def process_transcript(api_key: str, transcript: str, model: str = "gpt-4o") -> Dict[str, str]:
    """Process transcript to generate title and summary."""
    try:
        emit_progress(0, "Starting AI processing")
        
        # Validate inputs
        if not api_key:
            raise ValueError("OpenAI API key is required")
        
        if not transcript or len(transcript.strip()) < 10:
            raise ValueError("Transcript is too short or empty")
        
        # Create OpenAI client
        llm = create_openai_client(api_key, model)
        emit_progress(10, "OpenAI client initialized")
        
        # Generate title
        title = generate_title(llm, transcript)
        
        # Generate summary
        summary = generate_summary(llm, transcript)
        
        emit_progress(100, "AI processing complete")
        
        return {
            "title": title,
            "summary": summary
        }
        
    except Exception as e:
        emit_error(f"AI processing failed: {str(e)}", traceback.format_exc())
        raise


def main():
    """Main entry point for the AI worker."""
    parser = argparse.ArgumentParser(description="AI worker for title and summary generation")
    parser.add_argument("transcript_file", help="Path to transcript JSON file")
    parser.add_argument("--api-key", required=True, help="OpenAI API key")
    parser.add_argument("--model", default="gpt-4o", help="OpenAI model to use (default: gpt-4o)")
    parser.add_argument("--output", help="Output file for AI results (optional)")
    
    args = parser.parse_args()
    
    try:
        emit_progress(0, "Starting AI worker")
        
        # Load transcript
        emit_progress(5, "Loading transcript...")
        with open(args.transcript_file, 'r', encoding='utf-8') as f:
            transcript_data = json.load(f)
        
        # Extract transcript text - handle both formats
        transcript_text = ""
        if "text" in transcript_data:
            # Direct format
            transcript_text = transcript_data["text"]
        elif "result" in transcript_data and "text" in transcript_data["result"]:
            # Nested format from WhisperService
            transcript_text = transcript_data["result"]["text"]
        else:
            raise ValueError("No transcript text found in file")
        
        if not transcript_text or len(transcript_text.strip()) < 10:
            raise ValueError("Transcript text is too short or empty")
        
        # Process with AI
        result = process_transcript(args.api_key, transcript_text, args.model)
        
        # Save to file if requested
        if args.output:
            emit_progress(98, "Saving AI results to file...")
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        
        # Send result
        emit_result(
            title=result["title"],
            summary=result["summary"]
        )
        
    except KeyboardInterrupt:
        emit_error("AI processing cancelled by user")
        sys.exit(1)
    except Exception as e:
        emit_error(f"Unexpected error: {str(e)}", traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
