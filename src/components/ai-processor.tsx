"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Sparkles, Brain, Scissors, MessageSquare } from "lucide-react";

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
      // Step 1: Extract audio and generate transcript
      setCurrentStep("Extracting audio and generating transcript...");
      setProgress(25);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate processing

      // Step 2: Analyze content with NLP
      setCurrentStep("Analyzing content for key moments...");
      setProgress(50);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 3: Detect scenes and visual changes
      setCurrentStep("Detecting optimal cut points...");
      setProgress(75);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 4: Generate suggestions
      setCurrentStep("Generating AI suggestions...");
      setProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mock AI results formatted for short creator
      const mockResults = {
        segments: [
          {
            id: "ai-1",
            start: 0,
            end: 15,
            title: "Opening Hook",
            confidence: 0.92,
            duration: 15,
          },
          {
            id: "ai-2",
            start: 45,
            end: 75,
            title: "Key Point #1",
            confidence: 0.88,
            duration: 30,
          },
          {
            id: "ai-3",
            start: 120,
            end: 150,
            title: "Viral Moment",
            confidence: 0.95,
            duration: 30,
          },
          {
            id: "ai-4",
            start: 200,
            end: 230,
            title: "Call to Action",
            confidence: 0.85,
            duration: 30,
          },
        ],
        captions: [
          {
            id: "cap-1",
            start: 0,
            end: 3,
            text: "Welcome back to my channel!",
            style: {
              fontSize: 24,
              color: "#ffffff",
              position: "bottom",
              animation: "fade-in",
            },
          },
          {
            id: "cap-2",
            start: 3,
            end: 8,
            text: "Today we're talking about something amazing",
            style: {
              fontSize: 24,
              color: "#ffffff",
              position: "bottom",
              animation: "slide-up",
            },
          },
          {
            id: "cap-3",
            start: 8,
            end: 15,
            text: "that will change everything you know",
            style: {
              fontSize: 24,
              color: "#ffffff",
              position: "bottom",
              animation: "bounce",
            },
          },
        ],
        highlights: [
          {
            timestamp: 67,
            description: "High engagement moment detected",
            type: "engagement",
          },
          {
            timestamp: 134,
            description: "Emotional peak identified",
            type: "emotion",
          },
          {
            timestamp: 201,
            description: "Action sequence detected",
            type: "visual",
          },
        ],
      };

      onProcessingComplete(mockResults);
      setCurrentStep("AI analysis complete!");
    } catch (error) {
      console.error("AI processing failed:", error);
      setCurrentStep("Processing failed. Please try again.");
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
