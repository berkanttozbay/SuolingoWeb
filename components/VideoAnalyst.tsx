import React, { useState } from 'react';
import { analyzeVideo } from '../services/geminiService';

const VideoAnalyst: React.FC = () => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [analysis, setAnalysis] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setVideoFile(e.target.files[0]);
            setAnalysis("");
        }
    };

    const handleAnalyze = () => {
        if (!videoFile) return;
        setIsAnalyzing(true);
        
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            try {
                // Determine mime type (fallback to mp4 if undefined, though file input gives it)
                const mimeType = videoFile.type || 'video/mp4';
                const result = await analyzeVideo(base64, mimeType);
                setAnalysis(result);
            } catch (error) {
                setAnalysis("Error analyzing video. The file might be too large for this client-side demo.");
            } finally {
                setIsAnalyzing(false);
            }
        };
        reader.readAsDataURL(videoFile);
    };

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
            <div className="text-center">
                <h2 className="text-3xl font-extrabold text-suo-text">Video Analyst</h2>
                <p className="text-gray-500">Upload a video of yourself speaking for feedback on body language.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border-2 border-suo-gray shadow-sm space-y-4">
                <input type="file" accept="video/*" onChange={handleFileChange} className="w-full" />
                
                {videoFile && (
                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="w-full bg-suo-blue text-white font-bold py-3 rounded-xl shadow-lg border-b-4 border-blue-600 active:scale-95 disabled:opacity-50"
                    >
                        {isAnalyzing ? 'Analyzing with Gemini Pro...' : 'Analyze Video'}
                    </button>
                )}
            </div>

            {analysis && (
                <div className="bg-white p-6 rounded-2xl border-2 border-suo-gray shadow-sm">
                    <h3 className="text-xl font-bold text-suo-text mb-2">Gemini's Feedback</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-line">{analysis}</p>
                </div>
            )}
        </div>
    );
};

export default VideoAnalyst;