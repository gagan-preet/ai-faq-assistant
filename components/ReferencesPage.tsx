import React, { useState, useMemo, useEffect } from 'react';
import { faqData } from '../data/faq';
import { Accordion } from './Accordion';

export const ReferencesPage: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [openAccordions, setOpenAccordions] = useState<Set<number>>(new Set());

    const highlightPattern = useMemo(() => {
        if (!searchTerm.trim()) return '';
        // Escape special regex characters from user input and replace pipes for OR logic
        return searchTerm
            .trim()
            .split('|')
            .map(part => part.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'))
            .filter(part => part)
            .join('|');
    }, [searchTerm]);

    const filteredFaqs = useMemo(() => {
        if (!highlightPattern) {
            return faqData.map(faq => ({ faq, isMatch: false }));
        }
        
        const searchRegex = new RegExp(highlightPattern, 'gi');
        
        return faqData.map(faq => {
            const isMatch = searchRegex.test(faq.question) || searchRegex.test(faq.answer);
            return { faq, isMatch };
        });

    }, [highlightPattern]);
    
    useEffect(() => {
        if (searchTerm.trim()) {
            const matchingIndices = new Set<number>();
            filteredFaqs.forEach(({ isMatch }, index) => {
                if (isMatch) {
                    matchingIndices.add(index);
                }
            });
            setOpenAccordions(matchingIndices);
        } else {
            setOpenAccordions(new Set());
        }
    }, [filteredFaqs, searchTerm]);

    const handleToggle = (index: number) => {
        setOpenAccordions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleOnly = (index: number) => {
        setOpenAccordions(new Set([index]));
    };

    return (
        <div className="container mx-auto p-4 flex-grow">
            <h2 className="text-3xl font-bold text-blue-600 mb-6">FAQ References</h2>
            <div className="mb-6 sticky top-20 backdrop-blur-sm py-4 z-5">
                 <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search with words, phrases, or use '|' for multiple terms..."
                    className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition bg-white text-gray-900 placeholder-gray-500"
                />
            </div>
            
            <div className="space-y-4">
                {filteredFaqs.length > 0 ? filteredFaqs.map(({ faq }, index) => (
                    <Accordion
                        key={faq.question + index}
                        question={faq.question}
                        answer={faq.answer}
                        isOpen={openAccordions.has(index)}
                        onToggle={() => handleToggle(index)}
                        onOnlyClick={() => handleOnly(index)}
                        confidenceScore={1} 
                        showConfidence={false}
                        highlightedWord={highlightPattern}
                        onWordDoubleClick={() => {}} 
                    />
                )) : (
                     <div className="text-center p-8 bg-white border border-gray-200 rounded-lg">
                        <p className="text-gray-500">No FAQs found.</p>
                    </div>
                )}
            </div>
        </div>
    );
};