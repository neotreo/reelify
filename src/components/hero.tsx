"use client";

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
    <div className="relative overflow-hidden bg-black">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-purple-900 opacity-90" />

      <div className="relative pt-24 pb-32 sm:pt-32 sm:pb-40">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                <Video className="w-4 h-4" />
                <span>YouTube to Shorts Converter</span>
              </div>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold text-white mb-8 tracking-tight text-center">
              Transform{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                YouTube Videos
              </span>{" "}
              into <span className="font-reelify text-purple-400">Reelify</span>{" "}
              Shorts
            </h1>

            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Convert long-form YouTube content into engaging short-form videos
              with AI-powered captions, music, and perfect aspect ratios for
              TikTok, Instagram Reels, and YouTube Shorts.
            </p>

            {/* Live Demo GIF */}
            <div className="mb-12 max-w-4xl mx-auto">
              <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-700">
                <img
                  src="https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&q=80"
                  alt="Reelify Demo"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white text-sm font-medium">
                  ✨ Live Demo: YouTube → TikTok in seconds
                </div>
              </div>
            </div>

            {/* Quick YouTube URL Input */}
            <div className="mb-8 max-w-md mx-auto">
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste YouTube URL here..."
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  id="hero-youtube-url"
                />
                <button
                  onClick={() => {
                    const input = document.getElementById(
                      "hero-youtube-url",
                    ) as HTMLInputElement;
                    const url = input?.value;
                    if (url) {
                      window.location.href = `/dashboard?url=${encodeURIComponent(url)}`;
                    } else {
                      window.location.href = "/dashboard";
                    }
                  }}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Convert Now
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-8 py-4 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors text-lg font-medium"
              >
                <Play className="mr-2 w-5 h-5" />
                Try Free (with watermark)
                <ArrowUpRight className="ml-2 w-5 h-5" />
              </Link>

              <Link
                href="#pricing"
                className="inline-flex items-center px-8 py-4 text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-lg font-medium border border-gray-600"
              >
                View Pricing
              </Link>
            </div>

            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-purple-900 rounded-full flex items-center justify-center">
                  <Scissors className="w-6 h-6 text-purple-400" />
                </div>
                <span className="font-medium text-white">Smart Trimming</span>
                <span className="text-gray-300 text-center">
                  AI-powered clip selection
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center">
                  <Video className="w-6 h-6 text-blue-400" />
                </div>
                <span className="font-medium text-white">Auto Captions</span>
                <span className="text-gray-300 text-center">
                  Customizable text styles
                </span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-pink-900 rounded-full flex items-center justify-center">
                  <Music className="w-6 h-6 text-pink-400" />
                </div>
                <span className="font-medium text-white">Music Library</span>
                <span className="text-gray-300 text-center">
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
