const sharp = require('sharp');
const opentype = require('opentype.js');
const path = require('path');
const fs = require('fs');

const assetsDir = path.join(__dirname, '..', 'src', 'assets');
const outPath = path.join(__dirname, '..', '..', 'setlist-to-playlist-frontend', 'public', 'og-image.png');

const outfitBold = opentype.loadSync(path.join(assetsDir, 'fonts', 'Outfit-Bold.ttf'));
const dmSans = opentype.loadSync(path.join(assetsDir, 'fonts', 'DMSans-Regular.ttf'));
const faviconBuffer = fs.readFileSync(path.join(assetsDir, 'favicon.png'));

function textToPath(font, text, x, y, fontSize, fill) {
  const p = font.getPath(text, x, y, fontSize);
  return `<path d="${p.toPathData()}" fill="${fill}"/>`;
}

async function generate() {
  const w = 1200;
  const h = 630;
  const margin = 60;
  const green = '#1DB954';

  // Dark background
  const bg = await sharp({
    create: { width: w, height: h, channels: 4, background: '#0d0d1a' },
  }).png().toBuffer();

  // Favicon in top-left
  const iconSize = 56;
  const faviconPng = await sharp(faviconBuffer)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  // "SETLIST2PLAYLIST" title
  const titleText = 'SETLIST2PLAYLIST';
  const titleSize = 72;
  const titleY = margin + titleSize + 40;

  // Tagline
  const taglineText = 'Your cheat-sheet before the show';
  const taglineSize = 32;
  const taglineY = titleY + 50;

  // Description
  const descText = 'Turn any concert setlist into a Spotify playlist';
  const descSize = 24;
  const descY = taglineY + 50;

  // Domain
  const domainText = 'setlist2playlist.app';
  const domainSize = 20;
  const domainY = h - margin;

  // Accent bar
  const barY = titleY + 16;

  const svgOverlay = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <!-- Subtle grid pattern -->
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#grid)"/>

      <!-- Green accent bar -->
      <rect x="${margin}" y="${barY}" width="80" height="4" rx="2" fill="${green}"/>

      <!-- Title -->
      ${textToPath(outfitBold, titleText, margin, titleY, titleSize, '#ffffff')}

      <!-- Tagline -->
      ${textToPath(outfitBold, taglineText, margin, taglineY, taglineSize, green)}

      <!-- Description -->
      ${textToPath(dmSans, descText, margin, descY, descSize, 'rgba(255,255,255,0.6)')}

      <!-- Domain -->
      ${textToPath(dmSans, domainText, margin, domainY, domainSize, 'rgba(255,255,255,0.4)')}
    </svg>
  `;

  const finalImage = await sharp(bg)
    .composite([
      { input: Buffer.from(svgOverlay), top: 0, left: 0 },
      { input: faviconPng, top: margin, left: w - margin - iconSize },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(outPath, finalImage);
  console.log(`OG image written to ${outPath} (${(finalImage.length / 1024).toFixed(0)} KB)`);
}

generate().catch(console.error);
