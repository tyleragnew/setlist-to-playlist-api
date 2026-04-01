import { Injectable } from '@nestjs/common';
import sharp = require('sharp');
import * as opentype from 'opentype.js';
import * as path from 'path';

@Injectable()
export class CoverImageService {
  private font: opentype.Font;
  private faviconSvg: string;

  constructor() {
    const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
    this.font = opentype.loadSync(path.join(fontsDir, 'Outfit-Bold.ttf'));

    // Hardcoded S2P path from Inter ExtraBold with letter-spacing -1, matching frontend favicon exactly
    const s2pPathData =
      'M17.45 44.27Q14.90 44.27 13.02 43.51Q11.13 42.74 10.08 41.18Q9.03 39.63 8.98 37.27L13.62 37.27Q13.69 38.26 14.16 38.93Q14.63 39.60 15.46 39.93Q16.29 40.27 17.39 40.27Q18.39 40.27 19.12 39.99Q19.84 39.72 20.23 39.23Q20.62 38.74 20.62 38.08Q20.62 37.49 20.26 37.08Q19.89 36.67 19.17 36.36Q18.45 36.04 17.32 35.80L15.16 35.29Q12.53 34.69 11.02 33.32Q9.52 31.96 9.52 29.66Q9.52 27.77 10.54 26.35Q11.57 24.93 13.35 24.14Q15.14 23.36 17.45 23.36Q19.81 23.36 21.55 24.16Q23.29 24.96 24.24 26.38Q25.20 27.81 25.23 29.70L20.59 29.70Q20.50 28.59 19.69 27.98Q18.88 27.36 17.43 27.36Q16.48 27.36 15.82 27.61Q15.16 27.87 14.84 28.31Q14.51 28.76 14.51 29.33Q14.51 29.96 14.88 30.39Q15.25 30.82 15.93 31.11Q16.61 31.39 17.52 31.60L19.28 32.01Q20.76 32.32 21.91 32.86Q23.07 33.40 23.87 34.16Q24.67 34.91 25.08 35.89Q25.50 36.88 25.50 38.09Q25.50 40.02 24.54 41.41Q23.57 42.80 21.77 43.54Q19.98 44.27 17.45 44.27Z M42.01 44L27.00 44L27.00 40.54L34.41 33.99Q35.26 33.23 35.85 32.58Q36.45 31.93 36.76 31.29Q37.08 30.64 37.08 29.86Q37.08 29.02 36.70 28.41Q36.33 27.80 35.68 27.47Q35.03 27.14 34.18 27.14Q33.32 27.14 32.68 27.48Q32.03 27.83 31.68 28.48Q31.32 29.14 31.32 30.07L26.73 30.07Q26.73 28.00 27.67 26.50Q28.60 25.00 30.28 24.18Q31.96 23.36 34.19 23.36Q36.49 23.36 38.19 24.13Q39.89 24.90 40.82 26.29Q41.75 27.68 41.75 29.49Q41.75 30.66 41.30 31.78Q40.84 32.91 39.64 34.31Q38.45 35.70 36.23 37.62L33.70 39.97L33.70 40.10L42.01 40.10L42.01 44Z M48.75 44L43.93 44L43.93 23.63L52.27 23.63Q54.56 23.63 56.23 24.52Q57.90 25.41 58.79 26.99Q59.69 28.58 59.69 30.67Q59.69 32.78 58.77 34.33Q57.86 35.89 56.16 36.77Q54.47 37.64 52.13 37.64L48.75 37.64L48.75 44ZM48.75 27.54L48.75 33.83L51.25 33.83Q52.39 33.83 53.15 33.43Q53.92 33.04 54.30 32.32Q54.69 31.61 54.69 30.67Q54.69 29.71 54.30 29.01Q53.92 28.30 53.15 27.92Q52.38 27.54 51.24 27.54L48.75 27.54Z';
    this.faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="32" fill="#121212"/>
      <path d="${s2pPathData}" fill="#1DB954"/>
    </svg>`;
  }

  private async solidBackground(size: number): Promise<Buffer> {
    return sharp({
      create: { width: size, height: size, channels: 4, background: '#1a1a1a' },
    })
      .png()
      .toBuffer();
  }

  private wrapText(text: string, fontSize: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (this.font.getAdvanceWidth(test, fontSize) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
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

  async generateCoverImage(
    artistName: string,
    artistImageUrl?: string,
  ): Promise<string> {
    const size = 640;

    // 1. Process the Background Artist Image
    let artistImgBuffer: Buffer;

    if (artistImageUrl) {
      try {
        const response = await fetch(artistImageUrl);
        const arrayBuffer = await response.arrayBuffer();

        artistImgBuffer = await sharp(Buffer.from(arrayBuffer))
          .resize(size, size, { fit: 'cover' })
          .grayscale()
          .linear(1.2, -20)
          .ensureAlpha()
          .composite([
            {
              input: Buffer.from(
                `<svg><rect width="${size}" height="${size}" fill="black" fill-opacity="0.3"/></svg>`,
              ),
              top: 0,
              left: 0,
            },
          ])
          .toBuffer();
      } catch {
        artistImgBuffer = await this.solidBackground(size);
      }
    } else {
      artistImgBuffer = await this.solidBackground(size);
    }

    // 2. Build favicon for upper-left corner
    const iconSize = 64;
    const margin = 30;
    const faviconBuffer = await sharp(Buffer.from(this.faviconSvg))
      .resize(iconSize, iconSize)
      .png()
      .toBuffer();

    // 3. Build artist name overlay — split into lines that fit
    const displayName = artistName.toUpperCase();
    const maxWidth = size - margin * 2;
    let artistFontSize = displayName.length > 12 ? 80 : 110;

    // Scale down if any single word is wider than maxWidth
    for (const word of displayName.split(' ')) {
      while (
        artistFontSize > 30 &&
        this.font.getAdvanceWidth(word, artistFontSize) > maxWidth
      ) {
        artistFontSize -= 4;
      }
    }

    const lines = this.wrapText(displayName, artistFontSize, maxWidth);

    // Subtitle line
    const subtitleFontSize = 16;
    const subtitle = 'Generated by Setlist2Playlist.app';

    // Position from the bottom: subtitle first, then lines above it
    const subtitleY = size - margin;
    const lineHeight = artistFontSize * 1.1;
    const artistBaseY =
      subtitleY - subtitleFontSize * 1.5 - (lines.length - 1) * lineHeight;

    const linePaths = lines
      .map((line, i) =>
        this.textToPath(
          line,
          margin,
          artistBaseY + i * lineHeight,
          artistFontSize,
          '#ffffff',
        ),
      )
      .join('\n');

    const subtitlePath = this.textToPath(
      subtitle,
      margin,
      subtitleY,
      subtitleFontSize,
      'rgba(255,255,255,0.6)',
    );

    const overlaySvg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        ${linePaths}
        ${subtitlePath}
      </svg>
    `;

    // 4. Composite everything
    const finalImage = await sharp(artistImgBuffer)
      .composite([
        { input: Buffer.from(overlaySvg), top: 0, left: 0 },
        { input: faviconBuffer, top: margin, left: size - margin - iconSize },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    return finalImage.toString('base64');
  }
}
