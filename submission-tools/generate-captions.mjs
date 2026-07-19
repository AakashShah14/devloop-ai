import fs from 'node:fs/promises';

const narrationPath = process.argv[2];
const duration = Number(process.argv[3]);
const outputPath = process.argv[4];

if (!narrationPath || !Number.isFinite(duration) || !outputPath) {
  throw new Error('Usage: node generate-captions.mjs <narration> <duration-seconds> <output>');
}

const narration = await fs.readFile(narrationPath, 'utf8');
const paragraphs = narration
  .split(/\n\s*\n/)
  .map((value) => value.trim())
  .filter(Boolean);

const segments = paragraphs.flatMap((paragraph) => {
  const words = paragraph.split(/\s+/);
  const chunks = [];
  while (words.length) {
    let end = Math.min(14, words.length);
    for (let index = end - 1; index >= 8; index -= 1) {
      if (/[.!?]$/.test(words[index])) {
        end = index + 1;
        break;
      }
    }
    chunks.push(words.splice(0, end).join(' '));
  }
  return chunks;
});

const weights = segments.map((value) => value.split(/\s+/).length + 3);
const totalWeight = weights.reduce((sum, value) => sum + value, 0);
const usableDuration = Math.max(duration - 0.5, 1);
let cursor = 0;

function timestamp(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

const blocks = segments.map((segment, index) => {
  const start = cursor;
  const share = (weights[index] / totalWeight) * usableDuration;
  cursor += share;
  const end = index === segments.length - 1 ? usableDuration : cursor;
  return `${index + 1}\n${timestamp(start)} --> ${timestamp(end)}\n${segment}\n`;
});

await fs.writeFile(outputPath, `${blocks.join('\n')}\n`);
