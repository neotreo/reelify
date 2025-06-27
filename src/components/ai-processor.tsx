"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Sparkles, Brain, Scissors, MessageSquare } from "lucide-react";
import { processVideoWithAI } from "@/app/actions";

interface AIProcessorProps {
  videoUrl?: string;
  onProcessingComplete: (data: {
    segments: Array<{
      id: string;
      start: number;
      end: number;
      title: string;
      confidence: number;
      duration: number;
    }>;
    captions: Array<{
      id: string;
      start: number;
      end: number;
      text: string;
      style: {
        fontSize: number;
        color: string;
        position: string;
        animation: string;
      };
    }>;
    highlights: Array<{ timestamp: number; description: string; type: string }>;
  }) => void;
}

export default function AIProcessor({
  videoUrl,
  onProcessingComplete,
}: AIProcessorProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  const processVideo = async () => {
    if (!videoUrl) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Step 1: Extract audio from YouTube
      setCurrentStep("🎬 Extracting high-quality audio from YouTube video...");
      setProgress(20);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 2: Transcribe with Whisper
      setCurrentStep(
        "🎤 Transcribing audio with OpenAI Whisper (1-2 minutes)...",
      );
      setProgress(40);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 3: AI Content Analysis
      setCurrentStep(
        "🧠 Analyzing content for viral moments and key insights...",
      );
      setProgress(60);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 4: Generate shorts
      setCurrentStep("🎯 Identifying best segments for short-form content...");
      setProgress(80);

      // Call the real AI processing function
      const result = await processVideoWithAI(videoUrl);

      if (!result.success) {
        throw new Error(result.error || "AI processing failed");
      }

      // Step 5: Finalize
      setCurrentStep("✂️ Generating smart captions and finalizing shorts...");
      setProgress(100);

      onProcessingComplete(result.data);
      setCurrentStep("🚀 Processing complete! Your viral shorts are ready!");
    } catch (error) {
      console.error("AI processing failed:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Processing failed. Please try again.";
      setCurrentStep(`❌ ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-white">AI Video Analysis</h3>
          <p className="text-sm text-gray-300">
            Let AI find the best moments for your shorts
          </p>
        </div>
      </div>

      {!isProcessing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 bg-blue-900/50 rounded-lg border border-blue-700">
              <Brain className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-blue-300">
                Content Analysis
              </p>
              <p className="text-xs text-blue-400">NLP + Speech Recognition</p>
            </div>
            <div className="p-3 bg-green-900/50 rounded-lg border border-green-700">
              <Scissors className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-green-300">
                Smart Segmentation
              </p>
              <p className="text-xs text-green-400">Scene + Audio Detection</p>
            </div>
            <div className="p-3 bg-orange-900/50 rounded-lg border border-orange-700">
              <MessageSquare className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-orange-300">
                Auto Captions
              </p>
              <p className="text-xs text-orange-400">Transcription + Timing</p>
            </div>
          </div>

          <Button
            onClick={processVideo}
            disabled={!videoUrl}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Analyze Video with AI
          </Button>

          {!videoUrl && (
            <p className="text-sm text-gray-400 text-center">
              Please add a video URL first
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <p className="font-medium text-white mb-2">
              AI Processing Video...
            </p>
            <p className="text-sm text-gray-300 mb-4">{currentStep}</p>
          </div>

          <Progress value={progress} className="w-full" />

          <div className="text-center">
            <p className="text-sm text-gray-400">{progress}% complete</p>
          </div>
        </div>
      )}
    </div>
  );
}
