const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const YTDLP_DIR = path.join(process.cwd(), 'bin');
const YTDLP_PATH = path.join(YTDLP_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

async function downloadYtDlp() {
  console.log('📥 Installing yt-dlp...');
  
  // Create bin directory if it doesn't exist
  if (!fs.existsSync(YTDLP_DIR)) {
    fs.mkdirSync(YTDLP_DIR, { recursive: true });
    console.log('📁 Created bin directory');
  }

  // Check if yt-dlp already exists and is recent
  if (fs.existsSync(YTDLP_PATH)) {
    const stats = fs.statSync(YTDLP_PATH);
    const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
    
    if (ageInDays < 7) {
      console.log('✅ yt-dlp is already installed and recent');
      return;
    }
    
    console.log('🔄 yt-dlp exists but is outdated, updating...');
  }

  try {
    // Use yt-dlp's self-update if it exists, otherwise download fresh
    if (fs.existsSync(YTDLP_PATH)) {
      try {
        await execAsync(`"${YTDLP_PATH}" -U`);
        console.log('✅ yt-dlp updated successfully');
        return;
      } catch (updateError) {
        console.log('⚠️ Self-update failed, downloading fresh copy...');
      }
    }

    // Download fresh copy
    const downloadUrl = process.platform === 'win32' 
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

    console.log('📥 Downloading yt-dlp from GitHub...');
    
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(YTDLP_PATH);
      
      https.get(downloadUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            
            file.on('finish', () => {
              file.close();
              resolve();
            });
            
            file.on('error', reject);
          }).on('error', reject);
        } else {
          response.pipe(file);
          
          file.on('finish', () => {
            file.close();
            resolve();
          });
          
          file.on('error', reject);
        }
      }).on('error', reject);
    });

    // Make executable on Unix systems
    if (process.platform !== 'win32') {
      fs.chmodSync(YTDLP_PATH, '755');
    }

    console.log('✅ yt-dlp installed successfully');
    
    // Test the installation
    try {
      const testCommand = process.platform === 'win32' 
        ? `"${YTDLP_PATH}" --version`
        : `"${YTDLP_PATH}" --version`;
      
      const { stdout } = await execAsync(testCommand);
      console.log(`🎉 yt-dlp version: ${stdout.trim()}`);
    } catch (testError) {
      console.log('⚠️ Version check failed, but binary was installed. This may be normal on some systems.');
      console.log('yt-dlp should still work for video processing.');
    }

  } catch (error) {
    console.error('❌ Failed to install yt-dlp:', error.message);
    throw error;
  }
}

if (require.main === module) {
  downloadYtDlp().catch(console.error);
}

module.exports = { downloadYtDlp, YTDLP_PATH };
