import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const stat = promisify(fs.stat);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    if (!filePath) {
      return new NextResponse('Missing file path', { status: 400 });
    }

    // Security: Only allow files from the temp directories
    const allowedDirs = [
      path.join(process.cwd(), 'temp_video'),
      path.join(process.cwd(), 'temp_audio')
    ];
    
    const normalizedPath = path.normalize(filePath);
    const isAllowed = allowedDirs.some(dir => normalizedPath.startsWith(dir));
    
    if (!isAllowed) {
      return new NextResponse('Unauthorized file access', { status: 403 });
    }

    // Check if file exists and get its stats
    const stats = await stat(normalizedPath);
    
    // Create a readable stream from the file
    const stream = fs.createReadStream(normalizedPath);
    
    // Determine content type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') contentType = 'video/webm';
    if (ext === '.avi') contentType = 'video/avi';
    if (ext === '.mov') contentType = 'video/quicktime';
    if (ext === '.mkv') contentType = 'video/x-matroska';
    
    // Return the video file as a stream
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
        console.error("File not found:", error.path);
        return new NextResponse('File not found', { status: 404 });
    }
    console.error('Error serving video file:', error);
    return new NextResponse(
      `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      { status: 500 }
    );
  }