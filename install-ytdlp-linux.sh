#!/bin/bash

# Simple yt-dlp installation script for Linux server
echo "🔧 Installing yt-dlp on Linux server..."

# Method 1: Try pip install
echo "📦 Trying pip install..."
if command -v pip3 >/dev/null 2>&1; then
    pip3 install yt-dlp
    if command -v yt-dlp >/dev/null 2>&1; then
        echo "✅ yt-dlp installed via pip3"
        yt-dlp --version
        exit 0
    fi
fi

if command -v pip >/dev/null 2>&1; then
    pip install yt-dlp
    if command -v yt-dlp >/dev/null 2>&1; then
        echo "✅ yt-dlp installed via pip"
        yt-dlp --version
        exit 0
    fi
fi

# Method 2: Direct download
echo "📥 Downloading yt-dlp binary directly..."
mkdir -p /app/bin
wget -O /app/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp
chmod +x /app/bin/yt-dlp

# Test the installation
if /app/bin/yt-dlp --version >/dev/null 2>&1; then
    echo "✅ yt-dlp installed successfully in /app/bin/"
    /app/bin/yt-dlp --version
else
    echo "❌ yt-dlp installation failed"
    exit 1
fi

# Method 3: System-wide installation
echo "📦 Installing system-wide..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod +x /usr/local/bin/yt-dlp

echo "🏁 Installation complete!"
echo "Test with: yt-dlp --version"
