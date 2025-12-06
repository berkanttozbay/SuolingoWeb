import React, { useState } from 'react';
import PronunciationCoach from './components/PronunciationCoach';
import LiveConversation from './components/LiveConversation';
import AvatarStudio from './components/AvatarStudio';
import VideoAnalyst from './components/VideoAnalyst';
import { AppMode, NavItem } from './types';

const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.HOME);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const navItems: NavItem[] = [
    {
      id: AppMode.COACH,
      label: 'Pronunciation',
      description: 'Perfect your accent with word-level AI analysis.',
      icon: '🎙️'
    },
    {
        id: AppMode.LIVE,
        label: 'Live Chat',
        description: 'Have a real-time voice conversation.',
        icon: '⚡'
    },
    {
      id: AppMode.AVATAR,
      label: 'Avatar Studio',
      description: 'Create and animate your AI persona.',
      icon: '🎨'
    },
    {
      id: AppMode.VIDEO_ANALYSIS,
      label: 'Video Analyst',
      description: 'Get feedback on your body language.',
      icon: '📹'
    }
  ];

  const renderContent = () => {
    switch (currentMode) {
      case AppMode.COACH: return <PronunciationCoach userAvatar={userAvatar} />;
      case AppMode.LIVE: return <LiveConversation />;
      case AppMode.AVATAR: return <AvatarStudio setAppAvatar={setUserAvatar} />;
      case AppMode.VIDEO_ANALYSIS: return <VideoAnalyst />;
      default: return (
        <div className="max-w-4xl mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {navItems.map(item => (
                <button 
                    key={item.id}
                    onClick={() => setCurrentMode(item.id)}
                    className="bg-white p-8 rounded-3xl border-2 border-suo-gray hover:border-suo-green hover:shadow-xl transition-all text-left group"
                >
                    <div className="text-5xl mb-4 group-hover:scale-110 transition-transform origin-left">{item.icon}</div>
                    <h3 className="text-2xl font-extrabold text-suo-text mb-2 group-hover:text-suo-green">{item.label}</h3>
                    <p className="text-gray-500 font-semibold">{item.description}</p>
                </button>
            ))}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-suo-text pb-20">
      {/* Header */}
      <header className="bg-white border-b-2 border-suo-gray sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div 
                className="flex items-center space-x-2 cursor-pointer" 
                onClick={() => setCurrentMode(AppMode.HOME)}
            >
                <div className="bg-suo-green p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-extrabold text-suo-green tracking-tight">Suolingo</h1>
            </div>

            {currentMode !== AppMode.HOME && (
                <button 
                    onClick={() => setCurrentMode(AppMode.HOME)}
                    className="text-gray-400 font-bold hover:text-suo-gray uppercase text-sm"
                >
                    Back to Home
                </button>
            )}
        </div>
      </header>

      <main className="py-8">
        {renderContent()}
      </main>

    </div>
  );
};

export default App;