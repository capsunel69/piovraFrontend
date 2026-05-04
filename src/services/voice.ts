/**
 * Voice client for the Piovra orchestrator.
 *
 * Endpoints (auth via session cookie):
 *   GET  /v1/voice/capabilities    -> { stt: { available, ... }, tts: { ... } }
 *   POST /v1/voice/stt             -> { text }   (raw audio body, content-type = mime)
 *   POST /v1/voice/tts             -> audio/*   (JSON body { text, voice?, ... })
 *
 * STT is OpenAI's `gpt-4o-mini-transcribe`.
 * TTS is ElevenLabs (defaults to the Anca / Leon voices configured server-side).
 */

const PIOVRA_BASE_URL = (import.meta.env.VITE_PIOVRA_BASE_URL as string | undefined) ?? '';
const BASE_URL = `${PIOVRA_BASE_URL}/v1`;

export type VoiceGender = 'feminine' | 'masculine' | 'neutral';

export interface VoiceDescriptor {
  id: string;
  name: string;
  gender: VoiceGender;
}

export interface VoiceCapabilities {
  stt: {
    available: boolean;
    provider: 'openai' | null;
    model: string;
  };
  tts: {
    available: boolean;
    provider: 'elevenlabs' | 'openai' | null;
    model: string;
    voices: VoiceDescriptor[];
    /** ElevenLabs voice id (e.g. `GRHbHyXbUO8nF4YexVTa` for Anca). */
    defaultVoice: string;
  };
}

export interface TtsOptions {
  text: string;
  /** ElevenLabs voice id; falls back to the orchestrator default. */
  voice?: string;
  /** ElevenLabs model id, e.g. `eleven_turbo_v2_5` or `eleven_multilingual_v2`. */
  model?: string;
  /** Output format. `mp3_44100_128` plays everywhere; defaults to that server-side. */
  format?:
    | 'mp3_22050_32'
    | 'mp3_44100_32'
    | 'mp3_44100_64'
    | 'mp3_44100_96'
    | 'mp3_44100_128'
    | 'mp3_44100_192'
    | 'opus_48000_64'
    | 'opus_48000_96'
    | 'opus_48000_128'
    | 'opus_48000_192';
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speakerBoost?: boolean;
  signal?: AbortSignal;
}

export const VoiceAPI = {
  async getCapabilities(signal?: AbortSignal): Promise<VoiceCapabilities> {
    const res = await fetch(`${BASE_URL}/voice/capabilities`, { signal, credentials: 'include' });
    if (!res.ok) throw new Error(`Voice capabilities -> ${res.status}`);
    return (await res.json()) as VoiceCapabilities;
  },

  async transcribe(audio: Blob, opts?: { language?: string; signal?: AbortSignal }): Promise<string> {
    const qs = opts?.language ? `?language=${encodeURIComponent(opts.language)}` : '';
    const res = await fetch(`${BASE_URL}/voice/stt${qs}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': audio.type || 'audio/webm' },
      body: audio,
      signal: opts?.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Voice STT -> ${res.status}`);
    }
    const data = (await res.json()) as { text?: string };
    return (data.text ?? '').trim();
  },

  async synthesize(opts: TtsOptions): Promise<Blob> {
    const { signal, ...body } = opts;
    const res = await fetch(`${BASE_URL}/voice/tts`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Voice TTS -> ${res.status}`);
    }
    return res.blob();
  },
};
