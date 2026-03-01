import React from 'react';
import { parseFuriganaString } from '../utils/furiganaParser';

interface FuriganaTextProps {
  text: string;
  showFurigana?: boolean;
  className?: string;
}

export const FuriganaText: React.FC<FuriganaTextProps> = ({ 
  text, 
  showFurigana = true,
  className = "" 
}) => {
  const segments = parseFuriganaString(text);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.furigana && showFurigana) {
          return (
            <ruby key={index}>
              {segment.text}
              <rt className="text-[0.6em] select-none">{segment.furigana}</rt>
            </ruby>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
};
