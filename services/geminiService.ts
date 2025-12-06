import { GoogleGenAI, Modality, Type } from "@google/genai";
import { PronunciationResult } from '../types';

// Helper to get client with current key
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Audio Encoding/Decoding Utilities for Live API ---
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const createPcmBlob = (data: Float32Array): { data: string; mimeType: string } => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: arrayBufferToBase64(int16.buffer),
    mimeType: 'audio/pcm;rate=16000',
  };
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// --- Core Features ---

// 1. Pronunciation Analysis (Multimodal Audio -> JSON)
export const analyzePronunciation = async (audioBase64: string, referenceText?: string): Promise<PronunciationResult> => {
  const ai = getClient();
  
  const promptText = referenceText 
    ? `The user is trying to say the sentence: "${referenceText}". Analyze their pronunciation of this specific sentence.`
    : "Analyze this pronunciation.";

  const systemPrompt = `
  You are an AI English pronunciation coach for "Suolingo".
  Analyze the audio. Return results in this JSON structure:
  {
    "recognized_text": "",
    "words": [
      {
        "word": "",
        "score": 0, // 0-100
        "is_correct": true,
        "ipa_correct": "",
        "ipa_user": "",
        "tip": ""
      }
    ],
    "highlighted_sentence": "" // Use <span class="wrong">word</span> for errors
  }
  Any word score below 75 is incorrect.
  If a reference sentence is provided, compare strictly against it. 
  If the user skips a word, mark it as score 0.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
        { text: promptText }
      ]
    },
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          recognized_text: { type: Type.STRING },
          highlighted_sentence: { type: Type.STRING },
          words: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                score: { type: Type.NUMBER },
                is_correct: { type: Type.BOOLEAN },
                ipa_correct: { type: Type.STRING },
                ipa_user: { type: Type.STRING },
                tip: { type: Type.STRING },
              }
            }
          }
        }
      }
    }
  });

  if (response.text) {
    return JSON.parse(response.text) as PronunciationResult;
  }
  throw new Error("No analysis generated");
};

// 2. Text to Speech
export const generateSpeech = async (text: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' },
        },
      },
    },
  });
  
  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error("No audio generated");
  return audioData;
};

// 3. Image Editing (Avatar Studio)
export const editAvatar = async (imageBase64: string, prompt: string): Promise<string> => {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/png', data: imageBase64 } },
        { text: prompt },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }
  throw new Error("No image generated");
};

// 4. Veo Video Generation
export const animateAvatar = async (imageBase64: string): Promise<string> => {
  const ai = getClient(); // IMPORTANT: Ensure key selection happens before calling this
  
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: 'A friendly character speaking kindly and nodding, high quality, realistic movement',
    image: {
      imageBytes: imageBase64,
      mimeType: 'image/png',
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) throw new Error("Video generation failed");
  return uri;
};

// 5. Video Understanding
export const analyzeVideo = async (videoUri: string, mimeType: string): Promise<string> => {
    const ai = getClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                { inlineData: { mimeType: mimeType, data: videoUri } }, 
                { text: "Analyze this video. What is the speaker saying and how is their body language?" }
            ]
        }
    });
    return response.text || "No analysis available.";
}