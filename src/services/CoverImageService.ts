import { Injectable } from '@nestjs/common';
import sharp = require('sharp');
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class CoverImageService {
  private outfitBoldBase64: string;

  constructor() {
    const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
    this.outfitBoldBase64 = fs
      .readFileSync(path.join(fontsDir, 'Outfit-Bold.ttf'))
      .toString('base64');
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

    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            @font-face {
              font-family: 'Outfit';
              src: url('data:font/ttf;base64,${
                this.outfitBoldBase64
              }') format('truetype');
              font-weight: 700;
            }
          </style>
        </defs>

        <!-- White background -->
        <rect width="${size}" height="${size}" fill="#ffffff"/>

        <!-- Grey fill for image area (fallback if no artist image) -->
        <rect x="${border}" y="${border}" width="${imgArea}" height="${imgArea}" fill="#e8e8e8"/>

        <!-- Top border: Setlist2Playlist branding -->
        <text
          x="${border}"
          y="${Math.round(border * 0.72)}"
          font-family="Outfit, sans-serif"
          font-weight="700"
          font-size="26"
          letter-spacing="-0.02em"
        ><tspan fill="#111111">Setlist</tspan><tspan fill="#1DB954">2</tspan><tspan fill="#111111">Playlist</tspan></text>

        <!-- Bottom border: artist name (right-aligned) -->
        <text
          x="${size - border}"
          y="${size - Math.round(border * 0.28)}"
          font-family="Outfit, sans-serif"
          font-weight="700"
          font-size="24"
          fill="#111111"
          letter-spacing="-0.01em"
          text-anchor="end"
        >${this.escapeXml(displayName)}</text>
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

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
