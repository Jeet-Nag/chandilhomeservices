import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SavedAudioResult {
  audioUrl: string;
  filename: string;
  byteSize: number;
}

export class AudioService {
  private readonly uploadDir: string;

  constructor(customUploadDir?: string) {
    this.uploadDir = customUploadDir || path.resolve(process.cwd(), 'uploads', 'audio');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Saves a base64 encoded audio recording to storage.
   * Limits size to 250 KB (30s at 16kbps is ~60 KB).
   */
  public async saveAudioBase64(base64Data: string, mimeType = 'audio/webm'): Promise<SavedAudioResult> {
    // Strip data URI prefix if present
    const cleanBase64 = base64Data.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length === 0) {
      throw new Error('Audio payload is empty.');
    }

    if (buffer.length > 256 * 1024) {
      throw new Error('Audio file exceeds maximum allowed limit (250 KB).');
    }

    let ext = 'webm';
    if (mimeType.includes('wav')) ext = 'wav';
    else if (mimeType.includes('ogg')) ext = 'ogg';
    else if (mimeType.includes('mp4')) ext = 'mp4';

    const filename = `${crypto.randomUUID()}.${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    return {
      audioUrl: `/api/audio/${filename}`,
      filename,
      byteSize: buffer.length,
    };
  }

  /**
   * Retrieves the absolute local path for a saved audio file.
   * Prevents path traversal vulnerabilities.
   */
  public getAudioFilePath(filename: string): string | null {
    // Sanitize filename: only allow UUID + safe extensions
    if (!/^[a-f0-9-]+\.(webm|ogg|wav|mp4)$/i.test(filename)) {
      return null;
    }

    const filePath = path.join(this.uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return filePath;
  }

  /**
   * Deletes a local audio file (e.g. on transaction rollback).
   */
  public async deleteAudioFile(filename: string): Promise<void> {
    try {
      const filePath = this.getAudioFilePath(filename);
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // Ignore cleanup error
    }
  }
}

export const audioService = new AudioService();
