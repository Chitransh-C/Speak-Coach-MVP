/** Mic capture (→16 kHz PCM) and speaker playback (24 kHz PCM) for Gemini Live. */

function floatTo16BitPCM(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === 16000) return input;
  const ratio = inputRate / 16000;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    out[i] = input[Math.floor(i * ratio)] ?? 0;
  }
  return out;
}

export function pcm16Base64FromFloat32(float32: Float32Array, inputRate: number): string {
  const at16k = downsampleTo16k(float32, inputRate);
  const pcm = floatTo16BitPCM(at16k);
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToInt16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
}

export type MicCaptureHandle = {
  stop: () => void;
};

function rmsLevel(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

export async function startMicCapture(
  onPcmBase64: (base64: string) => void,
  onLevel?: (level01: number) => void,
): Promise<MicCaptureHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const copy = new Float32Array(input.length);
    copy.set(input);
    if (onLevel) {
      // Map typical speech RMS into a punchier 0..1 for the orb
      const raw = rmsLevel(copy);
      onLevel(Math.min(1, raw * 8));
    }
    const b64 = pcm16Base64FromFloat32(copy, audioContext.sampleRate);
    onPcmBase64(b64);
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  return {
    stop: () => {
      try {
        processor.disconnect();
        source.disconnect();
      } catch {
        /* ignore */
      }
      for (const track of stream.getTracks()) track.stop();
      void audioContext.close();
    },
  };
}

/** Simple queued PCM player; call flush() on model interruption. */
export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private sources: AudioBufferSourceNode[] = [];

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 24000 });
      this.nextTime = this.ctx.currentTime;
    }
    return this.ctx;
  }

  enqueueBase64Pcm(base64: string, sampleRate = 24000) {
    const ctx = this.ensureCtx();
    const pcm = base64ToInt16(base64);
    if (pcm.length === 0) return;

    const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, this.nextTime);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
    this.sources.push(source);
    source.onended = () => {
      this.sources = this.sources.filter((s) => s !== source);
    };
  }

  /** Drop queued / playing AI audio immediately (barge-in). */
  flush() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* ignore */
      }
    }
    this.sources = [];
    if (this.ctx) this.nextTime = this.ctx.currentTime;
  }

  /** Milliseconds of AI audio still queued / playing. */
  remainingMs(): number {
    if (!this.ctx) return 0;
    return Math.max(0, (this.nextTime - this.ctx.currentTime) * 1000);
  }

  /** Wait until queued playback finishes (or timeout). Does not flush. */
  async drain(timeoutMs = 12_000): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const left = this.remainingMs();
      if (left <= 40 && this.sources.length === 0) return;
      await new Promise((r) => setTimeout(r, Math.min(150, Math.max(40, left / 2))));
    }
  }

  async close(opts?: { flush?: boolean }) {
    if (opts?.flush === false) {
      await this.drain(2_000);
    } else {
      this.flush();
    }
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}
