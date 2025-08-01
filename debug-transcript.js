// Debug script to test transcript fetching methods
// Run this on your Linux server to diagnose issues

const { exec } = require('child_process');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

// Test video ID (use a popular video that should have captions)
const TEST_VIDEO_ID = 'dQw4w9WgXcQ'; // Rick Roll - should have captions
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
    
    // Test version
    return new Promise((resolve, reject) => {
      exec(`"${ytdlpPath}" --version`, (error, stdout, stderr) => {
        if (error) {
          console.log('❌ yt-dlp version check failed:', error.message);
          reject(error);
        } else {
          console.log('✅ yt-dlp version:', stdout.trim());
          resolve(stdout.trim());
        }
      });
    });
  } catch (error) {
    console.log('❌ yt-dlp binary not found or not accessible');
    throw error;
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
        if (text.length > 0) {
          console.log(`   ✅ Got response (${text.length} chars)`);
          console.log(`   Preview: ${text.substring(0, 200)}...`);
          return text;
        }
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
    const args = [
      TEST_VIDEO_URL,
      '--write-subs',
      '--write-auto-subs', 
      '--sub-langs', 'en',
      '--sub-format', 'vtt',
      '--skip-download',
      '--no-warnings',
      '-o', 'debug-subs.%(ext)s'
    ];
    
    console.log(`🔍 Running: ${ytdlpPath} ${args.join(' ')}`);
    
    exec(`"${ytdlpPath}" ${args.join(' ')}`, async (error, stdout, stderr) => {
      if (error) {
        console.log('❌ yt-dlp subtitle extraction failed:', error.message);
        console.log('Stderr:', stderr);
        reject(error);
      } else {
        console.log('✅ yt-dlp subtitle extraction completed');
        console.log('Stdout:', stdout);
        
        // Check if subtitle file was created
        try {
          const files = await fs.readdir('.');
          const vttFile = files.find(f => f.includes('debug-subs') && f.endsWith('.vtt'));
          
          if (vttFile) {
            console.log(`📄 Found subtitle file: ${vttFile}`);
            const content = await fs.readFile(vttFile, 'utf-8');
            console.log(`📝 Subtitle content (${content.length} chars):`);
            console.log(content.substring(0, 500));
            
            // Clean up
            await fs.unlink(vttFile);
            resolve(content);
          } else {
            console.log('❌ No subtitle file found');
            resolve(null);
          }
        } catch (readError) {
          console.log('❌ Error reading subtitle file:', readError.message);
          reject(readError);
        }
      }
    });
  });
}

// Test 4: Try audio download
async function testAudioDownload() {
  console.log('\n4️⃣ Testing audio download...');
  
  const ytdlpPath = path.join(process.cwd(), 'bin', 'yt-dlp');
  
  return new Promise((resolve, reject) => {
    const args = [
      TEST_VIDEO_URL,
      '--extract-audio',
      '--audio-format', 'wav',
      '--audio-quality', '0',
      '--no-warnings',
      '-o', 'debug-audio.%(ext)s'
    ];
    
    console.log(`🔍 Running: ${ytdlpPath} ${args.join(' ')}`);
    
    exec(`"${ytdlpPath}" ${args.join(' ')}`, async (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Audio download failed:', error.message);
        console.log('Stderr:', stderr);
        reject(error);
      } else {
        console.log('✅ Audio download completed');
        console.log('Stdout:', stdout);
        
        // Check if audio file was created  
        try {
          const files = await fs.readdir('.');
          const audioFile = files.find(f => f.includes('debug-audio') && (f.endsWith('.wav') || f.endsWith('.m4a')));
          
          if (audioFile) {
            console.log(`🎵 Found audio file: ${audioFile}`);
            const stats = await fs.stat(audioFile);
            console.log(`📊 Audio file size: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);
            
            // Clean up
            await fs.unlink(audioFile);
            resolve(audioFile);
          } else {
            console.log('❌ No audio file found');
            resolve(null);
          }
        } catch (readError) {
          console.log('❌ Error checking audio file:', readError.message);
          reject(readError);
        }
      }
    });
  });
}

// Run all tests
async function runAllTests() {
  try {
    console.log('🚀 Starting comprehensive debugging...\n');
    
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
    console.log('- If yt-dlp tests failed: Audio download and subtitle fallbacks won\'t work');
    console.log('- Check your server\'s network access to YouTube');
    console.log('- Ensure yt-dlp binary has execute permissions on Linux');
    
  } catch (error) {
    console.error('💥 Debug script failed:', error);
  }
}

// Run the tests
runAllTests();
