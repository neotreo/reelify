"use client";

import { useState, useRef } from "react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import AIProcessor from "@/components/ai-processor";
import { generateCaptionsFromText } from "@/app/actions";
import {
  Play,
  Pause,
  Scissors,
  Type,
  Music,
  Download,
  Upload,
  Volume2,
  Settings,
  Sparkles,
  Brain,
} from "lucide-react";

interface VideoSegment {
  id: string;
  start: number;
  end: number;
  duration: number;
  title?: string;
  confidence?: number;
  description?: string;
}

interface Caption {
  id: string;
  text: string;
  start: number;
  end: number;
  shortId?: string;
  emphasis?: boolean;
  style: {
    fontSize: number;
    color: string;
    position: string;
    animation: string;
    fontWeight?: string;
  };
}

export default function ShortCreator() {
  const [youtubeUrl, setYoutubeUrl] = useState(() => {
    // Check for URL parameter on component mount
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("url") || "";
    }
    return "";
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(() => {
    // Auto-load if URL is present from URL parameter
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const url = urlParams.get("url");
      if (url) {
        // Set up the video preview for the URL parameter
        setTimeout(() => {
          const videoId = extractYouTubeVideoId(url);
          if (videoId) {
            setVideoPreviewUrl(`https://www.youtube.com/embed/${videoId}`);
            setVideoDuration(300);
          }
        }, 100);
        return true;
      }
    }
    return false;
  });
  const [isGeneratingClips, setIsGeneratingClips] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(100);
  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [musicVolume, setMusicVolume] = useState([50]);
  const [selectedMusic, setSelectedMusic] = useState("trending-beat-1");
  const [showAIProcessor, setShowAIProcessor] = useState(false);
  const [selectedShort, setSelectedShort] = useState<string | null>(null);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [shortPreviewTime, setShortPreviewTime] = useState(0);
  const [isShortPlaying, setIsShortPlaying] = useState(false);
  const [generatedShortUrl, setGeneratedShortUrl] = useState<string | null>(
    null,
  );
  const [isGeneratingShort, setIsGeneratingShort] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shortVideoRef = useRef<HTMLVideoElement>(null);
  const shortIframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setYoutubeUrl(""); // Clear YouTube URL when file is uploaded
      const previewUrl = URL.createObjectURL(file);
      setVideoPreviewUrl(previewUrl);
      setIsVideoLoaded(true);
      setVideoDuration(0); // Will be set when video loads
    }
  };

  const handleYoutubeUrlChange = (url: string) => {
    setYoutubeUrl(url);
    if (url) {
      setVideoFile(null); // Clear file when URL is entered
      setVideoPreviewUrl(null);
      setIsVideoLoaded(false);
    }
  };

  const loadYouTubeVideo = () => {
    if (youtubeUrl) {
      // Validate YouTube URL format
      const isValidYouTubeUrl =
        /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(youtubeUrl);
      if (!isValidYouTubeUrl) {
        alert("Please enter a valid YouTube URL");
        return;
      }
      // Extract video ID and create embed URL for preview
      const videoId = extractYouTubeVideoId(youtubeUrl);
      if (videoId) {
        setVideoPreviewUrl(`https://www.youtube.com/embed/${videoId}`);
        setIsVideoLoaded(true);
        setVideoDuration(300); // Default 5 minutes for demo
      }
    }
  };

  const extractYouTubeVideoId = (url: string): string | null => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Auto-load video if URL parameter is present
  React.useEffect(() => {
    if (youtubeUrl && !isVideoLoaded) {
      const videoId = extractYouTubeVideoId(youtubeUrl);
      if (videoId) {
        setVideoPreviewUrl(`https://www.youtube.com/embed/${videoId}`);
        setIsVideoLoaded(true);
        setVideoDuration(300);
      }
    }
  }, [youtubeUrl, isVideoLoaded]);

  const handleAIProcessingComplete = (data: {
    segments: Array<{
      id: string;
      start: number;
      end: number;
      title: string;
      confidence: number;
      duration: number;
      description?: string;
    }>;
    captions: Array<{
      id: string;
      start: number;
      end: number;
      text: string;
      shortId?: string;
      emphasis?: boolean;
      style: {
        fontSize: number;
        color: string;
        position: string;
        animation: string;
        fontWeight?: string;
      };
    }>;
    highlights: Array<{ timestamp: number; description: string; type: string }>;
    totalShorts?: number;
  }) => {
    // Replace existing segments and captions with AI-generated ones
    setSegments(data.segments);
    setCaptions(data.captions);
    setShowAIProcessor(false);
    setIsAIProcessing(false);

    // Auto-select the first short if available
    if (data.segments.length > 0) {
      setSelectedShort(data.segments[0].id);
    }
  };

  const addSegment = () => {
    const newSegment: VideoSegment = {
      id: Date.now().toString(),
      start: currentTime,
      end: Math.min(currentTime + 15, videoDuration),
      duration: 15,
    };
    setSegments([...segments, newSegment]);
  };

  const addCaption = () => {
    const newCaption: Caption = {
      id: Date.now().toString(),
      text: "New caption",
      start: currentTime,
      end: currentTime + 5,
      style: {
        fontSize: 24,
        color: "#ffffff",
        position: "bottom",
        animation: "fade-in",
      },
    };
    setCaptions([...captions, newCaption]);
  };

  const generateClips = async () => {
    if (!youtubeUrl && !videoFile) return;

    setIsGeneratingClips(true);
    setGenerationProgress(0);

    try {
      // Simulate clip generation process with progress updates
      setGenerationProgress(20);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setGenerationProgress(40);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setGenerationProgress(60);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setGenerationProgress(80);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate sample clips
      const newSegments: VideoSegment[] = [
        {
          id: "auto-1",
          start: 15,
          end: 30,
          duration: 15,
          title: "Key Moment 1",
          confidence: 0.92,
        },
        {
          id: "auto-2",
          start: 45,
          end: 60,
          duration: 15,
          title: "Highlight",
          confidence: 0.87,
        },
        {
          id: "auto-3",
          start: 120,
          end: 135,
          duration: 15,
          title: "Best Part",
          confidence: 0.95,
        },
      ];

      setSegments(newSegments);
      setGenerationProgress(100);

      // Also generate captions
      const sampleText =
        "This is an amazing video that will teach you something incredible";
      const result = await generateCaptionsFromText(sampleText, 30);

      if (result.success && result.captions) {
        setCaptions(
          result.captions.map((cap: any, index: number) => ({
            id: `smart-${index}`,
            text: cap.text,
            start: cap.start || index * 3,
            end: cap.end || index * 3 + 3,
            style: cap.style || {
              fontSize: 24,
              color: "#ffffff",
              position: "bottom",
              animation: "fade-in",
            },
          })),
        );
      }
    } catch (error) {
      console.error("Clip generation failed:", error);
    } finally {
      setIsGeneratingClips(false);
      setTimeout(() => setGenerationProgress(0), 2000);
    }
  };

  const generateSmartCaptions = async () => {
    if (!youtubeUrl && !videoFile) return;

    try {
      // For demo purposes, we'll generate captions based on a sample text
      const sampleText =
        "This is an amazing video that will teach you something incredible";
      const result = await generateCaptionsFromText(sampleText, 30);

      if (result.success && result.captions) {
        setCaptions(
          result.captions.map((cap: any, index: number) => ({
            id: `smart-${index}`,
            text: cap.text,
            start: cap.start || index * 3,
            end: cap.end || index * 3 + 3,
            style: cap.style || {
              fontSize: 24,
              color: "#ffffff",
              position: "bottom",
              animation: "fade-in",
            },
          })),
        );
      }
    } catch (error) {
      console.error("Smart caption generation failed:", error);
    }
  };

  const updateCaption = (id: string, updates: Partial<Caption>) => {
    setCaptions(
      captions.map((caption) =>
        caption.id === id ? { ...caption, ...updates } : caption,
      ),
    );
  };

  const removeSegment = (id: string) => {
    setSegments(segments.filter((segment) => segment.id !== id));
  };

  const removeCaption = (id: string) => {
    setCaptions(captions.filter((caption) => caption.id !== id));
  };

  // Get selected short data
  const selectedShortData = segments.find(
    (segment) => segment.id === selectedShort,
  );
  const selectedShortCaptions = captions.filter(
    (caption) => caption.shortId === selectedShort,
  );

  // Get current captions for the short preview
  const getCurrentCaptions = () => {
    if (!selectedShortData) return [];

    const adjustedTime = shortPreviewTime + selectedShortData.start;
    return selectedShortCaptions.filter(
      (caption) => adjustedTime >= caption.start && adjustedTime <= caption.end,
    );
  };

  // Handle short video play/pause
  const toggleShortPlayback = () => {
    if (shortVideoRef.current) {
      if (isShortPlaying) {
        shortVideoRef.current.pause();
      } else {
        shortVideoRef.current.play();
      }
      setIsShortPlaying(!isShortPlaying);
    }
  };

  // Handle short video time update
  const handleShortTimeUpdate = () => {
    if (shortVideoRef.current && selectedShortData) {
      const currentTime = shortVideoRef.current.currentTime;
      setShortPreviewTime(currentTime);

      // Stop at the end of the selected segment
      if (currentTime >= selectedShortData.duration) {
        shortVideoRef.current.pause();
        setIsShortPlaying(false);
        shortVideoRef.current.currentTime = 0;
        setShortPreviewTime(0);
      }
    }
  };

  // Generate a new video from the selected segment with captions
  const generateShortVideo = async () => {
    if (!selectedShortData) {
      alert("Please select a short to generate");
      return;
    }

    if (!youtubeUrl && !videoFile) {
      alert("Please load a YouTube video or upload a video file first");
      return;
    }

    setIsGeneratingShort(true);

    try {
      // For YouTube videos, we'll create a mock generated video for demo purposes
      // In a real implementation, you would need server-side video processing
      if (youtubeUrl && !videoFile) {
        // Simulate video generation process
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Create a mock video URL (in production, this would be the actual generated video)
        const mockVideoBlob = new Blob([], { type: "video/mp4" });
        const mockUrl = URL.createObjectURL(mockVideoBlob);
        setGeneratedShortUrl(mockUrl);
        setIsGeneratingShort(false);
        return;
      }

      // For uploaded video files, use the canvas-based approach
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas not available");
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas context not available");
      }

      // Set canvas dimensions for 9:16 aspect ratio
      canvas.width = 720;
      canvas.height = 1280;

      // Create a video element to load the original video
      const originalVideo = document.createElement("video");
      originalVideo.src = videoPreviewUrl || "";
      originalVideo.crossOrigin = "anonymous";
      originalVideo.muted = true; // Required for autoplay

      await new Promise((resolve, reject) => {
        originalVideo.onloadedmetadata = resolve;
        originalVideo.onerror = reject;
        setTimeout(() => reject(new Error("Video load timeout")), 10000);
      });

      // Set video to start time of the segment
      originalVideo.currentTime = selectedShortData.start;

      await new Promise((resolve, reject) => {
        originalVideo.onseeked = resolve;
        originalVideo.onerror = reject;
        setTimeout(() => reject(new Error("Video seek timeout")), 5000);
      });

      // Check if MediaRecorder is supported
      if (!MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        if (!MediaRecorder.isTypeSupported("video/webm")) {
          throw new Error("Video recording not supported in this browser");
        }
      }

      // Create MediaRecorder to capture the canvas
      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setGeneratedShortUrl(url);
        setIsGeneratingShort(false);
      };

      // Start recording
      mediaRecorder.start(100); // Record in 100ms chunks
      originalVideo.play();

      const startTime = Date.now();
      const maxDuration = selectedShortData.duration * 1000; // Convert to milliseconds

      // Animation loop to render video frames with captions
      const renderFrame = () => {
        const elapsed = Date.now() - startTime;

        if (
          originalVideo.paused ||
          originalVideo.ended ||
          originalVideo.currentTime >= selectedShortData.end ||
          elapsed >= maxDuration
        ) {
          mediaRecorder.stop();
          originalVideo.pause();
          return;
        }

        // Clear canvas with black background
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw video frame (centered and scaled to fit 9:16)
        if (originalVideo.videoWidth > 0 && originalVideo.videoHeight > 0) {
          const videoAspect =
            originalVideo.videoWidth / originalVideo.videoHeight;
          const canvasAspect = canvas.width / canvas.height;

          let drawWidth, drawHeight, drawX, drawY;

          if (videoAspect > canvasAspect) {
            // Video is wider, fit to height
            drawHeight = canvas.height;
            drawWidth = drawHeight * videoAspect;
            drawX = (canvas.width - drawWidth) / 2;
            drawY = 0;
          } else {
            // Video is taller, fit to width
            drawWidth = canvas.width;
            drawHeight = drawWidth / videoAspect;
            drawX = 0;
            drawY = (canvas.height - drawHeight) / 2;
          }

          ctx.drawImage(originalVideo, drawX, drawY, drawWidth, drawHeight);
        }

        // Get current captions for this time
        const currentTime = originalVideo.currentTime;
        const currentCaptions = selectedShortCaptions.filter(
          (caption) =>
            currentTime >= caption.start && currentTime <= caption.end,
        );

        // Draw captions at middle bottom with better styling
        if (currentCaptions.length > 0) {
          currentCaptions.forEach((caption, index) => {
            const fontSize = caption.style.fontSize || 32;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Position at middle bottom (75% down from top)
            const textY = canvas.height * 0.75 + index * (fontSize + 10);
            const textX = canvas.width / 2;

            // Add text background for better readability
            const textMetrics = ctx.measureText(caption.text);
            const textWidth = textMetrics.width;
            const padding = 20;

            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(
              textX - textWidth / 2 - padding,
              textY - fontSize / 2 - 5,
              textWidth + padding * 2,
              fontSize + 10,
            );

            // Add text stroke for better visibility
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 4;
            ctx.strokeText(caption.text, textX, textY);

            // Draw the text
            ctx.fillStyle = caption.style.color || "#ffffff";
            ctx.fillText(caption.text, textX, textY);
          });
        }

        // Add watermark
        ctx.font = "bold 24px Arial";
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
        ctx.lineWidth = 2;
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        ctx.strokeText("Reelify", canvas.width - 20, 20);
        ctx.fillText("Reelify", canvas.width - 20, 20);

        requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (error) {
      console.error("Error generating short video:", error);
      alert(
        `Failed to generate short video: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setIsGeneratingShort(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">
            <span className="font-reelify text-purple-400">Reelify</span>{" "}
            YouTube Videos
          </h1>
          <p className="text-gray-300">Transform YouTube videos into shorts</p>
        </div>

        {/* Input Section */}
        <Card className="mb-8 bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Video Input
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  YouTube URL
                </label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={!youtubeUrl}
                    onClick={loadYouTubeVideo}
                  >
                    Load
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Upload Video File
                </label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-gray-600 text-white hover:bg-gray-800"
                  >
                    Browse
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Preview Section */}
        {isVideoLoaded && videoPreviewUrl && (
          <Card className="mb-8 bg-gray-900 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Play className="w-5 h-5" />
                Video Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                {videoFile ? (
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="w-full h-full object-contain"
                    onLoadedMetadata={(e) => {
                      const video = e.target as HTMLVideoElement;
                      setVideoDuration(Math.floor(video.duration));
                    }}
                  />
                ) : (
                  <iframe
                    src={videoPreviewUrl}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generate Shorts Button */}
        {isVideoLoaded && (
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">
                        Generate Viral Shorts
                      </h3>
                      <p className="text-purple-200">
                        Create 3 engaging shorts with smart captions from your
                        YouTube video
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setIsAIProcessing(true);
                      setShowAIProcessor(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={!isVideoLoaded || isAIProcessing}
                  >
                    {isAIProcessing ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Shorts
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Processor Section */}
        {(youtubeUrl || videoFile) && showAIProcessor && (
          <div className="mb-8">
            <AIProcessor
              videoUrl={
                youtubeUrl ||
                (videoFile ? URL.createObjectURL(videoFile) : undefined)
              }
              onProcessingComplete={handleAIProcessingComplete}
            />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Preview */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Original Video Preview */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Original Video
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video bg-gray-800 rounded-lg mb-4 flex items-center justify-center">
                    {isVideoLoaded && videoPreviewUrl ? (
                      <div className="w-full h-full relative">
                        {videoFile ? (
                          <video
                            src={videoPreviewUrl}
                            className="w-full h-full object-contain rounded-lg"
                            poster=""
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                              <Play className="w-16 h-16 mx-auto mb-2 text-purple-400" />
                              <p className="text-gray-300">
                                YouTube Video Loaded
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-16 h-16 mx-auto mb-2 text-gray-500" />
                        <p className="text-gray-500">No video loaded</p>
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="border-gray-600 text-white hover:bg-gray-800"
                      >
                        {isPlaying ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <span className="text-sm text-gray-300">
                        {Math.floor(currentTime / 60)}:
                        {(currentTime % 60).toString().padStart(2, "0")} /{" "}
                        {Math.floor(videoDuration / 60)}:
                        {(videoDuration % 60).toString().padStart(2, "0")}
                      </span>
                    </div>

                    <div className="relative">
                      <Slider
                        value={[currentTime]}
                        onValueChange={(value) => setCurrentTime(value[0])}
                        max={videoDuration}
                        step={1}
                        className="w-full"
                      />
                      {/* Segment indicators */}
                      <div className="absolute top-0 w-full h-6 pointer-events-none">
                        {segments.map((segment) => (
                          <div
                            key={segment.id}
                            className="absolute h-2 bg-purple-500 rounded opacity-70"
                            style={{
                              left: `${(segment.start / videoDuration) * 100}%`,
                              width: `${(segment.duration / videoDuration) * 100}%`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Short Preview */}
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Scissors className="w-5 h-5" />
                    Short Preview
                    {selectedShortData && (
                      <span className="text-sm text-purple-400 ml-2">
                        ({selectedShortData.title})
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-[9/16] bg-gray-800 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden max-w-xs mx-auto">
                    {selectedShortData && isVideoLoaded ? (
                      <div className="w-full h-full relative">
                        {generatedShortUrl ? (
                          <>
                            <video
                              ref={shortVideoRef}
                              src={generatedShortUrl}
                              className="w-full h-full object-cover rounded-lg"
                              controls
                              onPlay={() => setIsShortPlaying(true)}
                              onPause={() => setIsShortPlaying(false)}
                              onEnded={() => {
                                setIsShortPlaying(false);
                                setShortPreviewTime(0);
                              }}
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-gray-700 rounded-lg flex flex-col items-center justify-center relative">
                            <div className="text-center p-4">
                              <Scissors className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                              <h3 className="text-white font-semibold mb-2">
                                {selectedShortData.title}
                              </h3>
                              <p className="text-gray-300 text-sm mb-4">
                                {selectedShortData.description ||
                                  "AI-generated short ready for processing"}
                              </p>
                              <div className="text-xs text-purple-400 mb-4">
                                Duration:{" "}
                                {Math.floor(selectedShortData.duration)}s
                                <br />
                                Confidence:{" "}
                                {Math.round(
                                  (selectedShortData.confidence || 0.8) * 100,
                                )}
                                %
                              </div>
                              <Button
                                onClick={generateShortVideo}
                                disabled={
                                  isGeneratingShort ||
                                  (!youtubeUrl && !videoFile)
                                }
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                {isGeneratingShort ? (
                                  <>
                                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Generate Short
                                  </>
                                )}
                              </Button>
                              {!youtubeUrl && !videoFile && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Load a YouTube video or upload a file to
                                  generate shorts
                                </p>
                              )}
                            </div>

                            {/* Watermark */}
                            <div className="absolute top-4 right-4 bg-black bg-opacity-50 px-2 py-1 rounded text-xs text-white font-bold">
                              Reelify
                            </div>

                            {/* Preview captions */}
                            {selectedShortCaptions.length > 0 && (
                              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                                <div className="bg-black bg-opacity-80 px-3 py-1 rounded text-white text-sm max-w-[90%] text-center">
                                  {selectedShortCaptions[0].text}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center">
                        <Scissors className="w-12 h-12 mx-auto mb-2 text-gray-500" />
                        <p className="text-gray-500 text-sm">
                          {selectedShort
                            ? "Loading short preview..."
                            : "Select a short to preview"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Short Timeline */}
                  {selectedShortData && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        {!generatedShortUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={toggleShortPlayback}
                            className="border-gray-600 text-white hover:bg-gray-800"
                            disabled={!videoFile}
                          >
                            {isShortPlaying ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                        <span className="text-gray-300">
                          {generatedShortUrl
                            ? "Generated Short Ready"
                            : `${Math.floor(shortPreviewTime)}s / ${Math.floor(selectedShortData.duration)}s`}
                        </span>
                      </div>

                      {!generatedShortUrl && (
                        <div className="relative">
                          <Slider
                            value={[shortPreviewTime]}
                            onValueChange={(value) => {
                              setShortPreviewTime(value[0]);
                              if (shortVideoRef.current) {
                                shortVideoRef.current.currentTime = value[0];
                              }
                            }}
                            max={selectedShortData.duration}
                            step={0.1}
                            className="w-full"
                          />
                        </div>
                      )}

                      <div className="text-xs text-gray-400">
                        Original: {Math.floor(selectedShortData.start)}s -{" "}
                        {Math.floor(selectedShortData.end)}s
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Editor Panel */}
          <div>
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="p-0">
                <Tabs defaultValue="segments" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-gray-800">
                    <TabsTrigger value="segments" className="text-white">
                      <Scissors className="w-4 h-4 mr-1" />
                      Clips
                    </TabsTrigger>
                    <TabsTrigger value="captions" className="text-white">
                      <Type className="w-4 h-4 mr-1" />
                      Captions
                    </TabsTrigger>
                    <TabsTrigger value="music" className="text-white">
                      <Music className="w-4 h-4 mr-1" />
                      Audio
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="segments" className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-white">
                        AI-Generated Shorts ({segments.length})
                      </h3>
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {segments.length === 0 ? (
                        <div className="text-center py-8">
                          <Brain className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                          <p className="text-gray-400 mb-2">
                            No shorts generated yet
                          </p>
                          <p className="text-sm text-gray-500">
                            Use AI processing to generate viral shorts
                          </p>
                        </div>
                      ) : (
                        segments.map((segment, index) => (
                          <div
                            key={segment.id}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                              selectedShort === segment.id
                                ? "bg-purple-900/50 border-purple-500"
                                : "bg-gray-800 border-gray-700 hover:border-gray-600"
                            }`}
                            onClick={() => setSelectedShort(segment.id)}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium text-white">
                                    {segment.title || `Short ${index + 1}`}
                                  </span>
                                  {segment.confidence && (
                                    <div className="flex items-center gap-1">
                                      <Sparkles className="w-3 h-3 text-purple-400" />
                                      <span className="text-xs text-purple-400">
                                        {Math.round(segment.confidence * 100)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {segment.description && (
                                  <p className="text-xs text-gray-400 mb-2">
                                    {segment.description}
                                  </p>
                                )}
                                <div className="text-xs text-gray-300">
                                  {Math.floor(segment.start)}s -{" "}
                                  {Math.floor(segment.end)}s
                                  <span className="text-purple-400 ml-2">
                                    ({Math.floor(segment.duration)}s duration)
                                  </span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSegment(segment.id);
                                }}
                                className="text-gray-400 hover:text-red-400"
                              >
                                Remove
                              </Button>
                            </div>
                            {selectedShort === segment.id && (
                              <div className="mt-3 pt-3 border-t border-gray-700">
                                <p className="text-xs text-purple-300 mb-2">
                                  Captions for this short:
                                </p>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                  {captions
                                    .filter((cap) => cap.shortId === segment.id)
                                    .map((caption) => (
                                      <div
                                        key={caption.id}
                                        className="text-xs p-2 bg-gray-700 rounded"
                                      >
                                        <span
                                          className={`${
                                            caption.emphasis
                                              ? "text-yellow-300 font-bold"
                                              : "text-gray-300"
                                          }`}
                                        >
                                          {caption.text}
                                        </span>
                                        <span className="text-gray-500 ml-2">
                                          ({Math.floor(caption.start)}s)
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="captions" className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-white">
                        Smart Captions ({captions.length})
                      </h3>
                    </div>

                    {selectedShort && (
                      <div className="mb-4 p-3 bg-purple-900/30 rounded-lg border border-purple-700">
                        <p className="text-sm text-purple-300 mb-1">
                          Viewing captions for:{" "}
                          {segments.find((s) => s.id === selectedShort)?.title}
                        </p>
                        <p className="text-xs text-purple-400">
                          Select a short from the Clips tab to view its captions
                        </p>
                      </div>
                    )}

                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {captions.length === 0 ? (
                        <div className="text-center py-8">
                          <Type className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                          <p className="text-gray-400 mb-2">
                            No captions generated yet
                          </p>
                          <p className="text-sm text-gray-500">
                            Generate AI shorts to get smart captions
                          </p>
                        </div>
                      ) : (
                        captions
                          .filter(
                            (caption) =>
                              !selectedShort ||
                              caption.shortId === selectedShort,
                          )
                          .map((caption) => (
                            <div
                              key={caption.id}
                              className={`p-3 rounded-lg border ${
                                caption.emphasis
                                  ? "bg-yellow-900/20 border-yellow-600"
                                  : "bg-gray-800 border-gray-700"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {caption.emphasis && (
                                      <Sparkles className="w-3 h-3 text-yellow-400" />
                                    )}
                                    <span className="text-xs text-gray-400">
                                      {caption.shortId
                                        ? segments.find(
                                            (s) => s.id === caption.shortId,
                                          )?.title || "Unknown Short"
                                        : "General Caption"}
                                    </span>
                                  </div>
                                  <Textarea
                                    value={caption.text}
                                    onChange={(e) =>
                                      updateCaption(caption.id, {
                                        text: e.target.value,
                                      })
                                    }
                                    className={`mb-2 border-gray-600 text-sm ${
                                      caption.emphasis
                                        ? "bg-yellow-900/30 text-yellow-100 font-semibold"
                                        : "bg-gray-700 text-white"
                                    }`}
                                    rows={2}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-300">
                                  {Math.floor(caption.start)}s -{" "}
                                  {Math.floor(caption.end)}s
                                  {caption.emphasis && (
                                    <span className="text-yellow-400 ml-2">
                                      (Key Moment)
                                    </span>
                                  )}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeCaption(caption.id)}
                                  className="text-gray-400 hover:text-red-400"
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="music" className="p-4 space-y-4">
                    <h3 className="font-semibold text-white">
                      Background Music
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          Music Track
                        </label>
                        <select
                          value={selectedMusic}
                          onChange={(e) => setSelectedMusic(e.target.value)}
                          className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                        >
                          <option value="trending-beat-1">
                            Trending Beat 1
                          </option>
                          <option value="trending-beat-2">
                            Trending Beat 2
                          </option>
                          <option value="chill-vibe">Chill Vibe</option>
                          <option value="upbeat-energy">Upbeat Energy</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-white">
                          Volume: {musicVolume[0]}%
                        </label>
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-gray-400" />
                          <Slider
                            value={musicVolume}
                            onValueChange={setMusicVolume}
                            max={100}
                            step={1}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                        <p className="text-sm text-blue-300 mb-1">
                          🎵 Music Integration Coming Soon
                        </p>
                        <p className="text-xs text-blue-400">
                          Custom audio upload and music library features will be
                          available in the next update.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card className="mt-4 bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Export Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">
                    Platform Preset
                  </label>
                  <select className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white">
                    <option value="tiktok">TikTok (9:16)</option>
                    <option value="youtube-shorts">
                      YouTube Shorts (9:16)
                    </option>
                    <option value="instagram-reels">
                      Instagram Reels (9:16)
                    </option>
                    <option value="custom">Custom Dimensions</option>
                  </select>
                </div>

                {selectedShort ? (
                  <div className="p-3 bg-green-900/30 rounded-lg border border-green-700 mb-4">
                    <p className="text-sm text-green-300 mb-1">
                      Ready to export:{" "}
                      {segments.find((s) => s.id === selectedShort)?.title}
                    </p>
                    <p className="text-xs text-green-400">
                      Duration:{" "}
                      {Math.floor(
                        segments.find((s) => s.id === selectedShort)
                          ?.duration || 0,
                      )}
                      s
                    </p>
                  </div>
                ) : segments.length > 0 ? (
                  <div className="p-3 bg-yellow-900/30 rounded-lg border border-yellow-700 mb-4">
                    <p className="text-sm text-yellow-300 mb-1">
                      Select a short to export
                    </p>
                    <p className="text-xs text-yellow-400">
                      Choose from {segments.length} AI-generated shorts
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 mb-4">
                    <p className="text-sm text-gray-400 mb-1">
                      No shorts available
                    </p>
                    <p className="text-xs text-gray-500">
                      Generate AI shorts first
                    </p>
                  </div>
                )}

                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={!selectedShort}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {selectedShort
                    ? "Export Selected Short"
                    : "Select Short to Export"}
                </Button>

                <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                  <p className="text-sm text-blue-300 mb-1">
                    🚀 Export Feature Coming Soon
                  </p>
                  <p className="text-xs text-blue-400">
                    Video rendering and export functionality will be available
                    in the next update.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Hidden canvas for video generation */}
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
        width={720}
        height={1280}
      />
    </div>
  );
}
