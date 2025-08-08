// Debug script to test transcript fetching methods
// Run this on your Linux server to diagnose issues

const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");

// Import fetch for Node.js versions that don't have it built-in
let fetch;
(async () => {
  if (typeof globalThis.fetch === "undefined") {
    const { default: nodeFetch } = await import("node-fetch");
    fetch = nodeFetch;
  } else {
    fetch = globalThis.fetch;
  }
})();

// Test video ID - using a more reliable video with captions
const TEST_VIDEO_ID = "dQw4w9WgXcQ"; // Rick Roll - definitely has captions and is accessible
const TEST_VIDEO_URL = `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`;

console.log("🔧 Starting transcript debugging...");
console.log(`📹 Test video: ${TEST_VIDEO_URL}`);

// Test 1: Check if yt-dlp binary exists and works
async function testYtDlp() {
  console.log("\n1️⃣ Testing yt-dlp binary...");

  const ytdlpPath = path.join(process.cwd(), "bin", "yt-dlp");

  try {
    await fs.access(ytdlpPath);
    console.log("✅ yt-dlp binary exists");

    // Check if it's executable
    const stats = await fs.stat(ytdlpPath);
    console.log(`📊 File size: ${stats.size} bytes`);
    console.log(`🔐 Permissions: ${stats.mode.toString(8)}`);

    // Test version
    return new Promise((resolve, reject) => {
      exec(`"${ytdlpPath}" --version`, (error, stdout, stderr) => {
        if (error) {
          console.log("❌ yt-dlp version check failed:", error.message);
          console.log("❌ stderr:", stderr);
          reject(error);
        } else {
          console.log("✅ yt-dlp version:", stdout.trim());
          resolve(stdout.trim());
        }
      });
    });
  } catch (error) {
    console.log("❌ yt-dlp binary not found at:", ytdlpPath);

    // Check if it exists in PATH
    try {
      return new Promise((resolve, reject) => {
        exec("yt-dlp --version", (error, stdout, stderr) => {
          if (error) {
            console.log("❌ yt-dlp not found in PATH either");
            reject(error);
          } else {
            console.log("✅ Found yt-dlp in PATH, version:", stdout.trim());
            resolve(stdout.trim());
          }
        });
      });
    } catch (pathError) {
      console.log("❌ yt-dlp not available anywhere");
      throw error;
    }
  }
}

// Test 2: Try direct YouTube API endpoints
async function testDirectAPI() {
  console.log("\n2️⃣ Testing direct YouTube API...");

  // Initialize fetch if not done already
  if (!fetch) {
    try {
      const { default: nodeFetch } = await import("node-fetch");
      fetch = nodeFetch;
    } catch (importError) {
      console.log(
        "❌ Could not import fetch. Install node-fetch: npm install node-fetch",
      );
      return null;
    }
  }

  const endpoints = [
    `https://www.youtube.com/api/timedtext?v=${TEST_VIDEO_ID}&lang=en&fmt=json3`,
    `https://video.google.com/timedtext?v=${TEST_VIDEO_ID}&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${TEST_VIDEO_ID}&kind=asr&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${TEST_VIDEO_ID}&lang=en&fmt=vtt`,
    `https://www.youtube.com/api/timedtext?v=${TEST_VIDEO_ID}&lang=en-US&fmt=json3`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Trying: ${endpoint}`);

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

      console.log(`   Status: ${response.status}`);

      if (response.ok) {
        const text = await response.text();
        console.log(`   Response length: ${text.length} chars`);

        if (text.length > 0 && !text.includes("<!DOCTYPE html>")) {
          console.log(`   ✅ Got response (${text.length} chars)`);
          console.log(`   Preview: ${text.substring(0, 200)}...`);

          // Try to parse as JSON
          if (text.includes('{"events":') || text.includes('"events":[')) {
            try {
              const data = JSON.parse(text);
              if (data.events && data.events.length > 0) {
                console.log(`   📝 Found ${data.events.length} caption events`);
                return text;
              }
            } catch (parseError) {
              console.log(`   ⚠️ JSON parse failed: ${parseError.message}`);
            }
          }

          // Check for VTT format
          if (text.includes("WEBVTT")) {
            console.log(`   📝 Found VTT format captions`);
            return text;
          }

          return text;
        } else {
          console.log(`   ❌ Empty response or HTML page`);
        }
      } else {
        console.log(
          `   ❌ HTTP error: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log("❌ All direct API endpoints failed");
  return null;
}

// Test 3: Try yt-dlp subtitle extraction
async function testYtDlpSubs() {
  console.log("\n3️⃣ Testing yt-dlp subtitle extraction...");

  const ytdlpPath = path.join(process.cwd(), "bin", "yt-dlp");

  return new Promise((resolve, reject) => {
    const outputPattern = "debug-subs";

    // Fixed command without malformed --cookies option
    const args = [
      `"${TEST_VIDEO_URL}"`,
      "--write-subs",
      "--write-auto-subs",
      "--sub-langs",
      "en,en-US,en-GB",
      "--sub-format",
      "vtt",
      "--skip-download",
      "--no-warnings",
      "--user-agent",
      '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"',
      "--referer",
      '"https://www.youtube.com/"',
      "--retries",
      "3",
      "--fragment-retries",
      "3",
      "-o",
      `"${outputPattern}.%(ext)s"`,
    ];

    const command = `"${ytdlpPath}" ${args.join(" ")}`;

    console.log(`🔍 Running: ${command}`);

    exec(
      command,
      { maxBuffer: 1024 * 1024 * 10 },
      async (error, stdout, stderr) => {
        if (error) {
          console.log("❌ yt-dlp subtitle extraction failed:", error.message);
          console.log("Stderr:", stderr);

          // Try with cookies from browser
          const cookieArgs = [
            `"${TEST_VIDEO_URL}"`,
            "--cookies-from-browser",
            "chrome",
            "--write-subs",
            "--write-auto-subs",
            "--sub-langs",
            "en",
            "--sub-format",
            "vtt",
            "--skip-download",
            "--no-warnings",
            "-o",
            `"${outputPattern}-cookies.%(ext)s"`,
          ];

          const cookieCommand = `"${ytdlpPath}" ${cookieArgs.join(" ")}`;
          console.log(`🔄 Trying with browser cookies: ${cookieCommand}`);

          exec(
            cookieCommand,
            { maxBuffer: 1024 * 1024 * 10 },
            async (cookieError, cookieStdout, cookieStderr) => {
              if (cookieError) {
                console.log(
                  "❌ Cookie method also failed:",
                  cookieError.message,
                );

                // Try simple approach without extra options
                const simpleCommand = `"${ytdlpPath}" "${TEST_VIDEO_URL}" --write-auto-subs --sub-langs en --sub-format vtt --skip-download -o "${outputPattern}-simple.%(ext)s"`;
                console.log(`🔄 Trying simple approach: ${simpleCommand}`);

                exec(
                  simpleCommand,
                  async (simpleError, simpleStdout, simpleStderr) => {
                    if (simpleError) {
                      console.log(
                        "❌ Simple approach also failed:",
                        simpleError.message,
                      );
                      reject(error);
                    } else {
                      console.log("✅ Simple approach worked");
                      await checkSubtitleFiles(
                        `${outputPattern}-simple`,
                        resolve,
                        reject,
                      );
                    }
                  },
                );
              } else {
                console.log("✅ Cookie method worked");
                await checkSubtitleFiles(
                  `${outputPattern}-cookies`,
                  resolve,
                  reject,
                );
              }
            },
          );
        } else {
          console.log("✅ yt-dlp subtitle extraction completed");
          console.log("Stdout:", stdout);
          await checkSubtitleFiles(outputPattern, resolve, reject);
        }
      },
    );
  });
}

async function checkSubtitleFiles(outputPattern, resolve, reject) {
  try {
    const files = await fs.readdir(".");
    const vttFiles = files.filter(
      (f) => f.includes(outputPattern) && f.endsWith(".vtt"),
    );

    if (vttFiles.length > 0) {
      const vttFile = vttFiles[0];
      console.log(`📄 Found subtitle file: ${vttFile}`);
      const content = await fs.readFile(vttFile, "utf-8");
      console.log(`📝 Subtitle content (${content.length} chars):`);
      console.log(content.substring(0, 500));

      // Clean up
      for (const file of vttFiles) {
        try {
          await fs.unlink(file);
        } catch (unlinkError) {
          console.log(`⚠️ Could not delete ${file}`);
        }
      }
      resolve(content);
    } else {
      console.log("❌ No subtitle file found.");
      console.log(
        "Available files:",
        files.filter((f) => f.includes("debug")),
      );
      resolve(null);
    }
  } catch (readError) {
    console.log("❌ Error reading subtitle file:", readError.message);
    reject(readError);
  }
}

// Test 4: Try audio download (simplified)
async function testAudioDownload() {
  console.log("\n4️⃣ Testing audio download...");

  const ytdlpPath = path.join(process.cwd(), "bin", "yt-dlp");

  return new Promise((resolve, reject) => {
    const outputPattern = "debug-audio";

    // Simplified audio download command
    const args = [
      `"${TEST_VIDEO_URL}"`,
      "--extract-audio",
      "--audio-format",
      "wav",
      "--audio-quality",
      "0",
      "--no-warnings",
      "-o",
      `"${outputPattern}.%(ext)s"`,
    ];

    const command = `"${ytdlpPath}" ${args.join(" ")}`;

    console.log(`🔍 Running: ${command}`);

    exec(
      command,
      { maxBuffer: 1024 * 1024 * 50 },
      async (error, stdout, stderr) => {
        if (error) {
          console.log("❌ Audio download failed:", error.message);
          console.log("Stderr:", stderr);

          // Try with cookies
          const cookieCommand = `"${ytdlpPath}" "${TEST_VIDEO_URL}" --cookies-from-browser chrome --extract-audio --audio-format wav --audio-quality 0 --no-warnings -o "${outputPattern}-cookies.%(ext)s"`;
          console.log(`🔄 Trying with cookies: ${cookieCommand}`);

          exec(
            cookieCommand,
            { maxBuffer: 1024 * 1024 * 50 },
            async (cookieError, cookieStdout, cookieStderr) => {
              if (cookieError) {
                console.log(
                  "❌ Cookie audio download also failed:",
                  cookieError.message,
                );
                reject(error);
              } else {
                console.log("✅ Cookie audio download worked");
                await checkAudioFiles(
                  `${outputPattern}-cookies`,
                  resolve,
                  reject,
                );
              }
            },
          );
        } else {
          console.log("✅ Audio download completed");
          console.log("Stdout:", stdout);
          await checkAudioFiles(outputPattern, resolve, reject);
        }
      },
    );
  });
}

async function checkAudioFiles(outputPattern, resolve, reject) {
  try {
    const files = await fs.readdir(".");
    const audioFiles = files.filter(
      (f) =>
        f.includes(outputPattern) &&
        (f.endsWith(".wav") ||
          f.endsWith(".m4a") ||
          f.endsWith(".mp3") ||
          f.endsWith(".opus")),
    );

    if (audioFiles.length > 0) {
      const audioFile = audioFiles[0];
      console.log(`🎵 Found audio file: ${audioFile}`);
      const stats = await fs.stat(audioFile);
      console.log(
        `📊 Audio file size: ${Math.round((stats.size / 1024 / 1024) * 100) / 100} MB`,
      );

      // Clean up
      for (const file of audioFiles) {
        try {
          await fs.unlink(file);
        } catch (unlinkError) {
          console.log(`⚠️ Could not delete ${file}`);
        }
      }
      resolve(audioFile);
    } else {
      console.log("❌ No audio file found.");
      console.log(
        "Available files:",
        files.filter((f) => f.includes("debug")),
      );
      resolve(null);
    }
  } catch (readError) {
    console.log("❌ Error checking audio file:", readError.message);
    reject(readError);
  }
}

// Test 5: Check network connectivity
async function testNetworkConnectivity() {
  console.log("\n5️⃣ Testing network connectivity...");

  if (!fetch) {
    console.log("❌ Fetch not available, skipping network test");
    return;
  }

  const testUrls = [
    "https://www.youtube.com",
    "https://www.google.com",
    "https://api.assemblyai.com/v2/upload",
  ];

  for (const url of testUrls) {
    try {
      console.log(`🌐 Testing: ${url}`);
      const response = await fetch(url, {
        method: "HEAD",
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      console.log(`   ✅ ${url} - Status: ${response.status}`);
    } catch (error) {
      console.log(`   ❌ ${url} - Failed: ${error.message}`);
    }
  }
}

// Run all tests
async function runAllTests() {
  try {
    console.log("🚀 Starting comprehensive debugging...\n");

    // Test 0: Install yt-dlp if missing
    try {
      console.log("0️⃣ Checking yt-dlp installation...");
      const installScript = path.join(
        process.cwd(),
        "scripts",
        "install-ytdlp.js",
      );

      try {
        await fs.access(installScript);
        console.log("📥 Running yt-dlp installer...");

        await new Promise((resolve, reject) => {
          exec(`node "${installScript}"`, (error, stdout, stderr) => {
            if (error) {
              console.log("⚠️ Install script failed, continuing with tests...");
              resolve(null);
            } else {
              console.log("✅ Install script completed");
              console.log(stdout);
              resolve(stdout);
            }
          });
        });
      } catch (scriptError) {
        console.log("⚠️ Install script not found, continuing...");
      }
    } catch (error) {
      console.log("⚠️ yt-dlp installation check failed");
    }

    // Test 1: yt-dlp binary
    try {
      await testYtDlp();
    } catch (error) {
      console.log(
        "⚠️ yt-dlp test failed - this will cause audio download issues",
      );
    }

    // Test 2: Network connectivity
    try {
      await testNetworkConnectivity();
    } catch (error) {
      console.log("⚠️ Network connectivity test failed");
    }

    // Test 3: Direct API
    try {
      const transcript = await testDirectAPI();
      if (transcript) {
        console.log(
          "✅ Direct API method working - this should be the primary method",
        );
      }
    } catch (error) {
      console.log("⚠️ Direct API test failed");
    }

    // Test 4: yt-dlp subtitles
    try {
      await testYtDlpSubs();
    } catch (error) {
      console.log("⚠️ yt-dlp subtitle test failed");
    }

    // Test 5: Audio download
    try {
      await testAudioDownload();
    } catch (error) {
      console.log(
        "⚠️ Audio download test failed - AssemblyAI fallback won't work",
      );
    }

    console.log("\n🏁 Debugging complete!");
    console.log("\n📋 Summary and Recommendations:");
    console.log("1. 🎯 Focus on the Direct API method - it's most reliable");
    console.log(
      "2. 🍪 YouTube is requiring authentication - consider implementing cookie support",
    );
    console.log(
      "3. 🔧 If yt-dlp fails, install system-wide: pip install yt-dlp",
    );
    console.log(
      "4. 🌐 Ensure your server can access YouTube without restrictions",
    );
    console.log(
      "5. 📦 Consider using a proxy or VPN if YouTube blocks your server IP",
    );

    console.log("\n🔧 Quick fixes for common issues:");
    console.log("• Bot detection: Use --cookies-from-browser chrome option");
    console.log("• Rate limiting: Add delays between requests");
    console.log("• IP blocking: Use a proxy service");
    console.log("• Missing yt-dlp: pip install yt-dlp");
  } catch (error) {
    console.error("💥 Debug script failed:", error);
  }
}

// Run the tests
runAllTests().catch(console.error);
