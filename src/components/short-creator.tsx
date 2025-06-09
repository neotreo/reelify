"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
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
} from "lucide-react";

interface VideoSegment {
  id: string;
  start: number;
  end: number;
  duration: number;
}

interface Caption {
  id: string;
  text: string;
  start: number;
  end: number;
  style: {
    fontSize: number;
    color: string;
    position: string;
    animation: string;
  };
}

export default function ShortCreator() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(100);
  const [segments, setSegments] = useState<VideoSegment[]>([
    { id: "1", start: 10, end: 25, duration: 15 },
    { id: "2", start: 45, end: 60, duration: 15 },
  ]);
  const [captions, setCaptions] = useState<Caption[]>([
    {
      id: "1",
      text: "Amazing moment here!",
      start: 10,
      end: 15,
      style: {
        fontSize: 24,
        color: "#ffffff",
        position: "bottom",
        animation: "fade-in",
      },
    },
  ]);
  const [musicVolume, setMusicVolume] = useState([50]);
  const [selectedMusic, setSelectedMusic] = useState("trending-beat-1");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Short Creator Studio</h1>
          <p className="text-gray-300">
            Transform your videos into viral shorts with our powerful editor
          </p>
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
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="bg-gray-800 border-gray-600 text-white"
                  />
                  <Button className="bg-purple-600 hover:bg-purple-700">
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

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Video Preview */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Video Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-gray-800 rounded-lg mb-4 flex items-center justify-center">
                  {videoFile || youtubeUrl ? (
                    <div className="text-center">
                      <Play className="w-16 h-16 mx-auto mb-2 text-purple-400" />
                      <p className="text-gray-300">Video Preview</p>
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
                        Video Segments
                      </h3>
                      <Button
                        size="sm"
                        onClick={addSegment}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Add Clip
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {segments.map((segment, index) => (
                        <div
                          key={segment.id}
                          className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-white">
                              Clip {index + 1}
                            </span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeSegment(segment.id)}
                            >
                              Remove
                            </Button>
                          </div>
                          <div className="text-xs text-gray-300">
                            {segment.start}s - {segment.end}s (
                            {segment.duration}
                            s)
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="captions" className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-white">Captions</h3>
                      <Button
                        size="sm"
                        onClick={addCaption}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        Add Caption
                      </Button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {captions.map((caption) => (
                        <div
                          key={caption.id}
                          className="p-3 bg-gray-800 rounded-lg border border-gray-700"
                        >
                          <Textarea
                            value={caption.text}
                            onChange={(e) =>
                              updateCaption(caption.id, {
                                text: e.target.value,
                              })
                            }
                            className="mb-2 bg-gray-700 border-gray-600 text-white text-sm"
                            rows={2}
                          />
                          <div className="flex justify-between items-center text-xs text-gray-300">
                            <span>
                              {caption.start}s - {caption.end}s
                            </span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeCaption(caption.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
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
                      <Button
                        variant="outline"
                        className="w-full border-gray-600 text-white hover:bg-gray-800"
                      >
                        Upload Custom Audio
                      </Button>
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
                <Button className="w-full bg-purple-600 hover:bg-purple-700">
                  <Download className="w-4 h-4 mr-2" />
                  Export Short
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
