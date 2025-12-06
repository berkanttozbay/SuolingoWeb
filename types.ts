export interface WordAnalysis {
  word: string;
  score: number;
  is_correct: boolean;
  ipa_correct: string;
  ipa_user: string;
  tip: string;
}

export interface PronunciationResult {
  recognized_text: string;
  words: WordAnalysis[];
  highlighted_sentence: string;
}

export enum AppMode {
  HOME = 'HOME',
  COACH = 'COACH',
  LIVE = 'LIVE',
  AVATAR = 'AVATAR',
  VIDEO_ANALYSIS = 'VIDEO_ANALYSIS'
}

export interface NavItem {
  id: AppMode;
  label: string;
  icon: string;
  description: string;
}