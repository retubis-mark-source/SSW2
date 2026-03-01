export type Category = 'theory' | 'practical';

export interface Option {
  id: string;
  text: string;
}

export interface Question {
  id: number;
  category: Category; // 学科 (theory) or 実技 (practical)
  questionText: string;
  imageUrl?: string; // Optional URL or Base64 string for photo
  options: Option[];
  correctAnswerId: string;
  textbookPage?: string | number; // Page number reference
  explanation?: string;
}

export interface QuizState {
  answers: Record<number, string>; // questionId -> optionId
  isSubmitted: boolean;
  score: number;
}