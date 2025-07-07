import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    
    console.log("API request for file:", filePath);
    
    if (!filePath) {
      console.error("Missing file path parameter");
      return new NextResponse('Missing file path', { status: 400 });
    }

    // Security: Only allow files from the temp directories
    const allowedDirs = [
      path.join(process.cwd(), 'temp_video'),
      path.join(process.cwd(), 'temp_audio')
    ];
    
    const normalizedPath = path.normalize(filePath);
    const isAllowed = allowedDirs.some(dir => normalizedPath.startsWith(dir));
    
    console.log("File path check:", {
      normalizedPath,
      allowedDirs,
      isAllowed
    });
    
    if (!isAllowed) {
      console.error("Unauthorized file access:", normalizedPath);
      return new NextResponse('Unauthorized file access', { status: 403 });
    }

    // Check if file exists
    try {
      await fs.access(normalizedPath);
      console.log("File exists:", normalizedPath);
    } catch (accessError) {
      console.error("File not found:", normalizedPath, accessError);
      return new NextResponse('File not found', { status: 404 });
    }

    // Read the file
    const fileBuffer = await fs.readFile(normalizedPath);
    console.log("File read successfully, size:", fileBuffer.length);
    
    // Determine content type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    let contentType = 'video/mp4';
    if (ext === '.webm') contentType = 'video/webm';
    if (ext === '.avi') contentType = 'video/avi';
    if (ext === '.mov') contentType = 'video/quicktime';
    if (ext === '.mkv') contentType = 'video/x-matroska';
    
    console.log("Serving file with content type:", contentType);
    
    // Return the video file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error serving video file:', error);
    return new NextResponse(
      `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
      { status: 500 }
    );
  }
}