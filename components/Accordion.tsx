import React from 'react';
import { ChevronDownIcon } from './Icons';

interface AccordionProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  onOnlyClick: () => void;
  confidenceScore: number;
  highlightedWord: string;
  onWordDoubleClick: (word: string) => void;
  showConfidence?: boolean;
}

const getConfidenceColor = (score: number) => {
    if (score >= 0.6) return 'bg-green-100 text-green-800';
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-800';
    if (score >= 0.3) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
};

const HighlightedText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                highlight.split('|').some(h => h.trim().toLowerCase() === part.trim().toLowerCase()) ? (
                    <mark key={i} className="bg-yellow-300 px-0 m-0 rounded">{part}</mark>
                ) : (
                    part
                )
            )}
        </span>
    );
};

export const Accordion: React.FC<AccordionProps> = ({ 
  question, 
  answer, 
  isOpen,
  onToggle,
  onOnlyClick,
  confidenceScore,
  highlightedWord,
  onWordDoubleClick,
  showConfidence = true,
}) => {
  const handleDoubleClick = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (selectedText && selectedText.length > 0) {
      onWordDoubleClick(selectedText);
    }
  };

  const handleOnlyClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent onToggle from firing
    onOnlyClick();
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
      >
        <div className="flex items-center flex-grow min-w-0">
             {showConfidence && (
                <span className={`text-xs font-semibold mr-3 px-2.5 py-0.5 rounded-full ${getConfidenceColor(confidenceScore)}`}>
                    {(confidenceScore * 100).toFixed(0)}%
                </span>
             )}
            <span className="font-semibold text-blue-800 truncate">
                <HighlightedText text={question} highlight={highlightedWord} />
            </span>
        </div>
        <div className="flex items-center ml-4 flex-shrink-0">
            <button
              onClick={handleOnlyClick}
              className="px-2 py-1 text-xs rounded-md transition-colors bg-gray-200 text-gray-600 hover:bg-gray-300 mr-2"
              aria-label={`Show only this answer`}
            >
                Only
            </button>
            <ChevronDownIcon className={`w-5 h-5 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isOpen && (
        <div 
          className="p-4 bg-white text-gray-700 leading-relaxed prose max-w-none"
          onDoubleClick={handleDoubleClick}
        >
          <HighlightedText text={answer} highlight={highlightedWord} />
        </div>
      )}
    </div>
  );
};
