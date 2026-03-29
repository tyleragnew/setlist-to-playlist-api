import { Injectable } from '@nestjs/common';
import sharp = require('sharp');
import * as path from 'path';

@Injectable()
export class CoverImageService {
  private fontsDir: string;
  private outfitBoldPath: string;
  private dmSansPath: string;

  constructor() {
    this.fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
    this.outfitBoldPath = path.join(this.fontsDir, 'Outfit-Bold.ttf');
    this.dmSansPath = path.join(this.fontsDir, 'DMSans-Regular.ttf');
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

    // Build description text
    const descText = playlistDescription
      ? this.wrapText(playlistDescription, 50).join('\n')
      : '';

    // Create base image with background and grid pattern
    const bgSvg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="#f5f5f5"/>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e8e8e8" stroke-width="0.5"/>
        </pattern>
        <rect width="${size}" height="${size}" fill="url(#grid)"/>
        <rect x="${padding}" y="${
      size - 210
    }" width="48" height="3" rx="1.5" fill="#1DB954"/>
      </svg>
    `;

    // Render text layers using sharp's native text API (Pango)
    const layers: sharp.OverlayOptions[] = [];

    // Artist name
    const nameLayer = await sharp({
      text: {
        text: `<span foreground="#111111" letter_spacing="${-320}">${this.escapeMarkup(
          displayName,
        )}</span>`,
        fontfile: this.outfitBoldPath,
        width: size - padding * 2,
        height: nameFontSize + 20,
        dpi: (nameFontSize / 12) * 72,
        rgba: true,
      },
    })
      .png()
      .toBuffer();
    layers.push({
      input: nameLayer,
      top: size - 170 - nameFontSize + 52,
      left: padding,
    });

    // Subtitle
    const subtitleLayer = await sharp({
      text: {
        text: `<span foreground="#666666">Setlist2Playlist</span>`,
        fontfile: this.outfitBoldPath,
        width: size - padding * 2,
        height: 46,
        dpi: (26 / 12) * 72,
        rgba: true,
      },
    })
      .png()
      .toBuffer();
    layers.push({ input: subtitleLayer, top: size - 130, left: padding });

    // Description
    if (descText) {
      const descLayer = await sharp({
        text: {
          text: `<span foreground="#888888">${this.escapeMarkup(
            descText,
          )}</span>`,
          fontfile: this.dmSansPath,
          width: size - padding * 2,
          height: 60,
          dpi: (14 / 12) * 72,
          rgba: true,
        },
      })
        .png()
        .toBuffer();
      layers.push({ input: descLayer, top: size - 92, left: padding });
    }

    // Footer
    const footerLayer = await sharp({
      text: {
        text: `<span foreground="#999999" letter_spacing="360">Generated ${this.escapeMarkup(
          dateStr,
        )} · Setlist2Playlist.app</span>`,
        fontfile: this.dmSansPath,
        width: size - padding * 2,
        height: 24,
        dpi: (12 / 12) * 72,
        rgba: true,
      },
    })
      .png()
      .toBuffer();
    layers.push({ input: footerLayer, top: size - 40, left: padding });

    // If we have an artist image, composite it in the top-right area
    if (artistImageUrl) {
      try {
        const response = await fetch(artistImageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const imgBuffer = Buffer.from(arrayBuffer);

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

        layers.push({
          input: circleImg,
          top: padding,
          left: size - imgSize - padding,
        });
      } catch {
        // If fetching artist image fails, continue without it
      }
    }

    const image = sharp(Buffer.from(bgSvg)).composite(layers);

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

  private escapeMarkup(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
