import { Injectable } from '@nestjs/common';
import sharp = require('sharp');
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class CoverImageService {
  private outfitBoldBase64: string;
  private dmSansBase64: string;

  constructor() {
    const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
    this.outfitBoldBase64 = fs
      .readFileSync(path.join(fontsDir, 'Outfit-Bold.ttf'))
      .toString('base64');
    this.dmSansBase64 = fs
      .readFileSync(path.join(fontsDir, 'DMSans-Regular.ttf'))
      .toString('base64');
  }

  async generateCoverImage(
    artistName: string,
    artistImageUrl?: string,
    playlistDescription?: string,
  ): Promise<string> {
    const size = 640;
    const padding = 48;

    // Truncate long artist names
    const displayName =
      artistName.length > 30 ? artistName.substring(0, 28) + '...' : artistName;

    // Scale font size based on name length
    const nameFontSize =
      displayName.length > 20 ? 52 : displayName.length > 14 ? 64 : 76;

    // Format today's date
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // Wrap description text into lines (~45 chars per line at font-size 14)
    const descLines = playlistDescription
      ? this.wrapText(playlistDescription, 50)
      : [];
    const descSvg = descLines
      .map(
        (line, i) =>
          `<tspan x="${padding}" dy="${i === 0 ? 0 : 18}">${this.escapeXml(
            line,
          )}</tspan>`,
      )
      .join('');

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
            @font-face {
              font-family: 'DM Sans';
              src: url('data:font/ttf;base64,${
                this.dmSansBase64
              }') format('truetype');
              font-weight: 400;
            }
          </style>
        </defs>

        <!-- Background -->
        <rect width="${size}" height="${size}" fill="#f5f5f5"/>

        <!-- Subtle grid pattern -->
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e8e8e8" stroke-width="0.5"/>
        </pattern>
        <rect width="${size}" height="${size}" fill="url(#grid)"/>

        <!-- Accent line -->
        <rect x="${padding}" y="${
      size - 210
    }" width="48" height="3" rx="1.5" fill="#1DB954"/>

        <!-- Artist name -->
        <text
          x="${padding}"
          y="${size - 155}"
          font-family="Outfit, sans-serif"
          font-weight="700"
          font-size="${nameFontSize}"
          fill="#111111"
          letter-spacing="-0.02em"
        >${this.escapeXml(displayName)}</text>

        <!-- Subtitle -->
        <text
          x="${padding}"
          y="${size - 105}"
          font-family="Outfit, sans-serif"
          font-weight="700"
          font-size="26"
          fill="#666666"
        >Setlist2Playlist</text>

        <!-- Description -->
        ${
          descLines.length > 0
            ? `
        <text
          x="${padding}"
          y="${size - 78}"
          font-family="DM Sans, sans-serif"
          font-weight="400"
          font-size="14"
          fill="#888888"
        >${descSvg}</text>
        `
            : ''
        }

        <!-- Footer -->
        <text
          x="${padding}"
          y="${size - 28}"
          font-family="DM Sans, sans-serif"
          font-weight="400"
          font-size="12"
          fill="#999999"
          letter-spacing="0.03em"
        >Generated ${this.escapeXml(dateStr)} · Setlist2Playlist.app</text>
      </svg>
    `;

    let image = sharp(Buffer.from(svg));

    // If we have an artist image, composite it in the top-right area
    if (artistImageUrl) {
      try {
        const response = await fetch(artistImageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const imgBuffer = Buffer.from(arrayBuffer);

        // Create a circular masked version of the artist image
        const imgSize = 260;
        const circleImg = await sharp(imgBuffer)
          .resize(imgSize, imgSize, { fit: 'cover' })
          .composite([
            {
              input: Buffer.from(
                `<svg width="${imgSize}" height="${imgSize}">
                  <rect width="${imgSize}" height="${imgSize}" fill="black"/>
                  <circle cx="${imgSize / 2}" cy="${imgSize / 2}" r="${
                  imgSize / 2
                }" fill="white"/>
                </svg>`,
              ),
              blend: 'dest-in',
            },
          ])
          .png()
          .toBuffer();

        image = sharp(Buffer.from(svg)).composite([
          {
            input: circleImg,
            top: padding,
            left: size - imgSize - padding,
          },
        ]);
      } catch {
        // If fetching artist image fails, continue without it
      }
    }

    const jpegBuffer = await image.jpeg({ quality: 90 }).toBuffer();

    return jpegBuffer.toString('base64');
  }

  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      if (current && (current + ' ' + word).length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) lines.push(current);
    return lines.slice(0, 3); // max 3 lines
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
