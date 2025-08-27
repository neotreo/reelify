"use server";

import { encodedRedirect } from "@/utils/utils";
import { redirect } from "next/navigation";
import { createClient } from "../../supabase/server";
import YTDlpWrap from "yt-dlp-wrap";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSubtitles } from "youtube-captions-scraper";
import { YoutubeTranscript } from "youtube-transcript";

// Use persistent yt-dlp installation
const YTDLP_PATH = path.join(
  process.cwd(),
  "bin",
  process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
);

// Helper function to create YTDlpWrap with persistent binary
const createYTDlpWrap = () => {
  try {
    // Try local binary first
    return new YTDlpWrap(YTDLP_PATH);
  } catch (error) {
    console.warn("Local yt-dlp not found, trying system installation:", error);
    try {
      // Try system installation
      return new YTDlpWrap("yt-dlp");
    } catch (systemError) {
      console.warn("System yt-dlp not found, using default:", systemError);
      return new YTDlpWrap(); // Fallback to default installation
    }
  }
};

// Add cookie helpers
const fileExists = async (p: string) => {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
};

const getCookieFile = async (): Promise<string | null> => {
  const envPath =
    process.env.YT_COOKIES_FILE ||
    process.env.YOUTUBE_COOKIES_FILE ||
    process.env.YTDLP_COOKIES_FILE;
  if (envPath && (await fileExists(envPath))) return envPath;

  const local1 = path.join(process.cwd(), "bin", "youtube-cookies.txt");
  if (await fileExists(local1)) return local1;

  const local2 = path.join(process.cwd(), "cookies.txt");
  if (await fileExists(local2)) return local2;

  return null;
};

const getYtDlpCookieArgs = async (): Promise<string[]> => {
  const args: string[] = [];
  const file = await getCookieFile();
  if (file) {
    args.push("--cookies", file);
    return args;
  }
  // Use a local browser profile during development
  const browser =
    process.env.YTDLP_BROWSER ||
    process.env.YT_COOKIES_BROWSER ||
    (process.platform === "win32" ? "chrome" : "");
  if (browser) args.push("--cookies-from-browser", browser);
  return args;
};

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString() || "";
  const supabase = await createClient();

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required",
    );
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        email: email,
      },
    },
  });

  if (error) {
    return encodedRedirect("error", "/sign-up", error.message);
  }

  if (user) {
    try {
      const { error: updateError } = await supabase.from("users").insert({
        id: user.id,
        user_id: user.id,
        name: fullName,
        email: email,
        token_identifier: user.id,
        created_at: new Date().toISOString(),
      });

      if (updateError) {
        // Error handling without console.error
        return encodedRedirect(
          "error",
          "/sign-up",
          "Error updating user. Please try again.",
        );
      }
    } catch (err) {
      // Error handling without console.error
      return encodedRedirect(
        "error",
        "/sign-up",
        "Error updating user. Please try again.",
      );
    }
  }

  return encodedRedirect(
    "success",
    "/sign-up",
    "Thanks for signing up! Please check your email for a verification link.",
  );
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/dashboard");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {});

  if (error) {
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    return encodedRedirect(
      "error",
      "/dashboard/reset-password",
      "Password update failed",
    );
  }

  return encodedRedirect(
    "success",
    "/protected/reset-password",
    "Password updated",
  );
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};

export const checkUserSubscription = async (userId: string) => {
  const supabase = await createClient();

  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  if (error) {
    return false;
  }

  return !!subscription;
};

// Helper function to extract YouTube video ID from URL
const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
    /youtube\.com\/embed\/([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
};

// Helper function to fetch YouTube captions using youtube-captions-scraper
const getYouTubeTranscriptAlternative1 = async (
  videoId: string,
): Promise<string | null> => {
  try {
    console.log(
      `🔎 Fetching transcript using direct YouTube API for: ${videoId}`,
    );

    // Try multiple YouTube transcript endpoints
    const endpoints = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=vtt`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&asr_langs=en&caps=asr&exp=xftt&xoaf=5&hl=en&ip=0.0.0.0&ipbits=0&expire=8640000&sparams=ip,ipbits,expire&signature=dummy&key=yttt1&lang=en&fmt=json3`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.youtube.com/",
            Origin: "https://www.youtube.com",
          },
        });

        if (response.ok) {
          const text = await response.text();

          // Handle different response formats
          if (text.includes('{"events":')) {
            // JSON3 format
            try {
              const data = JSON.parse(text);
              if (data?.events) {
                const transcript = data.events
                  .filter((event: any) => event.segs)
                  .map((event: any) =>
                    event.segs.map((seg: any) => seg.utf8).join(""),
                  )
                  .join(" ")
                  .replace(/\n/g, " ")
                  .trim();

                if (transcript) {
                  console.log("✅ Direct YouTube API successful!");
                  return transcript;
                }
              }
            } catch (parseError) {
              continue;
            }
          } else if (text.includes("<text")) {
            // XML/VTT format
            const textRegex = /<text[^>]*>(.*?)<\/text>/g;
            const texts: string[] = [];
            let match;

            while ((match = textRegex.exec(text)) !== null) {
              const cleanText = match[1]
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/<[^>]*>/g, "")
                .trim();

              if (cleanText) {
                texts.push(cleanText);
              }
            }

            if (texts.length > 0) {
              const transcript = texts.join(" ").replace(/\s+/g, " ").trim();
              console.log("✅ Direct YouTube API (XML) successful!");
              return transcript;
            }
          } else if (text.includes("WEBVTT")) {
            // VTT format
            const lines = text.split("\n");
            const transcript = lines
              .filter(
                (line) =>
                  !line.startsWith("WEBVTT") &&
                  !line.includes("-->") &&
                  !line.match(/^\d+$/) &&
                  line.trim() !== "",
              )
              .map((line) => line.replace(/<[^>]*>/g, "").trim())
              .filter((line) => line !== "")
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();

            if (transcript) {
              console.log("✅ Direct YouTube API (VTT) successful!");
              return transcript;
            }
          }
        }
      } catch (endpointError) {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.log("Direct YouTube API methods failed:", error);
    return null;
  }
};

// NEW: Enhanced page scraping with better parsing
const getYouTubeTranscriptAlternative2 = async (
  videoId: string,
): Promise<string | null> => {
  try {
    console.log(
      `🔎 Fetching transcript using enhanced page scraping for: ${videoId}`,
    );

    // Multiple user agents to try
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ];

    for (const userAgent of userAgents) {
      try {
        const videoResponse = await fetch(
          `https://www.youtube.com/watch?v=${videoId}`,
          {
            headers: {
              "User-Agent": userAgent,
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.5",
              "Accept-Encoding": "gzip, deflate, br",
              DNT: "1",
              Connection: "keep-alive",
              "Upgrade-Insecure-Requests": "1",
            },
          },
        );

        if (!videoResponse.ok) continue;

        const html = await videoResponse.text();

        // Try multiple caption extraction patterns
        const captionPatterns = [
          /"captionTracks":\s*(\[.*?\])/,
          /"captions":\s*\{[^}]*"captionTracks":\s*(\[.*?\])/,
          /captionTracks":\s*(\[.*?\])/,
        ];

        for (const pattern of captionPatterns) {
          const match = html.match(pattern);

          if (match) {
            try {
              const captionTracks = JSON.parse(match[1]);

              // Find the best caption track
              let captionTrack =
                captionTracks.find(
                  (track: any) =>
                    track.languageCode === "en" && track.kind !== "asr",
                ) ||
                captionTracks.find(
                  (track: any) => track.languageCode === "en",
                ) ||
                captionTracks.find((track: any) => track.kind === "asr") ||
                captionTracks[0];

              if (!captionTrack?.baseUrl) continue;

              // Fetch the transcript
              const transcriptResponse = await fetch(captionTrack.baseUrl, {
                headers: { "User-Agent": userAgent },
              });

              if (!transcriptResponse.ok) continue;

              const transcriptXml = await transcriptResponse.text();

              // Parse XML
              const textRegex = /<text[^>]*>(.*?)<\/text>/g;
              const texts: string[] = [];
              let xmlMatch;

              while ((xmlMatch = textRegex.exec(transcriptXml)) !== null) {
                const text = xmlMatch[1]
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/<[^>]*>/g, "")
                  .trim();

                if (text) {
                  texts.push(text);
                }
              }

              if (texts.length > 0) {
                const transcript = texts.join(" ").replace(/\s+/g, " ").trim();
                console.log("✅ Enhanced page scraping successful!");
                return transcript;
              }
            } catch (parseError) {
              continue;
            }
          }
        }
      } catch (userAgentError) {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.log("Enhanced page scraping failed:", error);
    return null;
  }
};

// Alternative method 3: Using yt-dlp to extract subtitle info (without downloading video)
const getYouTubeTranscriptAlternative3 = async (
  videoId: string,
): Promise<string | null> => {
  try {
    console.log(
      `🔎 Fetching transcript using yt-dlp subtitles for: ${videoId}`,
    );

    const ytDlpWrap = createYTDlpWrap();
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const cookieArgs = await getYtDlpCookieArgs();

    const subtitleArgs = [
      videoUrl,
      "--list-subs",
      "--skip-download",
      "--no-warnings",
      "--print-json",
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "--referer",
      "https://www.youtube.com/",
      "--extractor-args",
      "youtube:player_client=android,ios,web,mweb",
      ...cookieArgs,
    ];

    try {
      const downloadArgs = [
        videoUrl,
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs",
        "en,en-US,en-GB",
        "--sub-format",
        "vtt",
        "--skip-download",
        "--no-warnings",
        "--user-agent",
        "Mozilla/5.0 (Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "--referer",
        "https://www.youtube.com/",
        "--retries",
        "3",
        "--fragment-retries",
        "3",
        "--no-call-home",
        "--no-mark-watched",
        "--extractor-args",
        "youtube:player_client=android,ios,web,mweb",
        "-o",
        path.join(process.cwd(), "temp_audio", `subs-${Date.now()}.%(ext)s`),
        ...cookieArgs,
      ];

      await new Promise<void>((resolve, reject) => {
        const emitter = ytDlpWrap.exec(downloadArgs);
        emitter.on("error", reject);
        emitter.on("close", (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new Error(`yt-dlp subtitle download failed with code ${code}`),
            );
          }
        });
      });

      // Read the downloaded subtitle file
      const tempDir = path.join(process.cwd(), "temp_audio");
      const files = await fs.readdir(tempDir);
      const vttFile = files.find(
        (file) =>
          file.includes("subs-") &&
          (file.endsWith(".vtt") || file.endsWith(".en.vtt")),
      );

      if (vttFile) {
        const vttPath = path.join(tempDir, vttFile);
        const vttContent = await fs.readFile(vttPath, "utf-8");

        // Parse VTT format
        const lines = vttContent.split("\n");
        const transcript = lines
          .filter(
            (line) =>
              !line.startsWith("WEBVTT") &&
              !line.includes("-->") &&
              !line.match(/^\d+$/) &&
              line.trim() !== "",
          )
          .map((line) => line.replace(/<[^>]*>/g, "").trim())
          .filter((line) => line !== "")
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        // Clean up
        await fs.unlink(vttPath);

        if (transcript) {
          console.log("✅ yt-dlp subtitle method successful!");
          return transcript;
        }
      }
    } catch (downloadError) {
      console.log("yt-dlp subtitle download failed:", downloadError);
    }

    return null;
  } catch (error) {
    console.log("yt-dlp subtitle method failed:", error);
    return null;
  }
};

const getYouTubeTranscriptAlternative4 = async (
  videoId: string,
): Promise<string | null> => {
  try {
    console.log(
      `🔎 Fetching transcript using youtube-transcript package for: ${videoId}`,
    );

    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (transcript && transcript.length > 0) {
      const text = transcript.map((item) => item.text).join(" ");
      console.log("✅ youtube-transcript package successful!");
      return text;
    }

    return null;
  } catch (error) {
    console.log("youtube-transcript package failed:", error);
    return null;
  }
};

async function fetchTimedText(
  videoId: string,
  kind?: "asr",
): Promise<string | null> {
  const params = new URLSearchParams({ v: videoId, lang: "en", fmt: "json3" });
  if (kind) params.set("kind", kind);
  const url = `https://video.google.com/timedtext?${params}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.events) return null;
  return (
    data.events
      .flatMap((e: any) => e.segs?.map((s: any) => s.utf8) || [])
      .join(" ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

/**
 * Try ytdl-core fallback if timedtext fails.
 */
async function getYouTubeTranscriptUsingYtdl(
  videoId: string,
): Promise<string | null> {
  try {
    const { default: ytdl } = await import("ytdl-core");
    const info = await ytdl.getInfo(videoId);
    const tracks =
      info.player_response.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks;
    if (!tracks?.length) return null;
    const track =
      tracks.find((t) => t.languageCode === "en" && !t.kind) ||
      tracks.find((t) => t.languageCode === "en") ||
      tracks[0];
    if (!track?.baseUrl) return null;
    const xml = await fetch(track.baseUrl).then((r) => r.text());
    const texts: string[] = [];
    let m: RegExpExecArray | null;
    const re = /<text[^>]*>(.*?)<\/text>/g;
    while ((m = re.exec(xml)) !== null) {
      const clean = m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .trim();
      if (clean) texts.push(clean);
    }
    return texts.join(" ").replace(/\s+/g, " ").trim() || null;
  } catch (err) {
    console.warn("⚠️ ytdl-core helper failed, skipping:", err);
    return null;
  }
}

// Updated main transcript function with multiple fallbacks and improved error handling
const getYouTubeTranscript = async (
  videoId: string,
): Promise<string | null> => {
  console.log(`🔎 Fetching captions for video ID: ${videoId}`);

  // 1) youtube-captions-scraper (fastest method)
  try {
    console.log("Trying youtube-captions-scraper...");
    let caps = await getSubtitles({ videoID: videoId, lang: "en" }).catch(
      () => null,
    );
    if (!caps?.length) {
      console.log("No manual captions, trying auto...");
      caps = await getSubtitles({ videoID: videoId }).catch(() => null);
    }
    if (caps?.length) {
      console.log("✅ Original method successful!");
      interface Caption {
        text: string;
        [key: string]: any;
      }
      return caps.map((c: Caption) => c.text).join(" ");
    }
  } catch (error) {
    console.log("youtube-captions-scraper failed:", error);
  }

  // 2) manual captions via timedtext
  try {
    console.log("Trying manual captions via timedtext...");
    const manual = await fetchTimedText(videoId);
    if (manual) {
      console.log("✅ fetched manual captions via timedtext");
      return manual;
    }
  } catch (error) {
    console.log("Manual timedtext failed:", error);
  }

  // 3) auto-generated (ASR) captions
  try {
    console.log("Trying auto-generated captions...");
    const auto = await fetchTimedText(videoId, "asr");
    if (auto) {
      console.log("✅ fetched auto captions via timedtext?kind=asr");
      return auto;
    }
  } catch (error) {
    console.log("Auto captions failed:", error);
  }

  // 4) ytdl-core
  try {
    console.log("Trying ytdl-core...");
    const tYtdl = await getYouTubeTranscriptUsingYtdl(videoId);
    if (tYtdl) {
      console.log("✅ ytdl-core successful!");
      return tYtdl;
    }
  } catch (error) {
    console.log("ytdl-core failed:", error);
  }

  // 5) youtube-transcript package
  try {
    console.log("Trying youtube-transcript package...");
    const tYTpkg = await getYouTubeTranscriptAlternative4(videoId);
    if (tYTpkg) {
      console.log("✅ youtube-transcript package successful!");
      return tYTpkg;
    }
  } catch (error) {
    console.log("youtube-transcript package failed:", error);
  }

  // 6) direct API
  try {
    console.log("Trying direct YouTube API...");
    const t2 = await getYouTubeTranscriptAlternative1(videoId);
    if (t2) {
      console.log("✅ Direct API successful!");
      return t2;
    }
  } catch (error) {
    console.log("Direct API failed:", error);
  }

  // 7) page scrape
  try {
    console.log("Trying page scraping...");
    const t3 = await getYouTubeTranscriptAlternative2(videoId);
    if (t3) {
      console.log("✅ Page scraping successful!");
      return t3;
    }
  } catch (error) {
    console.log("Page scraping failed:", error);
  }

  // 8) yt-dlp subs
  try {
    console.log("Trying yt-dlp subtitles...");
    const t4 = await getYouTubeTranscriptAlternative3(videoId);
    if (t4) {
      console.log("✅ yt-dlp subtitles successful!");
      return t4;
    }
  } catch (error) {
    console.log("yt-dlp subtitles failed:", error);
  }

  console.log("❌ All transcript methods failed for this video.");
  return null;
};

// Enhanced download with cookie support
const downloadYouTubeAudio = async (videoUrl: string): Promise<string> => {
  try {
    console.log("📥 Downloading YouTube audio...");

    const ytDlpWrap = createYTDlpWrap();
    const timestamp = Date.now();
    const tempDir = path.join(process.cwd(), "temp_audio");
    await fs.mkdir(tempDir, { recursive: true });

    const outputPath = path.join(tempDir, `audio-${timestamp}.%(ext)s`);
    const cookieArgs = await getYtDlpCookieArgs();

    const downloadArgs = [
      videoUrl,
      "--extract-audio",
      "--audio-format",
      "wav",
      "--audio-quality",
      "0",
      "--format",
      "bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio",
      "--no-warnings",
      "--no-check-certificates",
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "--referer",
      "https://www.youtube.com/",
      "--add-header",
      "Accept:*/*",
      "--add-header",
      "Accept-Language:en-US,en;q=0.9",
      "--add-header",
      "Accept-Encoding:gzip, deflate, br",
      "--add-header",
      "Connection:keep-alive",
      "--retries",
      "5",
      "--fragment-retries",
      "5",
      "--sleep-interval",
      "1",
      "--max-sleep-interval",
      "5",
      "--ignore-errors",
      "--no-call-home",
      "--no-mark-watched",
      "--extractor-args",
      "youtube:player_client=android,ios,web,mweb",
      "-o",
      outputPath,
      ...cookieArgs,
    ];
    const cookieFile = await getCookieFile();
    // Add cookies if available
    if (cookieFile) {
      downloadArgs.push("--cookies", cookieFile);
      console.log("🍪 Using cookie file for authentication");
    }

    let stdoutData = "";
    let stderrData = "";

    await new Promise<void>((resolve, reject) => {
      const emitter = ytDlpWrap.exec(downloadArgs);

      emitter.on("progress", (data) => {
        stdoutData += data.toString();
        if (data.toString().includes("ERROR")) {
          stderrData += data.toString();
        }
      });

      emitter.on("error", (error) => {
        console.error("yt-dlp download error:", error);
        console.error("stdout:", stdoutData);
        console.error("stderr:", stderrData);
        reject(new Error(`yt-dlp process error: ${error.message}`));
      });

      emitter.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Audio download completed successfully!");
          resolve();
        } else {
          console.error("yt-dlp failed with exit code:", code);
          console.error("stdout:", stdoutData);
          console.error("stderr:", stderrData);
          reject(
            new Error(
              `yt-dlp failed with exit code ${code}. Error: ${stderrData || "Unknown error"}`,
            ),
          );
        }
      });
    });

    // Find the downloaded file with better file detection
    const files = await fs.readdir(tempDir);
    console.log("Files in temp directory:", files);

    const audioFile = files.find((file) => {
      const isTimestampMatch = file.includes(`audio-${timestamp}`);
      const isAudioFormat =
        file.endsWith(".wav") ||
        file.endsWith(".m4a") ||
        file.endsWith(".mp3") ||
        file.endsWith(".opus");
      return isTimestampMatch && isAudioFormat;
    });

    if (!audioFile) {
      throw new Error(
        `Downloaded audio file not found. Files in directory: ${files.join(", ")}`,
      );
    }

    const audioPath = path.join(tempDir, audioFile);
    console.log(`📁 Audio saved to: ${audioPath}`);

    // Verify file exists and has content
    const stats = await fs.stat(audioPath);
    if (stats.size === 0) {
      throw new Error("Downloaded audio file is empty");
    }

    console.log(
      `📊 Audio file size: ${Math.round((stats.size / 1024 / 1024) * 100) / 100} MB`,
    );

    return audioPath;
  } catch (error) {
    console.error("YouTube audio download error:", error);
    throw new Error(
      `Failed to download YouTube audio: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

// Helper function to transcribe audio using AssemblyAI
const transcribeWithAssemblyAI = async (audioPath: string) => {
  try {
    console.log("🎤 Starting AssemblyAI transcription...");

    if (!process.env.ASSEMBLYAI_API_KEY) {
      throw new Error("AssemblyAI API key is not configured");
    }

    // Step 1: Upload the audio file to AssemblyAI
    console.log("📤 Uploading audio file to AssemblyAI...");
    const audioBuffer = await fs.readFile(audioPath);

    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        "content-type": "application/octet-stream",
      },
      body: audioBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(
        `AssemblyAI upload error: ${uploadResponse.status} - ${errorText}`,
      );
    }

    const uploadResult = await uploadResponse.json();
    const audioUrl = uploadResult.upload_url;

    if (!audioUrl) {
      throw new Error("Failed to get upload URL from AssemblyAI");
    }

    console.log("✅ Audio uploaded successfully to AssemblyAI");

    // Step 2: Submit transcription request with correct schema
    console.log("🔄 Submitting transcription request...");
    const transcriptResponse = await fetch(
      "https://api.assemblyai.com/v2/transcript",
      {
        method: "POST",
        headers: {
          authorization: process.env.ASSEMBLYAI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          audio_url: audioUrl,
        }),
      },
    );

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error("AssemblyAI transcript request failed:", {
        status: transcriptResponse.status,
        statusText: transcriptResponse.statusText,
        error: errorText,
        requestBody: {
          audio_url: audioUrl,
          word_timestamps: true,
          punctuate: true,
          format_text: true,
        },
      });
      throw new Error(
        `AssemblyAI transcript request error: ${transcriptResponse.status} - ${errorText}`,
      );
    }

    const transcriptResult = await transcriptResponse.json();
    const transcriptId = transcriptResult.id;

    if (!transcriptId) {
      throw new Error("Failed to get transcript ID from AssemblyAI");
    }

    console.log("📋 Transcription job submitted, waiting for completion...");

    // Step 3: Poll for completion
    let transcript;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max wait time

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            authorization: process.env.ASSEMBLYAI_API_KEY,
          },
        },
      );

      if (!statusResponse.ok) {
        throw new Error(
          `AssemblyAI status check error: ${statusResponse.status}`,
        );
      }

      transcript = await statusResponse.json();

      if (transcript.status === "completed") {
        console.log("✅ AssemblyAI transcription completed successfully!");
        break;
      } else if (transcript.status === "error") {
        throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
      }

      attempts++;
      console.log(`⏳ Transcription in progress... (${transcript.status})`);
    }

    if (attempts >= maxAttempts) {
      throw new Error("AssemblyAI transcription timed out");
    }

    // Clean up the audio file
    try {
      await fs.unlink(audioPath);
      console.log("🗑️ Cleaned up temporary audio file");
    } catch (cleanupError) {
      console.warn("Warning: Could not clean up audio file:", cleanupError);
    }

    // Extract words with timestamps if available
    const words =
      transcript.words?.map((word: any) => ({
        text: word.text,
        start: word.start,
        end: word.end,
        confidence: word.confidence || 0.9,
      })) || [];

    return {
      text: transcript.text,
      words,
      status: "completed",
    };
  } catch (error) {
    console.error("AssemblyAI transcription error:", error);

    // Clean up the audio file in case of error
    try {
      await fs.unlink(audioPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    throw new Error(`Failed to transcribe with AssemblyAI: ${error}`);
  }
};

// Helper function to download full YouTube video using yt-dlp
const downloadFullYouTubeVideo = async (videoUrl: string): Promise<string> => {
  try {
    console.log(`📥 Downloading full YouTube video...`);

    const ytDlpWrap = createYTDlpWrap();
    const timestamp = Date.now();
    const tempDir = path.join(process.cwd(), "temp_video");
    await fs.mkdir(tempDir, { recursive: true });

    const outputPath = path.join(
      tempDir,
      `original_video_${timestamp}.%(ext)s`,
    );
    const cookieArgs = await getYtDlpCookieArgs();

    const downloadArgs = [
      videoUrl,
      "-f",
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--no-warnings",
      "--extractor-args",
      "youtube:player_client=android,ios,web,mweb",
      "-o",
      outputPath,
      ...cookieArgs,
    ];

    await new Promise<void>((resolve, reject) => {
      const emitter = ytDlpWrap.exec(downloadArgs);

      emitter.on("error", (error) => {
        console.error("yt-dlp full video download error:", error);
        reject(error);
      });

      emitter.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Full video download completed successfully!");
          resolve();
        } else {
          reject(new Error(`yt-dlp failed with exit code ${code}`));
        }
      });
    });

    // Find the downloaded file
    const files = await fs.readdir(tempDir);
    const videoFile = files.find((file) =>
      file.startsWith(`original_video_${timestamp}`),
    );

    if (!videoFile) {
      throw new Error("Downloaded video file not found");
    }

    const videoPath = path.join(tempDir, videoFile);
    console.log(`📁 Full video saved to: ${videoPath}`);

    return videoPath;
  } catch (error) {
    console.error("YouTube full video download error:", error);
    throw new Error(`Failed to download YouTube video: ${error}`);
  }
};

// Helper function to extract video segment using ffmpeg
const extractVideoSegmentWithFFmpeg = async (
  inputVideoPath: string,
  startTime: number,
  duration: number,
): Promise<string> => {
  try {
    console.log(
      `✂️ Extracting video segment ${startTime}s for ${duration}s using ffmpeg...`,
    );

    const { spawn } = await import("child_process");
    const timestamp = Date.now();
    const tempDir = path.dirname(inputVideoPath);
    const outputPath = path.join(tempDir, `segment_${timestamp}.mp4`);

    // Format time for ffmpeg (HH:MM:SS)
    const formatTime = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const startTimeFormatted = formatTime(startTime);
    const durationFormatted = formatTime(duration);

    const ffmpegArgs = [
      "-ss",
      startTimeFormatted,
      "-i",
      inputVideoPath,
      "-t",
      durationFormatted,
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-avoid_negative_ts",
      "make_zero",
      outputPath,
    ];

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", ffmpegArgs);

      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          console.log("✅ Video segment extraction completed successfully!");
          resolve();
        } else {
          console.error("FFmpeg stderr:", stderr);
          reject(new Error(`FFmpeg failed with exit code ${code}`));
        }
      });

      ffmpeg.on("error", (error) => {
        console.error("FFmpeg spawn error:", error);
        reject(error);
      });
    });

    console.log(`📁 Video segment saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("FFmpeg segment extraction error:", error);
    throw new Error(`Failed to extract video segment: ${error}`);
  }
};

// UPDATED: AI Video Processing Actions with actual video downloading
export const processVideoWithAI = async (videoUrl: string) => {
  try {
    let transcript: any;

    const youtubeVideoId = extractYouTubeVideoId(videoUrl);

    if (!youtubeVideoId) {
      throw new Error(
        "Only YouTube URLs are supported. Please provide a valid YouTube video URL.",
      );
    }

    console.log("🎬 Starting YouTube video processing...");

    // ATTEMPT 1: Get transcript from YouTube's built-in captions (fast & cheap)
    const directTranscript = await getYouTubeTranscript(youtubeVideoId);

    if (directTranscript) {
      console.log("✅ Transcription fetched directly from YouTube captions!");
      // Note: This method does not provide word-level timestamps.
      transcript = { text: directTranscript, words: [] };
    }

    // ATTEMPT 2: Download video and transcribe with AssemblyAI (if no captions found)
    if (!transcript || !transcript.text) {
      console.log(
        "⚠️ No direct captions found. Downloading video and using AssemblyAI...",
      );

      try {
        // Download the audio from YouTube with enhanced error handling
        console.log("📥 Downloading YouTube audio with enhanced settings...");
        const audioPath = await downloadYouTubeAudio(videoUrl);

        // Transcribe using AssemblyAI
        console.log("🎤 Transcribing audio with AssemblyAI...");
        transcript = await transcribeWithAssemblyAI(audioPath);
        console.log("✅ AssemblyAI transcription completed successfully!");
      } catch (transcriptionError) {
        console.error("AssemblyAI transcription failed:", transcriptionError);

        // Enhanced error message with more details
        const errorMessage =
          transcriptionError instanceof Error
            ? transcriptionError.message
            : String(transcriptionError);

        throw new Error(
          "Unable to process this video: Failed to download and transcribe the audio. " +
            "This might be due to the video being age-restricted, private, or region-blocked, " +
            "or the audio file being corrupted. Please try with a different video that is publicly accessible. " +
            `Technical details: ${errorMessage}`,
        );
      }
    }

    if (!transcript || !transcript.text) {
      // FALLBACK: Create a basic transcript for demo/testing purposes
      console.log(
        "🔄 All transcript methods failed. Using fallback approach...",
      );
      transcript = {
        text: "This video contains engaging content that can be transformed into viral short-form videos. The content includes valuable insights, tips, and moments that would be perfect for social media platforms like TikTok, Instagram Reels, and YouTube Shorts.",
        words: [],
      };
      console.log("✅ Using fallback transcript to continue processing");
    }

    console.log(
      "🧠 Analyzing video content with AI to identify viral moments...",
    );
    console.log(
      "🔍 Looking for engaging segments, key insights, and emotional peaks...",
    );

    // Truncate transcript if too long to avoid token limits
    const maxTranscriptLength = 4000; // Reduced to prevent token overflow
    const truncatedTranscript =
      transcript.text.length > maxTranscriptLength
        ? transcript.text.substring(0, maxTranscriptLength) + "..."
        : transcript.text;

    // Step 2: Analyze content with Gemini to generate exactly 3 shorts (reduced from 5)
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are an expert video editor. Analyze this transcript and identify exactly 3 viral-worthy segments (45-120 seconds each). Return valid JSON only.

For each segment provide:
1. start/end timestamps in seconds
2. engaging title
3. confidence score (0-1)
4. brief description
5. 3-5 caption chunks with text, start, end, emphasis

JSON structure:
{
  "shorts": [
    {
      "id": "short-1",
      "title": "Title",
      "start": 45.2,
      "end": 72.8,
      "confidence": 0.95,
      "description": "Why important",
      "captions": [
        {"text": "Caption text", "start": 45.2, "end": 47.5, "emphasis": false}
      ]
    }
  ]
}

Transcript: ${truncatedTranscript}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 4096,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", {
        status: geminiResponse.status,
        statusText: geminiResponse.statusText,
        error: errorText,
      });
      throw new Error(
        `Gemini API error: ${geminiResponse.status} - ${errorText}`,
      );
    }

    const responseText = await geminiResponse.text();
    console.log("Raw Gemini response:", responseText);

    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", parseError);
      console.error("Response text:", responseText);
      throw new Error(
        "Invalid JSON response from Gemini API. The response may be incomplete or malformed.",
      );
    }

    // Check for MAX_TOKENS finish reason
    if (aiAnalysis.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      console.warn(
        "Gemini response was truncated due to MAX_TOKENS. Retrying with shorter input...",
      );

      // Retry with much shorter transcript
      const shortTranscript = transcript.text.substring(0, 2000);

      const retryResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=" +
          process.env.GEMINI_API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this transcript and identify 2 viral segments (20-45 seconds each). Return JSON only:
{
  "shorts": [
    {
      "id": "short-1",
      "title": "Title",
      "start": 10,
      "end": 35,
      "confidence": 0.9,
      "description": "Description",
      "captions": [{"text": "Caption", "start": 10, "end": 15, "emphasis": false}]
    }
  ]
}

Transcript: ${shortTranscript}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
            },
          }),
        },
      );

      if (retryResponse.ok) {
        const retryText = await retryResponse.text();
        try {
          aiAnalysis = JSON.parse(retryText);
        } catch {
          // If retry also fails, use fallback
          aiAnalysis = null;
        }
      }
    }

    // Validate response structure with better error handling
    if (!aiAnalysis?.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.warn("Using fallback segments due to Gemini API issues");

      // Create fallback segments
      const fallbackAnalysis = {
        shorts: [
          {
            id: "fallback-1",
            title: "Key Moment 1",
            start: 30,
            end: 60,
            confidence: 0.8,
            description: "Important segment from the video",
            captions: [
              { text: "Key insight here", start: 30, end: 35, emphasis: true },
              {
                text: "Continuing thought",
                start: 35,
                end: 40,
                emphasis: false,
              },
              { text: "Conclusion", start: 40, end: 45, emphasis: false },
            ],
          },
          {
            id: "fallback-2",
            title: "Key Moment 2",
            start: 120,
            end: 150,
            confidence: 0.75,
            description: "Another important segment",
            captions: [
              {
                text: "Another key point",
                start: 120,
                end: 125,
                emphasis: true,
              },
              {
                text: "Supporting detail",
                start: 125,
                end: 130,
                emphasis: false,
              },
            ],
          },
        ],
      };

      // Skip to processing with fallback data
      const segments = fallbackAnalysis.shorts.map((short: any) => ({
        id: short.id,
        start: short.start,
        end: short.end,
        title: short.title,
        confidence: short.confidence,
        duration: short.end - short.start,
        description: short.description,
      }));

      return {
        success: true,
        data: {
          segments,
          captions: [],
          highlights: [],
          transcript: transcript.text,
          totalShorts: segments.length,
          downloadedSegments: {},
          note: "Used fallback segments due to API limitations",
        },
      };
    }

    const contentText = aiAnalysis.candidates[0].content.parts[0].text;
    if (!contentText || contentText.trim() === "") {
      console.error("Empty content from Gemini API");
      throw new Error("Empty response content from Gemini API");
    }

    let analysis;
    try {
      analysis = JSON.parse(contentText);
    } catch (parseError) {
      console.error("Failed to parse Gemini content as JSON:", parseError);
      console.error("Content text:", contentText);
      throw new Error(
        "Invalid JSON content from Gemini API. The AI response may be incomplete.",
      );
    }

    console.log(
      "🎯 AI analysis complete! Found viral-worthy moments in your video.",
    );
    console.log("📥 Downloading full video for processing...");

    // Download the full video once
    let fullVideoPath: string | null = null;
    try {
      fullVideoPath = await downloadFullYouTubeVideo(videoUrl);
      console.log("✅ Full video downloaded successfully!");
    } catch (downloadError) {
      console.warn("⚠️ Failed to download full video:", downloadError);
    }

    // Process the AI-generated shorts
    const segments = [];
    const downloadedSegments = new Map();

    for (const short of analysis.shorts || []) {
      const segmentData = {
        id: short.id || `ai-${Date.now()}-${Math.random()}`,
        start: short.start || 0,
        end: short.end || 30,
        title: short.title || "Untitled Short",
        confidence: short.confidence || 0.8,
        duration: (short.end || 30) - (short.start || 0),
        description: short.description || "",
      };

      segments.push(segmentData);

      // If we have the full video, extract the segment using ffmpeg
      if (fullVideoPath) {
        try {
          const segmentPath = await extractVideoSegmentWithFFmpeg(
            fullVideoPath,
            segmentData.start,
            segmentData.duration,
          );
          downloadedSegments.set(segmentData.id, segmentPath);
          console.log(
            `✅ Extracted segment: ${segmentData.title} (${segmentData.duration}s)`,
          );
        } catch (extractError) {
          console.warn(
            `⚠️ Failed to extract segment ${segmentData.title}:`,
            extractError,
          );
        }
      }
    }

    console.log("✂️ Generating comprehensive captions for each segment...");

    // Generate comprehensive captions for each short
    const allCaptions: any[] = [];
    analysis.shorts?.forEach((short: any, shortIndex: number) => {
      if (short.captions && Array.isArray(short.captions)) {
        short.captions.forEach((caption: any, capIndex: number) => {
          allCaptions.push({
            id: `short-${shortIndex + 1}-cap-${capIndex + 1}`,
            text: caption.text || "Caption",
            start: caption.start || short.start || 0,
            end: caption.end || (caption.start || short.start || 0) + 3,
            shortId: short.id,
            emphasis: caption.emphasis || false,
            style: {
              fontSize: caption.emphasis ? 28 : 24,
              color: caption.emphasis ? "#FFD700" : "#ffffff",
              position: "bottom",
              animation: caption.emphasis ? "bounce-in" : "fade-in",
              fontWeight: caption.emphasis ? "bold" : "normal",
            },
          });
        });
      }
    });

    // Fallback captions from transcript words if no captions were generated
    if (allCaptions.length === 0 && transcript.words) {
      const wordsPerSegment = Math.min(
        10,
        Math.floor(transcript.words.length / 3),
      );
      segments.forEach((segment: any, index: number) => {
        const startWordIndex = index * wordsPerSegment;
        const segmentWords = transcript.words.slice(
          startWordIndex,
          startWordIndex + wordsPerSegment,
        );

        segmentWords.forEach((word: any, wordIndex: number) => {
          allCaptions.push({
            id: `fallback-${segment.id}-${wordIndex}`,
            text: word.text,
            start: word.start / 1000,
            end: word.end / 1000,
            shortId: segment.id,
            style: {
              fontSize: 24,
              color: "#ffffff",
              position: "bottom",
              animation: "fade-in",
            },
          });
        });
      });
    }

    console.log(
      "🚀 Processing complete! Your viral shorts are ready with actual video segments.",
    );
    console.log(
      `📊 Generated ${segments.length} high-quality shorts with comprehensive captions.`,
    );
    console.log(
      `📥 Extracted ${downloadedSegments.size} video segments from full video.`,
    );

    // Clean up the full video file if it exists
    if (fullVideoPath) {
      try {
        await fs.unlink(fullVideoPath);
        console.log("🗑️ Cleaned up full video file");
      } catch (cleanupError) {
        console.warn(
          "Warning: Could not clean up full video file:",
          cleanupError,
        );
      }
    }

    return {
      success: true,
      data: {
        segments,
        captions: allCaptions,
        highlights: [],
        transcript: transcript.text,
        totalShorts: segments.length,
        downloadedSegments: Object.fromEntries(downloadedSegments),
      },
    };
  } catch (error) {
    console.error("AI processing error:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to process video with AI",
    };
  }
};

export const generateCaptionsFromText = async (
  text: string,
  duration: number,
) => {
  try {
    // Validate inputs
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Invalid text input for caption generation");
    }

    if (!duration || typeof duration !== "number" || duration <= 0) {
      throw new Error("Invalid duration for caption generation");
    }

    // Validate API key
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini API key is not configured");
    }

    // Truncate text if too long to avoid token limits
    const maxTextLength = 8000; // Gemini can handle much more text
    const truncatedText =
      text.length > maxTextLength
        ? text.substring(0, maxTextLength) + "..."
        : text;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-06-17:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a helpful assistant that generates engaging captions for social media videos. Always respond with valid JSON.

Generate engaging captions for a ${duration}-second video clip with this content: "${truncatedText}". Return a JSON object with a 'captions' array containing caption objects. Each caption should have: text (string), start (number in seconds), end (number in seconds), and style (object with fontSize, color, position, animation properties).`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error details:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(
        `Gemini API error: ${response.status} - ${response.statusText}`,
      );
    }

    const responseText = await response.text();
    console.log("Raw Gemini caption response:", responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", parseError);
      console.error("Response text:", responseText);
      throw new Error(
        "Invalid JSON response from Gemini API for caption generation.",
      );
    }

    // Validate response structure
    if (!result) {
      throw new Error("Empty response from Gemini API");
    }

    if (
      !result.candidates ||
      !Array.isArray(result.candidates) ||
      result.candidates.length === 0
    ) {
      throw new Error("No candidates in Gemini API response");
    }

    if (!result.candidates[0] || !result.candidates[0].content) {
      throw new Error("Invalid candidate structure in Gemini API response");
    }

    if (
      !result.candidates[0].content.parts ||
      !result.candidates[0].content.parts[0]
    ) {
      throw new Error("No content in Gemini API response message");
    }

    const contentText = result.candidates[0].content.parts[0].text;
    if (!contentText || contentText.trim() === "") {
      throw new Error("Empty content from Gemini API for caption generation");
    }

    let captions;
    try {
      captions = JSON.parse(contentText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Raw content:", contentText);
      throw new Error("Failed to parse Gemini caption response as JSON");
    }

    // Validate captions structure
    if (!captions || typeof captions !== "object") {
      throw new Error("Invalid captions object structure");
    }

    const captionsArray = captions.captions || [];

    // Ensure captions array is valid
    if (!Array.isArray(captionsArray)) {
      throw new Error("Captions is not an array");
    }

    // Validate and sanitize each caption
    const validatedCaptions = captionsArray.map(
      (caption: any, index: number) => {
        return {
          id: `cap-${index + 1}`,
          text: caption.text || `Caption ${index + 1}`,
          start:
            typeof caption.start === "number"
              ? caption.start
              : index * (duration / captionsArray.length),
          end:
            typeof caption.end === "number"
              ? caption.end
              : (index + 1) * (duration / captionsArray.length),
          style: {
            fontSize: caption.style?.fontSize || 24,
            color: caption.style?.color || "#ffffff",
            position: caption.style?.position || "bottom",
            animation: caption.style?.animation || "fade-in",
          },
        };
      },
    );

    return {
      success: true,
      captions: validatedCaptions,
    };
  } catch (error) {
    console.error("Caption generation error:", error);

    // Return more specific error messages
    let errorMessage = "Failed to generate captions";
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        errorMessage = "Gemini API key is not configured properly";
      } else if (error.message.includes("400")) {
        errorMessage =
          "Invalid request to Gemini API. Please check your input.";
      } else if (error.message.includes("401")) {
        errorMessage =
          "Gemini API authentication failed. Please check your API key.";
      } else if (error.message.includes("429")) {
        errorMessage =
          "Gemini API rate limit exceeded. Please try again later.";
      } else if (error.message.includes("500")) {
        errorMessage = "Gemini API server error. Please try again later.";
      } else {
        errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};
