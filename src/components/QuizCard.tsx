import React from 'react';
import { FuriganaText } from './FuriganaText';
import { Question } from '../types';

interface QuizCardProps {
  question: Question;
  selectedOptionId: string | null;
  onSelect: (questionId: number, optionId: string) => void;
  isSubmitted: boolean;
  showFurigana: boolean;
}

export const QuizCard: React.FC<QuizCardProps> = ({
  question,
  selectedOptionId,
  onSelect,
  isSubmitted,
  showFurigana
}) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
          <span className="px-2 py-0.5 bg-emerald-50 rounded-full">Question {question.id}</span>
          <span className="text-zinc-400">•</span>
          <span className="text-zinc-500">{question.category}</span>
        </div>
        
        <h2 className="text-xl font-semibold text-zinc-900 leading-relaxed">
          <FuriganaText text={question.questionText} showFurigana={showFurigana} />
        </h2>

        {question.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-black/5 bg-zinc-50">
            <img 
              src={question.imageUrl} 
              alt="Question illustration" 
              className="w-full h-auto max-h-[400px] object-contain mx-auto"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>

      <div className="grid gap-3">
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect = option.id === question.correctAnswerId;
          
          let variantClasses = "border-zinc-200 hover:border-emerald-200 hover:bg-emerald-50/30";
          
          if (isSubmitted) {
            if (isCorrect) {
              variantClasses = "border-emerald-500 bg-emerald-50 text-emerald-900";
            } else if (isSelected) {
              variantClasses = "border-red-500 bg-red-50 text-red-900";
            } else {
              variantClasses = "border-zinc-100 opacity-50";
            }
          } else if (isSelected) {
            variantClasses = "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm";
          }

          return (
            <button
              key={option.id}
              onClick={() => !isSubmitted && onSelect(question.id, option.id)}
              disabled={isSubmitted}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-4 ${variantClasses}`}
            >
              <span className="text-lg">
                <FuriganaText text={option.text} showFurigana={showFurigana} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
