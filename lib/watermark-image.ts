import sharp from 'sharp';

export async function addImageWatermark(
  buffer: Buffer,
  email: string,
  date: string,
): Promise<Buffer> {
  const img = sharp(buffer);
  const { width = 800, height = 600 } = await img.metadata();

  const text = `CONFIDENTIAL — ${email} — ${date}`;
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.03));
  const textLen = text.length * fontSize * 0.6;

  // Single centred diagonal label
  const svgOverlay = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text {
          font-family: Arial, sans-serif;
          font-size: ${fontSize}px;
          font-weight: bold;
          fill: rgba(180,0,0,0.35);
        }
      </style>
      <text
        x="${width / 2}"
        y="${height / 2}"
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(-35, ${width / 2}, ${height / 2})"
        textLength="${Math.min(textLen, width * 0.85)}"
        lengthAdjust="spacing"
      >${text}</text>
      <text
        x="${width / 2}"
        y="${height * 0.25}"
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(-35, ${width / 2}, ${height * 0.25})"
        textLength="${Math.min(textLen, width * 0.85)}"
        lengthAdjust="spacing"
      >${text}</text>
      <text
        x="${width / 2}"
        y="${height * 0.75}"
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(-35, ${width / 2}, ${height * 0.75})"
        textLength="${Math.min(textLen, width * 0.85)}"
        lengthAdjust="spacing"
      >${text}</text>
    </svg>`;

  return img
    .composite([{ input: Buffer.from(svgOverlay), blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
