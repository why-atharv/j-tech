import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'voice');
const { LINES } = await import(pathToFileURL(path.join(root, 'src', 'shared', 'narration.js')).href);
fs.mkdirSync(out, { recursive: true });
for (const [key, line] of Object.entries(LINES)) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata('hi-IN-SwaraNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(line.say.replace(/\.\.\./g, '…'), { rate: '-4%', pitch: '+9%' });
  const chunks = [];
  await new Promise((res, rej) => {
    audioStream.on('data', (c) => chunks.push(c));
    audioStream.on('end', res);
    audioStream.on('error', rej);
  });
  fs.writeFileSync(path.join(out, `${key}.mp3`), Buffer.concat(chunks));
  console.log(`${key}.mp3`);
  tts.close?.();
}
