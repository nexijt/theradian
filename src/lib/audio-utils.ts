/**
 * Trims an audio file to the first `maxSeconds` seconds using the Web Audio API.
 * Also downmixes to mono and resamples to 22050 Hz for compression.
 * Returns the original file if it's already shorter than maxSeconds AND small enough.
 */
export async function trimAudioToSeconds(file: File, maxSeconds: number): Promise<File> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const needsTrim = decoded.duration > maxSeconds;
  const needsCompress = file.size > 500_000; // compress if > 500KB

  if (!needsTrim && !needsCompress) {
    audioCtx.close();
    return file;
  }

  const targetSampleRate = 22050; // reduced from typical 44100
  const duration = needsTrim ? maxSeconds : decoded.duration;
  const maxSamples = Math.floor(duration * targetSampleRate);

  // Render to mono at lower sample rate
  const offlineCtx = new OfflineAudioContext(1, maxSamples, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0, 0, duration);

  const rendered = await offlineCtx.startRendering();
  audioCtx.close();

  // Encode to WAV
  const wavBlob = audioBufferToWav(rendered);
  return new File([wavBlob], file.name.replace(/\.\w+$/, ".wav"), { type: "audio/wav" });
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const dataSize = length * numChannels * bytesPerSample;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}
