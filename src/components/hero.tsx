import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Play,
  Video,
  Scissors,
  Music,
} from "lucide-react";

export default function Hero() {
  return (
    <div className="relative overflow-hidden bg-white">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-white to-pink-50 opacity-70" />

      <div className="relative pt-24 pb-32 sm:pt-32 sm:pb-40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                <Video className="w-4 h-4" />
                <span>YouTube to Shorts Converter</span>
              </div>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-8 tracking-tight">
              Transform{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-pink-600">
                YouTube Videos
              </span>{" "}
              into Viral Shorts
            </h1>

            <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
              Convert long-form YouTube content into engaging short-form videos
              with AI-powered captions, music, and perfect aspect ratios for
              TikTok, Instagram Reels, and YouTube Shorts.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-8 py-4 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors text-lg font-medium"
              >
                <Play className="mr-2 w-5 h-5" />
                Start Converting
                <ArrowUpRight className="ml-2 w-5 h-5" />
              </Link>

              <Link
                href="#pricing"
                className="inline-flex items-center px-8 py-4 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-lg font-medium"
              >
                View Pricing
              </Link>
            </div>

            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Scissors className="w-6 h-6 text-red-600" />
                </div>
                <span className="font-medium text-gray-900">
                  Smart Trimming
                </span>
                <span className="text-gray-600 text-center">
                  AI-powered clip selection
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Video className="w-6 h-6 text-blue-600" />
                </div>
                <span className="font-medium text-gray-900">Auto Captions</span>
                <span className="text-gray-600 text-center">
                  Customizable text styles
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Music className="w-6 h-6 text-purple-600" />
                </div>
                <span className="font-medium text-gray-900">Music Library</span>
                <span className="text-gray-600 text-center">
                  Trending background tracks
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
