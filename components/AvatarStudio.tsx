import React, { useState } from 'react';
import { editAvatar, animateAvatar } from '../services/geminiService';

interface AvatarStudioProps {
    setAppAvatar: (base64: string) => void;
}

const AvatarStudio: React.FC<AvatarStudioProps> = ({ setAppAvatar }) => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'animate'>('edit');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setImageBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = async () => {
    if (!imageBase64 || !prompt) return;
    setIsProcessing(true);
    try {
      const newImage = await editAvatar(imageBase64, prompt);
      setImageBase64(newImage);
      setPrompt('');
    } catch (e) {
      alert("Failed to edit image");
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUseAvatar = () => {
      if (imageBase64) {
          setAppAvatar(imageBase64);
          alert("Avatar updated! Check the Pronunciation Coach screen.");
      }
  };

  const handleAnimate = async () => {
    if (!imageBase64) return;
    setIsProcessing(true);
    setVideoUrl(null);
    
    // Check key selection for Veo
    if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
        }
    }

    try {
      const uri = await animateAvatar(imageBase64);
      // Construct URL with API key for playback
      const fetchUrl = `${uri}&key=${process.env.API_KEY}`;
      const res = await fetch(fetchUrl);
      const blob = await res.blob();
      setVideoUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      console.error(e);
      // Handle "Requested entity was not found" specifically for Veo/Project selection
      if (e.message?.includes('Requested entity was not found') || e.toString().includes('Requested entity was not found')) {
          if (window.aistudio) {
              await window.aistudio.openSelectKey();
              alert("Please select a valid paid project and try again.");
          }
      } else {
          alert("Failed to animate avatar. Ensure you selected a paid project.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8">
       <div className="text-center">
        <h2 className="text-3xl font-extrabold text-suo-text">Avatar Studio</h2>
        <p className="text-gray-500">Create your persona and bring it to life.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border-2 border-suo-gray shadow-sm">
                <h3 className="text-lg font-bold text-suo-text mb-4">1. Upload Avatar</h3>
                <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-suo-blue file:text-white
                    hover:file:bg-blue-600"
                />
            </div>

            {imageBase64 && (
                <div className="bg-white p-6 rounded-2xl border-2 border-suo-gray shadow-sm space-y-4">
                     <div className="flex space-x-4 border-b border-gray-200 pb-2">
                        <button 
                            onClick={() => setMode('edit')}
                            className={`pb-2 font-bold ${mode === 'edit' ? 'text-suo-blue border-b-2 border-suo-blue' : 'text-gray-400'}`}
                        >
                            Edit (Magic)
                        </button>
                        <button 
                            onClick={() => setMode('animate')}
                            className={`pb-2 font-bold ${mode === 'animate' ? 'text-suo-blue border-b-2 border-suo-blue' : 'text-gray-400'}`}
                        >
                            Animate (Veo)
                        </button>
                     </div>

                     {mode === 'edit' ? (
                         <div className="space-y-4">
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="E.g., Add a retro filter, make the hair blue..."
                                className="w-full p-3 border-2 border-suo-gray rounded-xl focus:border-suo-blue outline-none resize-none h-24"
                            />
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleEdit}
                                    disabled={isProcessing || !prompt}
                                    className="flex-1 bg-suo-blue text-white font-bold py-3 rounded-xl shadow-lg border-b-4 border-blue-600 active:scale-95 disabled:opacity-50"
                                >
                                    {isProcessing ? 'Generating...' : 'Apply Magic Edit'}
                                </button>
                                <button 
                                    onClick={handleUseAvatar}
                                    className="bg-suo-green text-white font-bold px-4 py-3 rounded-xl shadow-lg border-b-4 border-suo-darkGreen active:scale-95"
                                    title="Use this avatar in Pronunciation Coach"
                                >
                                    ✅ Use
                                </button>
                            </div>
                         </div>
                     ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Use Veo to generate a short video clip of your avatar moving. 
                                <br/><span className="text-xs text-suo-red">*Requires paid project selection</span>
                            </p>
                            <button 
                                onClick={handleAnimate}
                                disabled={isProcessing}
                                className="w-full bg-suo-yellow text-white font-bold py-3 rounded-xl shadow-lg border-b-4 border-yellow-600 active:scale-95 disabled:opacity-50"
                            >
                                {isProcessing ? 'Animating (this takes time)...' : 'Generate Video'}
                            </button>
                             {window.aistudio && (
                                <button onClick={() => window.aistudio.openSelectKey()} className="text-xs text-suo-blue underline w-full text-center">
                                    Manage Billing Project
                                </button>
                            )}
                        </div>
                     )}
                </div>
            )}
        </div>

        {/* Preview Section */}
        <div className="bg-gray-50 rounded-2xl border-2 border-suo-gray p-8 flex items-center justify-center min-h-[400px]">
             {isProcessing ? (
                 <div className="text-center space-y-4">
                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-suo-blue mx-auto"></div>
                     <p className="text-gray-500 font-bold">{mode === 'edit' ? 'Gemini is painting...' : 'Veo is dreaming...'}</p>
                 </div>
             ) : (
                 <div className="text-center w-full">
                    {videoUrl ? (
                         <video src={videoUrl} controls autoPlay loop className="w-full rounded-xl shadow-lg" />
                    ) : imageBase64 ? (
                        <img 
                            src={`data:image/png;base64,${imageBase64}`} 
                            alt="Avatar" 
                            className="w-full max-h-[400px] object-contain rounded-xl shadow-lg" 
                        />
                    ) : (
                        <div className="text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p>Upload an image to start</p>
                        </div>
                    )}
                 </div>
             )}
        </div>
      </div>
    </div>
  );
};

export default AvatarStudio;