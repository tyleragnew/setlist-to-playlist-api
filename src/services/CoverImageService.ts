import { Injectable } from '@nestjs/common';
import sharp = require('sharp');
import * as opentype from 'opentype.js';
import * as path from 'path';

@Injectable()
export class CoverImageService {
  private font: opentype.Font;

  constructor() {
    const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
    this.font = opentype.loadSync(path.join(fontsDir, 'Outfit-Bold.ttf'));
  }

  private textToPath(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    fill: string,
  ): string {
    const p = this.font.getPath(text, x, y, fontSize);
    return `<path d="${p.toPathData()}" fill="${fill}"/>`;
  }

  private textToPathRightAligned(
    text: string,
    rightX: number,
    y: number,
    fontSize: number,
    fill: string,
  ): string {
    const width = this.font.getAdvanceWidth(text, fontSize);
    return this.textToPath(text, rightX - width, y, fontSize, fill);
  }

  async generateCoverImage(
    artistName: string,
    artistImageUrl?: string,
  ): Promise<string> {
    const size = 640;
    const border = 44;
    const imgArea = size - border * 2;

    // Truncate long artist names
    const displayName =
      artistName.length > 30 ? artistName.substring(0, 28) + '...' : artistName;

    // Build branding text as paths: "Setlist" + "2" + "Playlist"
    const brandY = Math.round(border * 0.72);
    const brandFontSize = 26;
    let brandX = border;
    const setlistPath = this.textToPath(
      'Setlist',
      brandX,
      brandY,
      brandFontSize,
      '#111111',
    );
    brandX += this.font.getAdvanceWidth('Setlist', brandFontSize);
    const twoPath = this.textToPath(
      '2',
      brandX,
      brandY,
      brandFontSize,
      '#1DB954',
    );
    brandX += this.font.getAdvanceWidth('2', brandFontSize);
    const playlistPath = this.textToPath(
      'Playlist',
      brandX,
      brandY,
      brandFontSize,
      '#111111',
    );

    // Artist name right-aligned at bottom
    const artistPath = this.textToPathRightAligned(
      displayName,
      size - border,
      size - Math.round(border * 0.28),
      24,
      '#111111',
    );

    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="#ffffff"/>
        <rect x="${border}" y="${border}" width="${imgArea}" height="${imgArea}" fill="#e8e8e8"/>
        ${setlistPath}
        ${twoPath}
        ${playlistPath}
        ${artistPath}
      </svg>
    `;

    let image = sharp(Buffer.from(svg));

    // Composite the artist image into the center area
    if (artistImageUrl) {
      try {
        const response = await fetch(artistImageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const imgBuffer = Buffer.from(arrayBuffer);

        const artistImg = await sharp(imgBuffer)
          .resize(imgArea, imgArea, { fit: 'cover' })
          .png()
          .toBuffer();

        image = sharp(Buffer.from(svg)).composite([
          { input: artistImg, top: border, left: border },
        ]);
      } catch {
        // If fetching artist image fails, continue without it
      }
    }

    const jpegBuffer = await image.jpeg({ quality: 90 }).toBuffer();
    return jpegBuffer.toString('base64');
  }
}
