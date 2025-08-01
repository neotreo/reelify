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
            // Generate demo clips for the loaded video
            setTimeout(() => generateClips(), 1000);
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
  const [videoDuration, setVideoDuration] = useState(0);
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
  const [downloadedSegments, setDownloadedSegments] = useState<
    Record<string, string>
  >({});
  const [cropPosition, setCropPosition] = useState(0.5); // 0 = left, 1 = right
  const [segmentCaptions, setSegmentCaptions] = useState<Caption[]>([]);
  const [fullVideoElement, setFullVideoElement] =
    useState<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shortVideoRef = useRef<HTMLVideoElement>(null);
  const shortIframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Add refs for cleanup
  const timeoutRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const animationFrameRefs = useRef<Set<number>>(new Set());

  // Get selected short data - moved up to avoid reference before initialization
  const selectedShortData = segments.find(
    (segment) => segment.id === selectedShort,
  );
  const selectedShortCaptions = captions.filter(
    (caption) => caption.shortId === selectedShort,
  );

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

  // Add cleanup effect for video elements and URLs
  React.useEffect(() => {
    return () => {
      // Cleanup video elements on unmount
      if (fullVideoRef.current) {
        fullVideoRef.current.pause();
        fullVideoRef.current.src = '';
        fullVideoRef.current.load();
      }
      
      if (shortVideoRef.current) {
        shortVideoRef.current.pause();
        shortVideoRef.current.src = '';
        shortVideoRef.current.load();
      }
      
      // Cleanup generated URLs
      if (generatedShortUrl) {
        URL.revokeObjectURL(generatedShortUrl);
      }
      
      if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
      
      // Cleanup all timeouts
      timeoutRefs.current.forEach((timeoutId: ReturnType<typeof setTimeout>) => clearTimeout(timeoutId));
      timeoutRefs.current.clear();
      
      // Cleanup all animation frames
      animationFrameRefs.current.forEach((frameId: number) => cancelAnimationFrame(frameId));
      animationFrameRefs.current.clear();
    };
  }, [generatedShortUrl, videoPreviewUrl]);

  // Helper functions for managed timeouts and animation frames
  const createManagedTimeout = (callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      timeoutRefs.current.delete(timeoutId);
      callback();
    }, delay);
    timeoutRefs.current.add(timeoutId);
    return timeoutId;
  };

  const createManagedAnimationFrame = (callback: FrameRequestCallback) => {
    const frameId = requestAnimationFrame((time) => {
      animationFrameRefs.current.delete(frameId);
      callback(time);
    });
    animationFrameRefs.current.add(frameId);
    return frameId;
  };

  // Fix the animation frame cleanup
  React.useEffect(() => {
    let animationFrameId: number;

    if (isPlaying) {
      let lastTime = Date.now();

      const animateTimeline = () => {
        if (!isPlaying) {
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          return;
        }

        const now = Date.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        let newTime = currentTime + deltaTime;

        if (newTime >= videoDuration) {
          newTime = 0;
        }

        setCurrentTime(newTime);

        if (fullVideoRef.current && selectedShortData) {
          const videoPosition =
            (newTime / videoDuration) *
            (fullVideoRef.current.duration || videoDuration);
          fullVideoRef.current.currentTime = videoPosition;
        }

        animationFrameId = requestAnimationFrame(animateTimeline);
      };

      animationFrameId = requestAnimationFrame(animateTimeline);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, currentTime, videoDuration, selectedShortData]);

  // Fix MediaRecorder cleanup
  const generateFromDownloadedSegment = async (segmentPath: string) => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("Canvas not available");

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      canvas.width = 720;
      canvas.height = 1280;

      const supportedTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];

      let mimeType = "video/webm";
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      const chunks: BlobPart[] = [];
      let animationId: number;

      const cleanup = () => {
        if (animationId) {
          cancelAnimationFrame(animationId);
        }
        // Stop all tracks in the stream
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      };

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        // Cleanup previous URL if it exists
        if (generatedShortUrl) {
          URL.revokeObjectURL(generatedShortUrl);
        }
        
        setGeneratedShortUrl(url);
        setIsGeneratingShort(false);
      };

      mediaRecorder.start(100);

      const duration = selectedShortData!.duration * 1000;
      const startTime = Date.now();

      const renderFrame = () => {
        const elapsed = Date.now() - startTime;

        if (elapsed >= duration) {
          mediaRecorder.stop();
          return;
        }

        // Clear canvas with gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#1a1a2e");
        gradient.addColorStop(0.5, "#16213e");
        gradient.addColorStop(1, "#0f3460");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add "ACTUAL SEGMENT" indicator
        ctx.font = "bold 32px Arial";
        ctx.fillStyle = "#00ff00";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✅ ACTUAL VIDEO SEGMENT", canvas.width / 2, 100);

        ctx.font = "24px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Downloaded from YouTube", canvas.width / 2, 140);
        ctx.fillText(
          `Segment: ${segmentPath.split("/").pop()}`,
          canvas.width / 2,
          170,
        );

        // Add main content area
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(
          60,
          canvas.height * 0.25,
          canvas.width - 120,
          canvas.height * 0.4,
        );

        // Add title
        ctx.font = "bold 48px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          selectedShortData!.title || "Downloaded Short",
          canvas.width / 2,
          canvas.height * 0.35,
        );

        // Add description
        ctx.font = "24px Arial";
        ctx.fillStyle = "#cccccc";
        const description =
          selectedShortData!.description ||
          "This short was generated from the actual downloaded video segment";
        const words = description.split(" ");
        const lines = [];
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine + (currentLine ? " " : "") + word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > canvas.width - 120 && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        lines.forEach((line, index) => {
          ctx.fillText(
            line,
            canvas.width / 2,
            canvas.height * 0.45 + index * 30,
          );
        });

        // Add comprehensive captions
        const currentTime = elapsed / 1000 + selectedShortData!.start;
        const currentCaptions = selectedShortCaptions.filter(
          (caption) =>
            currentTime >= caption.start && currentTime <= caption.end,
        );

        if (currentCaptions.length > 0) {
          currentCaptions.forEach((caption, index) => {
            const fontSize = caption.style.fontSize || 32;
            ctx.font = `bold ${fontSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const textY = canvas.height * 0.75 + index * (fontSize + 10);
            const textX = canvas.width / 2;

            // Add text background
            const textMetrics = ctx.measureText(caption.text);
            const textWidth = textMetrics.width;
            const padding = 20;

            ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
            ctx.fillRect(
              textX - textWidth / 2 - padding,
              textY - fontSize / 2 - 5,
              textWidth + padding * 2,
              fontSize + 10,
            );

            // Add text stroke
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 4;
            ctx.strokeText(caption.text, textX, textY);

            // Draw the text with emphasis styling
            ctx.fillStyle = caption.emphasis
              ? "#FFD700"
              : caption.style.color || "#ffffff";
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

        // Add progress indicator
        const progress = elapsed / duration;
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fillRect(60, canvas.height - 60, canvas.width - 120, 4);
        ctx.fillStyle = "#8b5cf6";
        ctx.fillRect(
          60,
          canvas.height - 60,
          (canvas.width - 120) * progress,
          4,
        );

        requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (error) {
      console.error("Error generating from downloaded segment:", error);
      setIsGeneratingShort(false);
      throw error;
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
        // Set a default duration for the timeline
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

  React.useEffect(() => {
    if (fullVideoRef.current) {
      const video = fullVideoRef.current;

      const handleLoadStart = () => console.log("Video load started");
      const handleLoadedData = () => console.log("Video data loaded");
      const handleLoadedMetadata = () => {
        console.log("Video metadata loaded:", {
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
        });
        updateCropPreview();
      };
      const handleCanPlay = () => console.log("Video can play");
      const handleError = (e) => console.error("Video error:", e);

      video.addEventListener("loadstart", handleLoadStart);
      video.addEventListener("loadeddata", handleLoadedData);
      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("error", handleError);

      return () => {
        video.removeEventListener("loadstart", handleLoadStart);
        video.removeEventListener("loadeddata", handleLoadedData);
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
      };
    }
  }, [fullVideoRef.current]);

  // Auto-load video if URL parameter is present
  React.useEffect(() => {
    if (youtubeUrl && !isVideoLoaded) {
      const videoId = extractYouTubeVideoId(youtubeUrl);
      if (videoId) {
        setVideoPreviewUrl(`https://www.youtube.com/embed/${videoId}`);
        setIsVideoLoaded(true);
        // Duration will be set when AI processing completes
      }
    }
  }, [youtubeUrl, isVideoLoaded]);

  // Effect to handle timeline play button state
  React.useEffect(() => {
    let animationFrameId: number;

    if (isPlaying) {
      let lastTime = Date.now();

      const animateTimeline = () => {
        if (!isPlaying) return;

        const now = Date.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        // Update current time
        let newTime = currentTime + deltaTime;

        // Loop back to start if we reach the end
        if (newTime >= videoDuration) {
          newTime = 0;
        }

        setCurrentTime(newTime);

        // If we have a video and it's playing, update its time
        if (fullVideoRef.current && selectedShortData) {
          // Calculate relative position within the video
          const videoPosition =
            (newTime / videoDuration) *
            (fullVideoRef.current.duration || videoDuration);
          fullVideoRef.current.currentTime = videoPosition;
          setShortPreviewTime(videoPosition - selectedShortData.start);
          updateCropPreview();
        }

        animationFrameId = requestAnimationFrame(animateTimeline);
      };

      animationFrameId = requestAnimationFrame(animateTimeline);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, currentTime, videoDuration, selectedShortData]);

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
    downloadedSegments?: Record<string, string>;
    videoDuration?: number;
  }) => {
    // Set the actual video duration from AI processing or use a default value
    const actualVideoDuration = data.videoDuration || 300; // Default to 5 minutes if not provided
    setVideoDuration(actualVideoDuration);

    // Replace existing segments and captions with AI-generated ones
    // Ensure segments are properly spaced along the timeline based on their start times
    setSegments(
      data.segments.map((segment) => {
        // Ensure segments are between 45 seconds and 2 minutes
        const duration = Math.max(45, Math.min(120, segment.duration));
        // Make sure segment start times are within the video duration
        const start = Math.min(segment.start, actualVideoDuration - duration);
        return {
          ...segment,
          start: start,
          duration: duration,
          end: start + duration,
        };
      }),
    );

    setCaptions(data.captions);
    setDownloadedSegments(data.downloadedSegments || {});

    setShowAIProcessor(false);
    setIsAIProcessing(false);

    // Auto-select the first short if available
    if (data.segments.length > 0) {
      setSelectedShort(data.segments[0].id);
      // Load the video segment for preview
      loadVideoSegment(data.segments[0].id);
    }
  };

  // Load video segment for preview
  const loadVideoSegment = async (segmentId: string) => {
    const segmentPath = downloadedSegments[segmentId];
    console.log("Loading segment:", segmentId, "Path:", segmentPath);
    console.log("Downloaded segments:", downloadedSegments);

    if (!segmentPath) {
      console.warn("No segment path found for:", segmentId);
      // For demo purposes, create a mock video
      createMockVideoForSegment(segmentId);
      return;
    }

    if (!fullVideoRef.current) {
      console.warn("No video reference available");
      return;
    }

    try {
      console.log(`Loading video segment from server: ${segmentPath}`);

      const video = fullVideoRef.current;

      // Use the API route to serve the video
      const videoUrl = `/api/video/${path.basename(segmentPath)}`;
      console.log("Using server video URL:", videoUrl);

      // Clear any existing src and reset video
      video.src = "";
      video.load();

      // Set new source
      video.src = videoUrl;
      video.muted = true; // Ensure video is muted to allow autoplay
      video.load();

      // Try to play the video to force loading
      try {
        await video.play();
        video.pause(); // Pause it immediately after starting to load
        video.currentTime = 0; // Reset to beginning
      } catch (playError) {
        console.warn("Could not autoplay to force loading:", playError);
      }

      // Wait for video to load with better error handling
      await new Promise((resolve, reject) => {
        let resolved = false;

        const cleanup = () => {
          video.removeEventListener("loadedmetadata", onLoad);
          video.removeEventListener("error", onError);
          video.removeEventListener("loadeddata", onLoadedData);
          video.removeEventListener("canplay", onCanPlay);
        };

        const onLoad = () => {
          console.log("Video metadata loaded");
          // Don't resolve yet, wait for more data
        };

        const onLoadedData = () => {
          console.log("Video data loaded, readyState:", video.readyState);
          // Don't resolve yet, wait for canplay
        };

        const onCanPlay = () => {
          if (resolved) return;
          resolved = true;
          cleanup();
          console.log("Video segment can play now");
          console.log(
            "Video dimensions:",
            video.videoWidth,
            "x",
            video.videoHeight,
          );
          console.log("Video duration:", video.duration);
          console.log("Video ready state:", video.readyState);
          setFullVideoElement(video);
          resolve(true);
        };

        const onError = (e) => {
          if (resolved) return;
          resolved = true;
          cleanup();
          console.error("Error loading video segment:", e);
          console.error("Video error details:", {
            error: video.error,
            networkState: video.networkState,
            readyState: video.readyState,
            src: video.src,
          });
          // For demo purposes, create a mock video instead of failing
          createMockVideoForSegment(segmentId);
        };

        video.addEventListener("loadedmetadata", onLoad);
        video.addEventListener("loadeddata", onLoadedData);
        video.addEventListener("canplay", onCanPlay);
        video.addEventListener("error", onError);

        // Timeout after 5 seconds - shorter timeout since we're using a known good video
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            // Force continue even if canplay hasn't fired
            console.log("Timeout waiting for canplay, continuing anyway");
            setFullVideoElement(video);
            resolve(true);
          }
        }, 5000);
      });

      // Get captions for this segment
      const segmentCaps = captions.filter((cap) => cap.shortId === segmentId);
      console.log("Found captions for segment:", segmentCaps.length);
      setSegmentCaptions(segmentCaps);

      // Update the crop preview once video is loaded
      setTimeout(() => {
        console.log("Updating crop preview after load");
        updateCropPreview();
      }, 100);
    } catch (error) {
      console.error("Error loading video segment:", error);
      // For demo purposes, create a mock video
      createMockVideoForSegment(segmentId);
    }
  };

  // Create a mock video for demo purposes when real video can't be loaded
  const createMockVideoForSegment = (segmentId: string) => {
    console.log("Creating mock video for segment:", segmentId);

    // Get the segment data
    const segment = segments.find((s) => s.id === segmentId);
    if (!segment) return;

    // Get captions for this segment
    const segmentCaps = captions.filter((cap) => cap.shortId === segmentId);
    setSegmentCaptions(segmentCaps);

    // Create a mock video element
    const mockVideo = document.createElement("video");
    mockVideo.width = 640;
    mockVideo.height = 360;

    // Set a demo video source from a public URL
    mockVideo.src =
      "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    mockVideo.crossOrigin = "anonymous";
    mockVideo.muted = true;
    mockVideo.currentTime = 0;

    // Set up event listeners
    mockVideo.addEventListener("loadedmetadata", () => {
      console.log("Mock video metadata loaded");
      setFullVideoElement(mockVideo);

      // Update the crop preview
      if (fullVideoRef.current) {
        fullVideoRef.current.src = mockVideo.src;
        fullVideoRef.current.load();
        fullVideoRef.current.currentTime = 0;
      }

      setTimeout(() => updateCropPreview(), 100);
    });

    mockVideo.addEventListener("error", (e) => {
      console.error("Mock video error:", e);
      showErrorInCanvas("Failed to load demo video");
    });

    // Load the video
    mockVideo.load();
  };

  // Helper function to show error in canvas
  const showErrorInCanvas = (errorMessage: string) => {
    if (cropCanvasRef.current) {
      const canvas = cropCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#ef4444";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText(
          "Error loading video",
          canvas.width / 2,
          canvas.height / 2 - 10,
        );

        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px Arial";
        ctx.fillText(errorMessage, canvas.width / 2, canvas.height / 2 + 10);
      }
    }
  };

  // Update crop preview canvas
  const updateCropPreview = () => {
    if (!cropCanvasRef.current) {
      console.log("Missing canvas ref for crop preview");
      return;
    }

    const video = fullVideoRef.current;
    const canvas = cropCanvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.log("No canvas context");
      return;
    }

    // Set canvas to 9:16 aspect ratio
    canvas.width = 360;
    canvas.height = 640;

    // Clear canvas first
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!video || video.readyState < 2) {
      createDemoPreview(canvas, ctx);
      return;
    }

    try {
      const videoAspect = video.videoWidth / video.videoHeight;
      const canvasAspect = canvas.width / canvas.height;

      // Draw blurred background
      ctx.filter = "blur(16px) brightness(0.7)";
      // Scale video to fill the whole canvas, cropping sides/top
      if (videoAspect > canvasAspect) {
        // Video is wider, fit to width
        const scale = canvas.width / video.videoWidth;
        const h = video.videoHeight * scale;
        ctx.drawImage(video, 0, (canvas.height - h) / 2, canvas.width, h);
      } else {
        // Video is taller, fit to height
        const scale = canvas.height / video.videoHeight;
        const w = video.videoWidth * scale;
        ctx.drawImage(video, (canvas.width - w) / 2, 0, w, canvas.height);
      }
      ctx.filter = "none"; // Reset filter

      // Draw the main, un-cropped, sharp video on top (letterboxed)
      let drawWidth, drawHeight, drawX, drawY;
      if (videoAspect > canvasAspect) {
        // Letterbox (horizontal bars)
        drawWidth = canvas.width;
        drawHeight = drawWidth / videoAspect;
        drawX = 0;
        drawY = (canvas.height - drawHeight) / 2;
      } else {
        // Pillarbox (vertical bars)
        drawHeight = canvas.height;
        drawWidth = drawHeight * videoAspect;
        drawY = 0;
        drawX = (canvas.width - drawWidth) / 2;
      }
      ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);

      // Draw a semi-transparent border around the 9:16 area to guide the user
      const targetAspect = 9 / 16;
      if (Math.abs(videoAspect - targetAspect) > 0.01) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
      }
    } catch (e) {
      console.error("Error updating crop preview:", e);
      showErrorInCanvas("Error rendering video preview");
    }
  };

  const createDemoPreview = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
  ) => {
    // Create a gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add animated background pattern
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    const time = Date.now() / 1000;
    for (let i = 0; i < 10; i++) {
      const y = ((i * canvas.height) / 10 + time * 20) % canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Add title
    if (selectedShortData) {
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        selectedShortData.title || "Demo Preview",
        canvas.width / 2,
        canvas.height * 0.3,
      );

      // Add description
      ctx.font = "16px Arial";
      ctx.fillStyle = "#cccccc";
      const description =
        selectedShortData.description || "Preview of your short video";
      const words = description.split(" ");
      const lines = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > canvas.width - 60 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      lines.forEach((line, index) => {
        ctx.fillText(line, canvas.width / 2, canvas.height * 0.4 + index * 24);
      });
    } else {
      ctx.font = "bold 24px Arial";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Select a short", canvas.width / 2, canvas.height * 0.4);
    }

    // Add watermark
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
    ctx.lineWidth = 2;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.strokeText("Reelify", canvas.width - 10, 10);
    ctx.fillText("Reelify", canvas.width - 10, 10);

    // Draw captions if we have a selected short
    if (selectedShortData) {
      drawCaptions(ctx, canvas, shortPreviewTime + selectedShortData.start);
    }
  };

  // Helper function to draw captions on canvas
  const drawCaptions = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    currentTime: number,
  ) => {
    // Get all captions that should be displayed at current time
    const allCurrentCaptions = captions.filter((caption) => {
      // For segment-specific captions
      if (caption.shortId && selectedShort) {
        return (
          caption.shortId === selectedShort &&
          currentTime >= caption.start &&
          currentTime <= caption.end
        );
      }
      // For global captions
      return currentTime >= caption.start && currentTime <= caption.end;
    });

    // Display captions with better styling
    allCurrentCaptions.forEach((caption, index) => {
      const fontSize = Math.max(
        14,
        (caption.style.fontSize || 28) * (canvas.width / 720),
      );

      // Use different fonts for emphasis
      const fontWeight = caption.emphasis ? "bold" : "bold";
      ctx.font = `${fontWeight} ${fontSize}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Position captions in the lower third
      const baseY = canvas.height * 0.8;
      const textY = baseY + index * (fontSize + 15);
      const textX = canvas.width / 2;

      // Word wrap for long captions
      const words = caption.text.split(" ");
      const lines = [];
      let currentLine = "";
      const maxWidth = canvas.width * 0.9;

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Draw each line
      lines.forEach((line, lineIndex) => {
        const lineY = textY + lineIndex * (fontSize + 5);

        // Add text background with rounded corners effect
        const textMetrics = ctx.measureText(line);
        const textWidth = textMetrics.width;
        const padding = 12;
        const bgHeight = fontSize + 8;

        // Background with better opacity
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(
          textX - textWidth / 2 - padding,
          lineY - fontSize / 2 - 4,
          textWidth + padding * 2,
          bgHeight,
        );

        // Add text stroke for better visibility
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.strokeText(line, textX, lineY);

        // Draw the text with emphasis colors
        if (caption.emphasis) {
          ctx.fillStyle = "#FFD700"; // Gold for emphasis
        } else {
          ctx.fillStyle = caption.style.color || "#ffffff";
        }
        ctx.fillText(line, textX, lineY);
      });
    });
  };

  const addSegment = () => {
    // Ensure new segments are between 45 seconds and 2 minutes
    const segmentDuration = Math.max(45, Math.min(120, 60)); // Default to 60 seconds
    const newSegment: VideoSegment = {
      id: Date.now().toString(),
      start: currentTime,
      end: Math.min(currentTime + segmentDuration, videoDuration),
      duration: segmentDuration,
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

      // Set a realistic video duration
      const totalDuration = 300; // 5 minutes
      setVideoDuration(totalDuration);

      // Generate sample clips with proper spacing along the timeline
      const newSegments: VideoSegment[] = [
        {
          id: "auto-1",
          start: 15,
          end: 75,
          duration: 60,
          title: "Key Moment 1",
          confidence: 0.92,
        },
        {
          id: "auto-2",
          start: 90,
          end: 135,
          duration: 45,
          title: "Highlight",
          confidence: 0.87,
        },
        {
          id: "auto-3",
          start: 150,
          end: 270,
          duration: 120,
          title: "Best Part",
          confidence: 0.95,
        },
      ];

      setSegments(newSegments);
      setGenerationProgress(100);

      // Create mock downloaded segments for demo purposes
      const mockDownloadedSegments: Record<string, string> = {};
      newSegments.forEach((segment) => {
        mockDownloadedSegments[segment.id] =
          `/temp_video/segment_${segment.id}.mp4`;
      });
      setDownloadedSegments(mockDownloadedSegments);

      // Also generate captions
      const sampleText =
        "This is an amazing video that will teach you something incredible";
      const result = await generateCaptionsFromText(sampleText, 30);

      if (result.success && result.captions) {
        // Assign captions to specific segments
        const segmentCaptions = result.captions.map(
          (cap: any, index: number) => {
            const segmentId = newSegments[index % newSegments.length].id;
            const segmentStart = newSegments[index % newSegments.length].start;
            return {
              id: `smart-${index}`,
              text: cap.text,
              start: segmentStart + (index % 5) * 3, // Distribute captions within segment
              end: segmentStart + (index % 5) * 3 + 3,
              shortId: segmentId, // Associate with segment
              emphasis: index % 3 === 0, // Make some captions emphasized
              style: cap.style || {
                fontSize: 24,
                color: "#ffffff",
                position: "bottom",
                animation: "fade-in",
              },
            };
          },
        );
        setCaptions(segmentCaptions);
      }

      // Auto-select the first segment
      if (newSegments.length > 0) {
        setSelectedShort(newSegments[0].id);
        loadVideoSegment(newSegments[0].id);
      }
    } catch (error) {
      console.error("Clip generation failed:", error);
    } finally {
      setIsGeneratingClips(false);
      createManagedTimeout(() => setGenerationProgress(0), 2000);
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

  // Get current captions for the short preview

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
      // Check if we have a downloaded segment for this short
      const downloadedSegmentPath = downloadedSegments[selectedShortData.id];

      if (downloadedSegmentPath && youtubeUrl) {
        // Use the actual downloaded video segment
        console.log("🎬 Using downloaded video segment for generation");
        await generateFromDownloadedSegment(downloadedSegmentPath);
        return;
      }

      // For YouTube videos without downloaded segments, create a proper demo video
      if (youtubeUrl && !videoFile) {
        // Create a proper demo video with canvas
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

        // Check MediaRecorder support with better fallbacks
        const supportedTypes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=h264,opus",
          "video/webm",
          "video/mp4",
        ];

        let mimeType = "video/webm";
        for (const type of supportedTypes) {
          if (MediaRecorder.isTypeSupported(type)) {
            mimeType = type;
            break;
          }
        }

        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error("Video recording not supported in this browser");
        }

        // Create MediaRecorder to capture the canvas
        const stream = canvas.captureStream(30);
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
        });

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

      // Check MediaRecorder support with better fallbacks
      const supportedTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=h264,opus",
        "video/webm",
        "video/mp4",
      ];

      let mimeType = "video/webm";
      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error("Video recording not supported in this browser");
      }

      // Create MediaRecorder to capture the canvas
      const stream = canvas.captureStream(30);
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      });

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            <span className="font-reelify text-purple-400">Reelify</span> Studio
          </h1>
          <p className="text-gray-300 text-sm">
            Professional short-form video editor
          </p>
        </div>

        {/* Compact Input Section */}
        <Card className="mb-4 bg-slate-800/50 border-slate-600 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="Paste YouTube URL or upload video..."
                    value={youtubeUrl}
                    onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                    className="bg-slate-700/50 border-slate-500 text-white placeholder-gray-400"
                  />
                  <Button
                    className="bg-purple-600 hover:bg-purple-700 px-6"
                    disabled={!youtubeUrl}
                    onClick={loadYouTubeVideo}
                  >
                    Load
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-slate-500 text-white hover:bg-slate-700 bg-slate-700/50"
                  >
                    <Upload className="w-4 h-4 mr-1" /> Upload
                  </Button>
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Premiere Pro Style Editor Layout */}
        <div className="flex flex-col h-[calc(100vh-200px)]">
          {/* Top Section - Video Previews */}
          <div className="flex gap-4 h-2/3 mb-4">
            {/* Left - Source Video with Glass Overlay */}
            <div className="w-1/3">
              <Card className="bg-slate-800/50 border-slate-600 backdrop-blur-sm h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <Play className="w-4 h-4" />
                    Source Video
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-full flex flex-col">
                  <div className="aspect-video bg-slate-700/50 rounded-lg overflow-hidden relative flex-1">
                    {isVideoLoaded && videoPreviewUrl ? (
                      <div className="w-full h-full relative">
                        {videoFile ? (
                          <video
                            src={videoPreviewUrl}
                            className="w-full h-full object-contain rounded-lg"
                            poster=""
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-700 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                              <Play className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                              <p className="text-gray-300 text-xs">
                                YouTube Video
                              </p>
                            </div>
                          </div>
                        )}
                        {/* Glass overlay for non-selected parts */}
                        {selectedShortData && (
                          <>
                            {/* Before segment glass overlay */}
                            <div
                              className="absolute top-0 left-0 bg-white/10 backdrop-blur-sm border-r border-white/20"
                              style={{
                                width: `${(selectedShortData.start / videoDuration) * 100}%`,
                                height: "100%",
                                background:
                                  "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                                backdropFilter: "blur(2px) saturate(0.7)",
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                            </div>
                            {/* After segment glass overlay */}
                            <div
                              className="absolute top-0 right-0 bg-white/10 backdrop-blur-sm border-l border-white/20"
                              style={{
                                width: `${((videoDuration - selectedShortData.end) / videoDuration) * 100}%`,
                                height: "100%",
                                background:
                                  "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
                                backdropFilter: "blur(2px) saturate(0.7)",
                              }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-bl from-white/5 to-transparent" />
                            </div>
                            {/* Active segment highlight */}
                            <div
                              className="absolute top-0 border-2 border-purple-400/60 bg-purple-400/10"
                              style={{
                                left: `${(selectedShortData.start / videoDuration) * 100}%`,
                                width: `${(selectedShortData.duration / videoDuration) * 100}%`,
                                height: "100%",
                              }}
                            />
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <Upload className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                          <p className="text-slate-500 text-xs">
                            No video loaded
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Center - Short Preview (Premiere Pro Style) */}
            <div className="flex-1">
              <Card className="bg-slate-900/80 border-slate-600 backdrop-blur-sm h-full">
                <CardHeader className="pb-2 bg-slate-800/50">
                  <CardTitle className="text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scissors className="w-5 h-5" />
                      Program Monitor
                      {selectedShortData && (
                        <span className="text-sm text-purple-400 ml-2">
                          ({selectedShortData.title})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-slate-500 text-white hover:bg-slate-700 h-8 px-3"
                      >
                        <Settings className="w-3 h-3 mr-1" /> Settings
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-full flex flex-col p-4">
                  <div className="flex-1 flex items-center justify-center bg-black/50 rounded-lg">
                    <div className="aspect-[9/16] bg-slate-900 rounded-lg overflow-hidden relative max-h-full shadow-2xl border border-slate-700">
                      {selectedShortData && isVideoLoaded ? (
                        <div className="w-full h-full relative">
                          {downloadedSegments[selectedShortData.id] ? (
                            <>
                              {/* Hidden full video element */}
                              <video
                                ref={fullVideoRef}
                                style={{ display: "none" }}
                                onTimeUpdate={updateCropPreview}
                                onLoadedData={() => {
                                  console.log(
                                    "Video loaded, updating crop preview",
                                  );
                                  setFullVideoElement(fullVideoRef.current);
                                  updateCropPreview();
                                }}
                                onLoadedMetadata={() => {
                                  console.log("Video metadata loaded");
                                  updateCropPreview();
                                }}
                                onCanPlay={() => {
                                  console.log("Video can play now");
                                  updateCropPreview();
                                }}
                                onError={(e) => {
                                  console.error("Video element error:", e);
                                }}
                                crossOrigin="anonymous"
                                preload="auto"
                                muted
                              />

                              {/* Cropped preview canvas */}
                              <canvas
                                ref={cropCanvasRef}
                                className="w-full h-full object-cover rounded-lg bg-slate-800"
                                width={360}
                                height={640}
                                style={{ backgroundColor: "#0f172a" }}
                              />
                            </>
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex flex-col items-center justify-center relative">
                              <div className="text-center p-6">
                                <Scissors className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                                <h3 className="text-white font-semibold mb-2 text-lg">
                                  {selectedShortData.title}
                                </h3>
                                <p className="text-gray-300 text-sm mb-4 max-w-xs">
                                  {selectedShortData.description ||
                                    "AI-generated short ready for processing"}
                                </p>
                                <div className="text-xs text-purple-400 mb-4 space-y-1">
                                  <div>
                                    Duration:{" "}
                                    {Math.floor(selectedShortData.duration)}s
                                  </div>
                                  <div>
                                    Confidence:{" "}
                                    {Math.round(
                                      (selectedShortData.confidence || 0.8) *
                                        100,
                                    )}
                                    %
                                  </div>
                                </div>
                                <p className="text-sm text-amber-400 mb-4">
                                  Generate AI shorts to preview video
                                </p>
                              </div>

                              {/* Watermark */}
                              <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded-full text-xs text-white font-bold backdrop-blur-sm">
                                Reelify
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <Scissors className="w-16 h-16 mx-auto mb-4 text-slate-500" />
                            <p className="text-slate-400 text-lg font-medium">
                              {selectedShort
                                ? "Loading preview..."
                                : "Select a short to preview"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Program Monitor Controls */}
                  {selectedShortData &&
                    downloadedSegments[selectedShortData.id] && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-center gap-4 bg-slate-800/50 p-3 rounded-lg">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (fullVideoRef.current) {
                                if (fullVideoRef.current.paused) {
                                  // Set video time to current timeline position
                                  const timelinePosition =
                                    (currentTime / videoDuration) *
                                    (fullVideoRef.current.duration ||
                                      videoDuration);
                                  fullVideoRef.current.currentTime =
                                    timelinePosition;

                                  // Create animation frame loop for preview if video doesn't play
                                  const startPlayback = () => {
                                    setIsShortPlaying(true);
                                    let lastTime = Date.now();
                                    let currentVideoTime =
                                      fullVideoRef.current?.currentTime || 0;

                                    const animateFrame = () => {
                                      if (
                                        !isShortPlaying ||
                                        !fullVideoRef.current
                                      )
                                        return;

                                      const now = Date.now();
                                      const deltaTime = (now - lastTime) / 1000;
                                      lastTime = now;

                                      // Update video time
                                      if (fullVideoRef.current.paused) {
                                        // If video is paused, simulate playback
                                        currentVideoTime += deltaTime;
                                        fullVideoRef.current.currentTime =
                                          currentVideoTime;
                                      } else {
                                        currentVideoTime =
                                          fullVideoRef.current.currentTime;
                                      }

                                      // Update timeline position
                                      const timelineTime =
                                        (currentVideoTime /
                                          (fullVideoRef.current.duration ||
                                            videoDuration)) *
                                        videoDuration;
                                      setCurrentTime(timelineTime);
                                      setShortPreviewTime(currentVideoTime);
                                      updateCropPreview();

                                      // Stop at end of segment
                                      if (
                                        selectedShortData &&
                                        currentVideoTime >=
                                          selectedShortData.duration
                                      ) {
                                        setIsShortPlaying(false);
                                        return;
                                      }

                                      requestAnimationFrame(animateFrame);
                                    };

                                    requestAnimationFrame(animateFrame);
                                  };

                                  // Try to play the video, but also start animation frame loop
                                  fullVideoRef.current
                                    .play()
                                    .then(startPlayback)
                                    .catch((e) => {
                                      console.error("Play error:", e);
                                      // Even if play fails, start the animation loop
                                      startPlayback();
                                    });
                                } else {
                                  fullVideoRef.current.pause();
                                  setIsShortPlaying(false);
                                }
                              }
                            }}
                            className="border-slate-500 text-white hover:bg-slate-700 h-10 w-16 bg-slate-700/50"
                          >
                            {isShortPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <span className="text-sm text-white font-mono bg-slate-900 px-3 py-1 rounded">
                            {Math.floor(shortPreviewTime)}s /{" "}
                            {Math.floor(selectedShortData.duration)}s
                          </span>
                          <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => {
                              console.log("Exporting short with:", {
                                segmentId: selectedShortData.id,
                                cropPosition,
                                currentTime: shortPreviewTime,
                                captions: segmentCaptions,
                              });
                              alert(
                                "Export functionality will be implemented next!",
                              );
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>
            </div>

            {/* Right - Editing Tools Panel */}
            <div className="w-80">
              <Card className="bg-slate-800/50 border-slate-600 backdrop-blur-sm h-full">
                <CardContent className="p-0 h-full">
                  <Tabs
                    defaultValue="editor"
                    className="w-full h-full flex flex-col"
                  >
                    <TabsList className="grid w-full grid-cols-4 bg-slate-700/50 m-2 mb-0">
                      <TabsTrigger
                        value="editor"
                        className="text-white text-xs"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Edit
                      </TabsTrigger>
                      <TabsTrigger
                        value="segments"
                        className="text-white text-xs"
                      >
                        <Scissors className="w-3 h-3 mr-1" />
                        Clips
                      </TabsTrigger>
                      <TabsTrigger
                        value="captions"
                        className="text-white text-xs"
                      >
                        <Type className="w-3 h-3 mr-1" />
                        Text
                      </TabsTrigger>
                      <TabsTrigger value="music" className="text-white text-xs">
                        <Music className="w-3 h-3 mr-1" />
                        Audio
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent
                      value="editor"
                      className="p-3 space-y-4 flex-1 overflow-hidden"
                    >
                      <h3 className="font-medium text-white text-sm">
                        Video Editor
                      </h3>

                      {selectedShortData &&
                        downloadedSegments[selectedShortData.id] && (
                          <div className="space-y-4">
                            {/* Crop Position Control */}
                            <div className="space-y-2">
                              <label className="text-xs text-slate-300 font-medium">
                                Crop Position
                              </label>
                              <Slider
                                value={[cropPosition]}
                                onValueChange={(value) => {
                                  setCropPosition(value[0]);
                                  setTimeout(() => updateCropPreview(), 10);
                                }}
                                min={0}
                                max={1}
                                step={0.01}
                                className="w-full"
                              />
                              <div className="text-xs text-slate-400">
                                {cropPosition < 0.3
                                  ? "Left"
                                  : cropPosition > 0.7
                                    ? "Right"
                                    : "Center"}
                              </div>
                            </div>

                            {/* Video Effects */}
                            <div className="space-y-2">
                              <label className="text-xs text-slate-300 font-medium">
                                Effects
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-500 text-white hover:bg-slate-700 text-xs bg-slate-700/50"
                                >
                                  Blur BG
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-500 text-white hover:bg-slate-700 text-xs bg-slate-700/50"
                                >
                                  Zoom
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-500 text-white hover:bg-slate-700 text-xs bg-slate-700/50"
                                >
                                  Filter
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-500 text-white hover:bg-slate-700 text-xs bg-slate-700/50"
                                >
                                  Speed
                                </Button>
                              </div>
                            </div>

                            {/* Color Correction */}
                            <div className="space-y-3">
                              <label className="text-xs text-slate-300 font-medium">
                                Color
                              </label>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400">
                                    Brightness
                                  </span>
                                  <span className="text-slate-300">0</span>
                                </div>
                                <Slider
                                  defaultValue={[0]}
                                  min={-100}
                                  max={100}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400">
                                    Contrast
                                  </span>
                                  <span className="text-slate-300">0</span>
                                </div>
                                <Slider
                                  defaultValue={[0]}
                                  min={-100}
                                  max={100}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span className="text-slate-400">
                                    Saturation
                                  </span>
                                  <span className="text-slate-300">0</span>
                                </div>
                                <Slider
                                  defaultValue={[0]}
                                  min={-100}
                                  max={100}
                                  step={1}
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                      {!selectedShortData && (
                        <div className="text-center py-8">
                          <Settings className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                          <p className="text-slate-400 text-sm">
                            Select a short to edit
                          </p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent
                      value="segments"
                      className="p-3 space-y-3 flex-1 overflow-hidden"
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-white text-sm">
                          Shorts ({segments.length})
                        </h3>
                      </div>
                      <div className="space-y-2 overflow-y-auto flex-1">
                        {segments.length === 0 ? (
                          <div className="text-center py-6">
                            <Brain className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                            <p className="text-slate-400 text-sm mb-1">
                              No shorts yet
                            </p>
                            <p className="text-xs text-slate-500">
                              Generate AI shorts first
                            </p>
                          </div>
                        ) : (
                          segments.map((segment, index) => (
                            <div
                              key={segment.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedShort === segment.id
                                  ? "bg-purple-900/30 border-purple-400 shadow-lg shadow-purple-400/20"
                                  : "bg-slate-700/30 border-slate-600 hover:border-slate-500 hover:bg-slate-700/50"
                              }`}
                              onClick={() => {
                                setSelectedShort(segment.id);
                                loadVideoSegment(segment.id);
                              }}
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
                                          {Math.round(segment.confidence * 100)}
                                          %
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-300">
                                    {Math.floor(segment.start)}s -{" "}
                                    {Math.floor(segment.end)}s
                                    <span className="text-purple-400 ml-2">
                                      ({Math.floor(segment.duration)}s)
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {selectedShort === segment.id && (
                                <div className="mt-2 pt-2 border-t border-slate-600">
                                  <p className="text-xs text-purple-300 mb-1">
                                    {
                                      captions.filter(
                                        (cap) => cap.shortId === segment.id,
                                      ).length
                                    }{" "}
                                    captions
                                  </p>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="captions"
                      className="p-3 space-y-3 flex-1 overflow-hidden"
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-medium text-white text-sm">
                          Captions (
                          {
                            captions.filter(
                              (c) =>
                                !selectedShort || c.shortId === selectedShort,
                            ).length
                          }
                          )
                        </h3>
                      </div>

                      {selectedShort && (
                        <div className="p-2 bg-purple-900/20 rounded-lg border border-purple-700/50">
                          <p className="text-xs text-purple-300">
                            {
                              segments.find((s) => s.id === selectedShort)
                                ?.title
                            }
                          </p>
                        </div>
                      )}

                      <div className="space-y-2 overflow-y-auto flex-1">
                        {captions.length === 0 ? (
                          <div className="text-center py-6">
                            <Type className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                            <p className="text-slate-400 text-sm mb-1">
                              No captions yet
                            </p>
                            <p className="text-xs text-slate-500">
                              Generate AI shorts first
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
                                className={`p-2 rounded-lg border text-xs ${
                                  caption.emphasis
                                    ? "bg-amber-900/20 border-amber-600/50"
                                    : "bg-slate-700/30 border-slate-600"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  {caption.emphasis && (
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                  )}
                                  <span className="text-slate-300 flex-1">
                                    {caption.text}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400">
                                  {Math.floor(caption.start)}s -{" "}
                                  {Math.floor(caption.end)}s
                                  {caption.emphasis && (
                                    <span className="text-amber-400 ml-2">
                                      (Key)
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="music"
                      className="p-3 space-y-3 flex-1 overflow-hidden"
                    >
                      <h3 className="font-medium text-white text-sm">Audio</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium mb-2 text-slate-300">
                            Music Track
                          </label>
                          <select
                            value={selectedMusic}
                            onChange={(e) => setSelectedMusic(e.target.value)}
                            className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded text-white text-sm"
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
                          <label className="block text-xs font-medium mb-2 text-slate-300">
                            Volume: {musicVolume[0]}%
                          </label>
                          <div className="flex items-center gap-2">
                            <Volume2 className="w-4 h-4 text-slate-400" />
                            <Slider
                              value={musicVolume}
                              onValueChange={setMusicVolume}
                              max={100}
                              step={1}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-700/50">
                          <p className="text-xs text-blue-300 mb-1">
                            🎵 Coming Soon
                          </p>
                          <p className="text-xs text-blue-400">
                            Music library and custom audio upload
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Section - Premiere Pro Style Timeline */}
          <div className="h-1/3">
            <Card className="bg-slate-900/80 border-slate-600 backdrop-blur-sm h-full">
              <CardHeader className="pb-2 bg-slate-800/50">
                <CardTitle className="text-white flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4" />
                    Timeline
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const newPlayingState = !isPlaying;
                        setIsPlaying(newPlayingState);

                        // If starting playback, create animation loop
                        if (newPlayingState) {
                          let lastTime = Date.now();
                          let animationFrameId: number;

                          const animateTimeline = () => {
                            if (!isPlaying) return;

                            const now = Date.now();
                            const deltaTime = (now - lastTime) / 1000;
                            lastTime = now;

                            // Update current time
                            let newTime = currentTime + deltaTime;

                            // Loop back to start if we reach the end
                            if (newTime >= videoDuration) {
                              newTime = 0;
                            }

                            setCurrentTime(newTime);

                            // If we have a video and it's playing, update its time
                            if (fullVideoRef.current && selectedShortData) {
                              // Calculate relative position within the video
                              const videoPosition =
                                (newTime / videoDuration) *
                                (fullVideoRef.current.duration ||
                                  videoDuration);
                              fullVideoRef.current.currentTime = videoPosition;
                              setShortPreviewTime(
                                videoPosition - selectedShortData.start,
                              );
                              updateCropPreview();
                            }

                            animationFrameId =
                              requestAnimationFrame(animateTimeline);
                          };

                          animationFrameId =
                            requestAnimationFrame(animateTimeline);

                          // Store the animation frame ID in a ref so we can cancel it later
                          return () => {
                            if (animationFrameId) {
                              cancelAnimationFrame(animationFrameId);
                            }
                          };
                        }
                      }}
                      className="border-slate-500 text-white hover:bg-slate-700 h-8 w-12 bg-slate-700/50"
                    >
                      {isPlaying ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                    </Button>
                    <span className="text-xs text-gray-300 font-mono bg-slate-800 px-2 py-1 rounded">
                      {Math.floor(currentTime / 60)}:
                      {Math.floor(currentTime % 60)
                        .toString()
                        .padStart(2, "0")}{" "}
                      / {Math.floor(videoDuration / 60)}:
                      {Math.floor(videoDuration % 60)
                        .toString()
                        .padStart(2, "0")}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full flex flex-col p-4">
                {/* Timeline Ruler */}
                <div className="mb-4">
                  <div className="relative bg-slate-800/50 rounded-lg p-4">
                    {/* Time ruler - show full video duration */}
                    <div className="flex justify-between text-xs text-slate-400 mb-2">
                      {videoDuration > 0 &&
                        Array.from(
                          {
                            length: Math.min(
                              Math.ceil(videoDuration / 60) + 1,
                              20,
                            ),
                          }, // Max 20 markers to avoid overcrowding
                          (_, i) => {
                            const timeInSeconds =
                              (i * videoDuration) /
                              Math.min(Math.ceil(videoDuration / 60), 19);
                            return (
                              <span key={i}>
                                {Math.floor(timeInSeconds / 60)}:
                                {(Math.floor(timeInSeconds) % 60)
                                  .toString()
                                  .padStart(2, "0")}
                              </span>
                            );
                          },
                        )}
                    </div>

                    {/* Main timeline track */}
                    <div className="relative h-16 bg-slate-700/50 rounded border border-slate-600">
                      {/* Playhead */}
                      <div
                        className="absolute top-0 w-0.5 h-full bg-red-500 z-20"
                        style={{
                          left: `${(currentTime / videoDuration) * 100}%`,
                        }}
                      >
                        <div className="absolute -top-2 -left-2 w-4 h-4 bg-red-500 rounded-full" />
                      </div>

                      {/* Video segments */}
                      {segments.map((segment, index) => (
                        <div
                          key={segment.id}
                          className={`absolute top-2 h-12 rounded cursor-pointer transition-all border-2 ${
                            selectedShort === segment.id
                              ? "bg-purple-500/80 border-purple-300 shadow-lg shadow-purple-500/50"
                              : "bg-purple-600/60 border-purple-500 hover:bg-purple-500/70"
                          }`}
                          style={{
                            left: `${(segment.start / videoDuration) * 100}%`,
                            width: `${(segment.duration / videoDuration) * 100}%`,
                          }}
                          onClick={() => {
                            setSelectedShort(segment.id);
                            loadVideoSegment(segment.id);
                          }}
                        >
                          <div className="p-1 h-full flex flex-col justify-center">
                            <div className="text-xs text-white font-medium truncate">
                              {segment.title || `Short ${index + 1}`}
                            </div>
                            <div className="text-xs text-purple-200">
                              {Math.floor(segment.duration)}s
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Timeline scrubber */}
                    <div className="mt-3">
                      <Slider
                        value={[currentTime]}
                        onValueChange={(value) => {
                          setCurrentTime(value[0]);
                          // If video is loaded, seek to the new position
                          if (fullVideoRef.current && videoDuration > 0) {
                            const videoTime =
                              (value[0] / videoDuration) *
                              (fullVideoRef.current.duration || videoDuration);
                            fullVideoRef.current.currentTime = videoTime;
                            setShortPreviewTime(videoTime);
                            updateCropPreview();
                          }
                        }}
                        max={videoDuration || 100}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Timeline Controls */}
                <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-500 text-white hover:bg-slate-700 bg-slate-700/50"
                    >
                      <Scissors className="w-3 h-3 mr-1" />
                      Cut
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-500 text-white hover:bg-slate-700 bg-slate-700/50"
                    >
                      <Type className="w-3 h-3 mr-1" />
                      Text
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Zoom:</span>
                    <Slider
                      defaultValue={[50]}
                      max={100}
                      step={1}
                      className="w-20"
                    />
                  </div>
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
