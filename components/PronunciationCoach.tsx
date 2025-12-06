import React, { useState, useRef, useEffect } from 'react';
import { analyzePronunciation, generateSpeech, base64ToUint8Array, decodeAudioData } from '../services/geminiService';
import { PronunciationResult, WordAnalysis } from '../types';
import confetti from 'canvas-confetti';

interface PronunciationCoachProps {
  userAvatar: string | null;
}

const SENTENCES = [
  { text: "Hello, nice to meet you.", level: "Beginner" },
  { text: "I would like to order a coffee, please.", level: "Beginner" },
  { text: "The quick brown fox jumps over the lazy dog.", level: "Medium" },
  { text: "She sells seashells by the seashore.", level: "Hard" },
  { text: "Can you tell me how to get to the station?", level: "Medium" },
  { text: "I am learning to speak English with an AI coach.", level: "Medium" },
  { text: "What are your plans for the weekend?", level: "Beginner" },
  { text: "It is important to practice every single day.", level: "Hard" }
];

const PronunciationCoach: React.FC<PronunciationCoachProps> = ({ userAvatar }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [selectedWord, setSelectedWord] = useState<WordAnalysis | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  
  // Audio Visualizer State
  const [audioLevel, setAudioLevel] = useState(0);
  const animationFrameRef = useRef<number>(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentItem = SENTENCES[currentIndex];

  // Reset result when sentence changes
  useEffect(() => {
    setResult(null);
    setSelectedWord(null);
  }, [currentIndex]);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleNext = () => {
    if (currentIndex < SENTENCES.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          setAnalyzing(true);
          try {
            const analysis = await analyzePronunciation(base64data, currentItem.text);
            setResult(analysis);
            
            // Calculate score for this sentence
            const sentenceScore = Math.round(analysis.words.reduce((acc, w) => acc + w.score, 0) / analysis.words.length);
            if (sentenceScore > 80) {
              setTotalScore(prev => prev + 10);
              confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
              });
            }
          } catch (error) {
            console.error(error);
            alert("Error analyzing audio. Please try again.");
          } finally {
            setAnalyzing(false);
          }
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setResult(null);
      setSelectedWord(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const playCorrection = async (speed: number = 1.0) => {
    try {
      if (isPlayingTTS) return;
      setIsPlayingTTS(true);
      setPlaybackSpeed(speed); // For UI indication
      
      const base64Audio = await generateSpeech(currentItem.text);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), audioCtx);
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = speed; // Apply speed

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      source.start();

      const updateVisualizer = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setAudioLevel((sum / dataArray.length) / 100); 

        if (audioCtx.state === 'running') {
           animationFrameRef.current = requestAnimationFrame(updateVisualizer);
        }
      };
      
      updateVisualizer();

      source.onended = () => {
        setIsPlayingTTS(false);
        setAudioLevel(0);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

    } catch (e) {
      console.error("TTS Error", e);
      setIsPlayingTTS(false);
    }
  };

  // Render logic for the sentence text (interactive)
  const renderSentence = () => {
    if (!result) {
      return (
        <h2 className="text-2xl md:text-3xl font-bold text-suo-text text-center leading-relaxed">
          {currentItem.text}
        </h2>
      );
    }

    return (
      <div className="flex flex-wrap justify-center gap-2">
        {result.words.map((wordData, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedWord(wordData)}
            className={`
              text-xl md:text-2xl font-bold px-2 py-1 rounded-lg transition-all border-b-2
              ${wordData.score >= 75 
                ? 'text-suo-darkGreen border-transparent hover:bg-green-50' 
                : 'text-suo-red border-suo-red bg-red-50 hover:bg-red-100 cursor-pointer animate-pulse'}
            `}
          >
            {wordData.word}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pb-8 flex flex-col min-h-[85vh]">
      
      {/* Top Bar: Progress & Stats */}
      <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col">
          <span className="text-xs font-extrabold text-gray-400 tracking-wider">LEVEL</span>
          <span className={`text-sm font-bold ${currentItem.level === 'Hard' ? 'text-suo-red' : 'text-suo-green'}`}>
            {currentItem.level.toUpperCase()}
          </span>
        </div>
        
        <div className="flex-1 mx-6">
          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-suo-green transition-all duration-500 ease-out"
              style={{ width: `${((currentIndex + 1) / SENTENCES.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-xs font-extrabold text-gray-400 tracking-wider">TOTAL XP</span>
          <span className="text-lg font-black text-suo-yellow">{totalScore}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 relative">
        
        {/* Avatar Container */}
        <div className="relative group">
           {/* Visualizer Ring */}
           <div 
              className="absolute inset-0 rounded-full border-4 border-suo-blue opacity-50 transition-all duration-75"
              style={{ transform: `scale(${1 + audioLevel * 0.5})`, opacity: audioLevel > 0.05 ? 0.5 : 0 }}
           ></div>

           <div className={`
              w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-white shadow-2xl overflow-hidden relative z-10
              transition-transform duration-300
              ${isPlayingTTS ? 'scale-105 ring-4 ring-suo-blue/30' : ''}
            `}>
             {userAvatar ? (
                 <img 
                    src={`data:image/png;base64,${userAvatar}`} 
                    alt="Coach Avatar" 
                    className="w-full h-full object-cover origin-bottom transition-transform duration-75" 
                    style={{ transform: isPlayingTTS ? `scale(${1 + audioLevel * 0.05}, ${1 + audioLevel * 0.15})` : 'scale(1)' }}
                 />
             ) : (
                <div className="w-full h-full bg-suo-gray flex items-center justify-center text-6xl">
                    <span style={{ display: 'inline-block', transform: isPlayingTTS ? `scale(${1 + audioLevel * 0.2})` : 'scale(1)' }}>
                      🤖
                    </span>
                </div>
             )}
          </div>
        </div>

        {/* Interaction Card */}
        <div className="w-full bg-white rounded-3xl shadow-xl border-2 border-gray-100 overflow-hidden relative">
          
          {/* Analysis Feedback Overlay (Tooltip) */}
          {selectedWord && (
            <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
              <button 
                onClick={() => setSelectedWord(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              
              <h3 className="text-2xl font-black text-suo-red mb-2">"{selectedWord.word}"</h3>
              <div className="grid grid-cols-2 gap-8 text-center mb-6 w-full max-w-xs">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">You Said</p>
                  <p className="font-mono text-lg text-suo-red bg-red-50 p-2 rounded-lg">/{selectedWord.ipa_user}/</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Correct</p>
                  <p className="font-mono text-lg text-suo-green bg-green-50 p-2 rounded-lg">/{selectedWord.ipa_correct}/</p>
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 font-medium max-w-sm text-center">
                💡 Tip: {selectedWord.tip}
              </div>
            </div>
          )}

          {/* Sentence Display */}
          <div className="p-8 md:p-10 min-h-[200px] flex flex-col items-center justify-center space-y-6">
             {renderSentence()}
             
             {/* Audio Controls */}
             <div className="flex items-center space-x-4">
                <button
                  onClick={() => playCorrection(0.75)}
                  disabled={isPlayingTTS}
                  className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-xl flex items-center justify-center transition-transform active:scale-95"
                  title="Slow Speed"
                >
                  🐢
                </button>
                <button 
                  onClick={() => playCorrection(1.0)}
                  disabled={isPlayingTTS}
                  className={`
                    flex items-center space-x-2 px-6 py-3 rounded-full font-bold shadow-md transition-all active:scale-95
                    ${isPlayingTTS && playbackSpeed === 1.0 
                      ? 'bg-suo-blue text-white ring-4 ring-blue-200' 
                      : 'bg-white border-2 border-gray-200 hover:border-suo-blue text-suo-blue'}
                  `}
                >
                  {isPlayingTTS ? (
                     <div className="flex space-x-1 h-5 items-center">
                        <div className="w-1 h-3 bg-current animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1 h-3 bg-current animate-bounce" style={{ animationDelay: '100ms' }}></div>
                        <div className="w-1 h-3 bg-current animate-bounce" style={{ animationDelay: '200ms' }}></div>
                     </div>
                  ) : (
                    <>
                      <span>🔊</span>
                      <span>Listen</span>
                    </>
                  )}
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="mt-8 grid grid-cols-3 gap-6 items-center">
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0 || isRecording}
          className="justify-self-start text-gray-400 font-bold hover:bg-gray-100 px-6 py-3 rounded-xl disabled:opacity-30 transition-all flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          <span className="hidden md:inline">PREV</span>
        </button>

        <div className="justify-self-center">
          <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={analyzing}
              className={`
                relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-lg transition-all 
                ${isRecording 
                  ? 'bg-suo-red shadow-red-200 scale-110 ring-4 ring-red-100' 
                  : analyzing 
                      ? 'bg-gray-100 cursor-wait'
                      : 'bg-suo-green shadow-green-200 hover:-translate-y-1 hover:shadow-xl'}
              `}
          >
              {analyzing ? (
                   <div className="w-8 h-8 border-4 border-gray-300 border-t-suo-green rounded-full animate-spin"></div>
              ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${isRecording ? 'text-white animate-pulse' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {isRecording ? (
                          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" strokeWidth="0"/>
                      ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      )}
                  </svg>
              )}
          </button>
          <p className="text-center mt-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
            {isRecording ? 'Listening...' : analyzing ? 'Judging...' : 'Tap to Speak'}
          </p>
        </div>

        <button 
          onClick={handleNext}
          disabled={currentIndex === SENTENCES.length - 1 || isRecording}
          className={`
            justify-self-end px-6 py-3 rounded-xl font-bold transition-all flex items-center space-x-2
            ${result 
              ? 'bg-suo-green text-white shadow-lg shadow-green-200 animate-bounce' 
              : 'text-gray-400 hover:bg-gray-100'}
            disabled:opacity-30 disabled:animate-none
          `}
        >
          <span className="hidden md:inline">NEXT</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

    </div>
  );
};

export default PronunciationCoach;