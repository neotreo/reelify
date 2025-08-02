// Debug script to test transcript fetching methods
// Run this on your Linux server to diagnose issues

const { exec } = require('child_process');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Test video ID (use a popular video that should have captions)
const TEST_VIDEO_ID = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video, definitely has captions
const TEST_VIDEO_URL = `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`;

console.log('🔧 Starting transcript debugging...');
console.log(`📹 Test video: ${TEST_VIDEO_URL}`);

// Test 1: Check if yt-dlp binary exists and works
async function testYtDlp() {
  console.log('\n1️⃣ Testing yt-dlp binary...');
  
  const ytdlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');
  
  try {
    await fs.access(ytdlpPath);
    console.log('✅ yt-dlp binary exists');
    
    // Check if it's executable
    const stats = await fs.stat(ytdlpPath);
    console.log(`📊 File size: ${stats.size} bytes`);
    console.log(`🔐 Permissions: ${stats.mode.toString(8)}`);
    
    // Test version with proper escaping
    return new Promise((resolve, reject) => {
      exec(`${ytdlpPath} --version`, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ yt-dlp version check failed:', error.message);
          console.log('❌ stderr:', stderr);
          reject(error);
        } else {
          console.log('✅ yt-dlp version:', stdout.trim());
          resolve(stdout.trim());
        }
      });
    });
  } catch (error) {
    console.log('❌ yt-dlp binary not found at:', ytdlpPath);
    
    // Check if it exists in default location
    try {
      return new Promise((resolve, reject) => {
        exec('yt-dlp --version', (error, stdout, stderr) => {
          if (error) {
            console.log('❌ yt-dlp not found in PATH either');
            reject(error);
          } else {
            console.log('✅ Found yt-dlp in PATH, version:', stdout.trim());
            resolve(stdout.trim());
          }
        });
      });
    } catch (pathError) {
      console.log('❌ yt-dlp not available anywhere');
      throw error;
    }
  }
}

// Test 2: Try direct YouTube API endpoints
async function testDirectAPI() {
  console.log('\n2️⃣ Testing direct YouTube API...');
  
  const endpoints = [
    `https://www.youtube.com/api/timedtext?v=${TEST_VIDEO_ID}&lang=en&fmt=json3`,
    `https://video.google.com/timedtext?v=${TEST_VIDEO_ID}&lang=en&fmt=json3`,
    `https://www.youtube.com/api/timedtext?v=${TEST_VIDEO_ID}&kind=asr&lang=en&fmt=json3`,
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Trying: ${endpoint}`);
      
      const response = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.youtube.com/',
        }
      });

      console.log(`   Status: ${response.status}`);
      
      if (response.ok) {
        const text = await response.text();
        console.log(`   Response length: ${text.length} chars`);
        
        if (text.length > 0) {
          console.log(`   ✅ Got response (${text.length} chars)`);
          console.log(`   Preview: ${text.substring(0, 200)}...`);
          
          // Try to parse as JSON
          if (text.includes('{"events":')) {
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
          
          return text;
        } else {
          console.log(`   ❌ Empty response`);
        }
      } else {
        console.log(`   ❌ HTTP error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }
  
  console.log('❌ All direct API endpoints failed');
  return null;
}

// Test 3: Try yt-dlp subtitle extraction
async function testYtDlpSubs() {
  console.log('\n3️⃣ Testing yt-dlp subtitle extraction...');
  
  const ytdlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');
  
  return new Promise((resolve, reject) => {
    // Use a simpler output pattern that doesn't confuse the shell
    const outputPattern = 'debug-subs';
    
    const args = [
      TEST_VIDEO_URL,
      '--write-subs',
      '--write-auto-subs', 
      '--sub-langs', 'en',
      '--sub-format', 'vtt',
      '--skip-download',
      '--no-warnings',
      '-o', `${outputPattern}.%(ext)s`
    ];
    
    const command = `${ytdlpPath} "${TEST_VIDEO_URL}" --write-subs --write-auto-subs --sub-langs en --sub-format vtt --skip-download --no-warnings --user-agent "Mozilla/5.0 (Linux x86_64) AppleWebKit/537.36" --referer "https://www.youtube.com/" -o "${outputPattern}.%(ext)s"`;
    
    console.log(`🔍 Running: ${command}`);
    
    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.log('❌ yt-dlp subtitle extraction failed:', error.message);
        console.log('Stderr:', stderr);
        
        // Try with system yt-dlp if local one fails
        const systemCommand = `yt-dlp "${TEST_VIDEO_URL}" --write-subs --write-auto-subs --sub-langs en --sub-format vtt --skip-download --no-warnings --user-agent "Mozilla/5.0 (Linux x86_64) AppleWebKit/537.36" --referer "https://www.youtube.com/" -o "${outputPattern}.%(ext)s"`;
        console.log(`🔄 Trying system yt-dlp: ${systemCommand}`);
        
        exec(systemCommand, async (sysError, sysStdout, sysStderr) => {
          if (sysError) {
            console.log('❌ System yt-dlp also failed:', sysError.message);
            reject(error);
          } else {
            console.log('✅ System yt-dlp worked');
            await checkSubtitleFiles(outputPattern, resolve, reject);
          }
        });
      } else {
        console.log('✅ yt-dlp subtitle extraction completed');
        console.log('Stdout:', stdout);
        await checkSubtitleFiles(outputPattern, resolve, reject);
      }
    });
  });
}

async function checkSubtitleFiles(outputPattern, resolve, reject) {
  try {
    const files = await fs.readdir('.');
    const vttFile = files.find(f => f.includes(outputPattern) && f.endsWith('.vtt'));
    
    if (vttFile) {
      console.log(`📄 Found subtitle file: ${vttFile}`);
      const content = await fs.readFile(vttFile, 'utf-8');
      console.log(`📝 Subtitle content (${content.length} chars):`);
      console.log(content.substring(0, 500));
      
      // Clean up
      await fs.unlink(vttFile);
      resolve(content);
    } else {
      console.log('❌ No subtitle file found. Available files:', files.filter(f => f.includes(outputPattern)));
      resolve(null);
    }
  } catch (readError) {
    console.log('❌ Error reading subtitle file:', readError.message);
    reject(readError);
  }
}

// Test 4: Try audio download
async function testAudioDownload() {
  console.log('\n4️⃣ Testing audio download...');
  
  const ytdlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');
  
  return new Promise((resolve, reject) => {
    const outputPattern = 'debug-audio';
    
    const command = `${ytdlpPath} "${TEST_VIDEO_URL}" --extract-audio --audio-format wav --audio-quality 0 --no-warnings --user-agent "Mozilla/5.0 (Linux x86_64) AppleWebKit/537.36" --referer "https://www.youtube.com/" -o "${outputPattern}.%(ext)s"`;
    
    console.log(`🔍 Running: ${command}`);
    
    exec(command, async (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Audio download failed:', error.message);
        console.log('Stderr:', stderr);
        
        // Try with system yt-dlp
        const systemCommand = `yt-dlp "${TEST_VIDEO_URL}" --extract-audio --audio-format wav --audio-quality 0 --no-warnings --user-agent "Mozilla/5.0 (Linux x86_64) AppleWebKit/537.36" --referer "https://www.youtube.com/" -o "${outputPattern}.%(ext)s"`;
        console.log(`🔄 Trying system yt-dlp: ${systemCommand}`);
        
        exec(systemCommand, async (sysError, sysStdout, sysStderr) => {
          if (sysError) {
            console.log('❌ System yt-dlp also failed:', sysError.message);
            reject(error);
          } else {
            console.log('✅ System yt-dlp worked for audio');
            await checkAudioFiles(outputPattern, resolve, reject);
          }
        });
      } else {
        console.log('✅ Audio download completed');
        console.log('Stdout:', stdout);
        await checkAudioFiles(outputPattern, resolve, reject);
      }
    });
  });
}

async function checkAudioFiles(outputPattern, resolve, reject) {
  try {
    const files = await fs.readdir('.');
    const audioFile = files.find(f => f.includes(outputPattern) && (f.endsWith('.wav') || f.endsWith('.m4a') || f.endsWith('.mp3')));
    
    if (audioFile) {
      console.log(`🎵 Found audio file: ${audioFile}`);
      const stats = await fs.stat(audioFile);
      console.log(`📊 Audio file size: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);
      
      // Clean up
      await fs.unlink(audioFile);
      resolve(audioFile);
    } else {
      console.log('❌ No audio file found. Available files:', files.filter(f => f.includes(outputPattern)));
      resolve(null);
    }
  } catch (readError) {
    console.log('❌ Error checking audio file:', readError.message);
    reject(readError);
  }
}

// Run all tests
async function runAllTests() {
  try {
    console.log('🚀 Starting comprehensive debugging...\n');
    
    // Test 0: Install yt-dlp if missing
    try {
      console.log('0️⃣ Checking yt-dlp installation...');
      const installScript = path.join(process.cwd(), 'scripts', 'install-ytdlp.js');
      
      try {
        await fs.access(installScript);
        console.log('📥 Running yt-dlp installer...');
        
        await new Promise((resolve, reject) => {
          exec(`node ${installScript}`, (error, stdout, stderr) => {
            if (error) {
              console.log('⚠️ Install script failed, continuing with tests...');
              resolve(null);
            } else {
              console.log('✅ Install script completed');
              console.log(stdout);
              resolve(stdout);
            }
          });
        });
      } catch (scriptError) {
        console.log('⚠️ Install script not found, continuing...');
      }
    } catch (error) {
      console.log('⚠️ yt-dlp installation check failed');
    }
    
    // Test 1: yt-dlp binary
    try {
      await testYtDlp();
    } catch (error) {
      console.log('⚠️ yt-dlp test failed - this will cause audio download issues');
    }
    
    // Test 2: Direct API
    try {
      const transcript = await testDirectAPI();
      if (transcript) {
        console.log('✅ Direct API method working - this should be the primary method');
      }
    } catch (error) {
      console.log('⚠️ Direct API test failed');
    }
    
    // Test 3: yt-dlp subtitles
    try {
      await testYtDlpSubs();
    } catch (error) {
      console.log('⚠️ yt-dlp subtitle test failed');
    }
    
    // Test 4: Audio download
    try {
      await testAudioDownload();
    } catch (error) {
      console.log('⚠️ Audio download test failed - AssemblyAI fallback won\'t work');
    }
    
    console.log('\n🏁 Debugging complete!');
    console.log('\n📋 Summary:');
    console.log('- If Direct API worked: Your main transcript fetching should work');
    console.log('- If yt-dlp tests failed: Install yt-dlp with: pip install yt-dlp');
    console.log('- Check your server\'s network access to YouTube');
    console.log('- Ensure yt-dlp binary has execute permissions on Linux');
    console.log('\n🔧 Quick fixes:');
    console.log('1. Install yt-dlp: pip install yt-dlp');
    console.log('2. Or manually download: wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp');
    console.log('3. Make executable: chmod +x /usr/local/bin/yt-dlp');
    
  } catch (error) {
    console.error('💥 Debug script failed:', error);
  }
}

// Run the tests
runAllTests();
