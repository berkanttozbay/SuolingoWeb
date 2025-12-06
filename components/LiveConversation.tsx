import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../services/geminiService';

const LiveConversation: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [volume, setVolume] = useState(0);

  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Playback Refs
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // API Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-4), msg]);

  const stopSession = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop all playing audio
    scheduledSourcesRef.current.forEach(s => s.stop());
    scheduledSourcesRef.current.clear();

    setIsActive(false);
    addLog("Session ended.");
  };

  const startSession = async () => {
    try {
      addLog("Initializing audio context...");
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = audioContextRef.current.currentTime;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      addLog("Connecting to Gemini Live...");
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            addLog("Connection open! Start speaking.");
            
            if (!audioContextRef.current || !streamRef.current) return;

            // Setup Input Stream
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(streamRef.current);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // Visualization
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length));

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                 session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
            
            sourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (message) => {
            if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                const base64 = message.serverContent.modelTurn.parts[0].inlineData.data;
                
                if (!audioContextRef.current) return;

                // Decode and Schedule
                const audioBuffer = await decodeAudioData(
                    base64ToUint8Array(base64),
                    audioContextRef.current,
                    24000
                );
                
                const ctx = audioContextRef.current;
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                
                // Gapless playback logic
                const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
                source.start(startTime);
                nextStartTimeRef.current = startTime + audioBuffer.duration;
                
                scheduledSourcesRef.current.add(source);
                source.onended = () => scheduledSourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
                addLog("Interrupted by user.");
                scheduledSourcesRef.current.forEach(s => s.stop());
                scheduledSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            addLog("Connection closed.");
            stopSession();
          },
          onerror: (err) => {
            console.error(err);
            addLog("Error occurred.");
            stopSession();
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: "You are Suolingo, a friendly, encouraging English tutor. Keep responses concise and helpful.",
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' }}
            }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;
      setIsActive(true);

    } catch (e) {
      console.error(e);
      addLog("Failed to start session.");
    }
  };

  useEffect(() => {
    return () => stopSession();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col items-center justify-center space-y-8 min-h-[60vh]">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-suo-text">Live Conversation</h2>
        <p className="text-gray-500">Practice speaking in real-time with our AI tutor.</p>
      </div>

      <div className="relative">
        {/* Pulse Effect */}
        {isActive && (
            <div 
                className="absolute inset-0 rounded-full bg-suo-blue opacity-20 animate-ping"
                style={{ transform: `scale(${1 + volume * 5})` }}
            ></div>
        )}
        
        <div className={`relative w-48 h-48 rounded-full flex items-center justify-center transition-colors duration-500 ${isActive ? 'bg-suo-blue shadow-2xl shadow-blue-300' : 'bg-suo-gray'}`}>
           {isActive ? (
             <img src="https://picsum.photos/200/200?grayscale" alt="AI Avatar" className="w-40 h-40 rounded-full object-cover border-4 border-white opacity-90" />
           ) : (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
             </svg>
           )}
        </div>
      </div>

      <button
        onClick={isActive ? stopSession : startSession}
        className={`w-full max-w-sm px-8 py-4 rounded-xl font-bold text-white text-xl shadow-lg border-b-4 transform transition-all active:scale-95 ${
            isActive 
            ? 'bg-suo-red border-red-700 hover:bg-red-500' 
            : 'bg-suo-green border-suo-darkGreen hover:bg-green-500'
        }`}
      >
        {isActive ? 'End Conversation' : 'Start Talking'}
      </button>

      <div className="w-full bg-gray-50 rounded-xl p-4 h-32 overflow-y-auto border border-gray-200">
        <p className="text-xs font-bold text-gray-400 uppercase mb-2">System Logs</p>
        {logs.map((log, i) => (
            <p key={i} className="text-sm text-gray-600 font-mono">{log}</p>
        ))}
        {logs.length === 0 && <p className="text-sm text-gray-400 italic">Ready to connect...</p>}
      </div>
    </div>
  );
};

export default LiveConversation;