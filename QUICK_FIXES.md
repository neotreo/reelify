# Quick Fixes for Server Issues

## 1. Install yt-dlp on your Linux server

Run one of these commands on your server:

```bash
# Option A: Using pip (recommended)
pip3 install yt-dlp

# Option B: Direct download to project
mkdir -p /app/bin
wget -O /app/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x /app/bin/yt-dlp

# Option C: System-wide installation
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod +x /usr/local/bin/yt-dlp

# Test installation
yt-dlp --version
```

## 2. Fix the Direct API Issue

The good news is that the Direct YouTube API is returning status 200, but the responses are empty. This means:

1. **Your server can reach YouTube** ✅
2. **The API endpoints are working** ✅  
3. **The specific video might not have captions** ❌

Try with a different video that definitely has captions:

```javascript
// In debug-transcript.js, change this line:
const TEST_VIDEO_ID = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video with captions

// Or try:
const TEST_VIDEO_ID = 'M7lc1UVf-VE'; // Popular video with confirmed captions
```

## 3. Current Status from Your Debug

- ✅ **Server can reach YouTube APIs** (200 status codes)
- ❌ **yt-dlp binary missing** (needs installation)
- ❌ **Empty API responses** (try different video)

## 4. Expected Fixes

After installing yt-dlp and testing with a video that has captions:

1. **Primary method**: Direct API should work and return transcript
2. **Fallback method**: yt-dlp subtitle extraction should work
3. **Last resort**: Audio download + AssemblyAI should work

## 5. Testing Steps

1. Install yt-dlp using one of the methods above
2. Update the test video ID in debug-transcript.js
3. Run the debug script again: `node debug-transcript.js`
4. Check if you see actual transcript content instead of empty responses

## 6. If Direct API Still Returns Empty

The most likely cause is that the Rick Roll video doesn't have accessible captions. Try these video IDs that definitely have captions:

```
jNQXAC9IVRw  // Me at the zoo (first YouTube video)
M7lc1UVf-VE  // EGG (popular video)
kJQP7kiw5Fk  // Despacito (most viewed)
```

## 7. Production Fix

Once yt-dlp is installed on your server, your main app should work much better because:

1. More transcript methods will be available
2. Audio download fallback will work
3. Better error handling will provide useful messages instead of crashes
