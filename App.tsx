import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import { breakdownQuestion, findRelevantQAs } from './services/geminiService';
import { faqData } from './data/faq';
import { RelevantQA } from './types';
import { MicrophoneIcon, LoadingSpinner } from './components/Icons';
import { Accordion } from './components/Accordion';
import { ReferencesPage } from './components/ReferencesPage';

type Page = 'assistant' | 'references';

const WelcomeMessage = () => (
    <div className="text-center p-8 bg-white border border-gray-200 rounded-lg shadow-sm h-full flex flex-col justify-center items-center">
        <h2 className="text-2xl font-bold text-blue-600 mb-2">Welcome to the AI FAQ Assistant</h2>
        <p className="text-gray-600">Click the microphone to speak, or type your question in the bar above.</p>
        <p className="text-gray-500 text-sm mt-1">For example: "What's your return policy and how do I track an order?".</p>
    </div>
);

const MainContent: React.FC<{
    isLoading: boolean;
    relevantQAs: RelevantQA[];
    openAccordions: Set<number>;
    onAccordionToggle: (index: number) => void;
    onAccordionOnly: (index: number) => void;
    highlightedWord: string;
    onWordDoubleClick: (word: string) => void;
}> = ({ isLoading, relevantQAs, openAccordions, onAccordionToggle, onAccordionOnly, highlightedWord, onWordDoubleClick }) => (
    <>
        {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <LoadingSpinner />
                <span className="ml-2 text-gray-500">Finding relevant answers...</span>
            </div>
        ) : (
            <div className="space-y-4">
                {relevantQAs.length > 0 ? (
                    relevantQAs.map((qa, index) => (
                        <Accordion
                            key={index}
                            question={qa.faq.question}
                            answer={qa.faq.answer}
                            isOpen={openAccordions.has(index)}
                            onToggle={() => onAccordionToggle(index)}
                            onOnlyClick={() => onAccordionOnly(index)}
                            confidenceScore={qa.confidenceScore}
                            highlightedWord={highlightedWord}
                            onWordDoubleClick={onWordDoubleClick}
                        />
                    ))
                ) : (
                    <div className="text-center p-8 bg-white border border-gray-200 rounded-lg">
                        <p className="text-gray-500">No relevant FAQs found for this sub-question.</p>
                    </div>
                )}
            </div>
        )}
    </>
);

const AssistantPage: React.FC = () => {
    const [transcribedQuestion, setTranscribedQuestion] = useState('');
    const [subQuestions, setSubQuestions] = useState<string[]>([]);
    const [selectedSubQuestionIndex, setSelectedSubQuestionIndex] = useState(0);
    const [qaCache, setQaCache] = useState<{ [key: string]: RelevantQA[] }>({});
    const [openAccordions, setOpenAccordions] = useState<Set<number>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [highlightedWord, setHighlightedWord] = useState('');

    const {
        isListening,
        transcript,
        error: speechError,
        startListening,
        hasRecognitionSupport
    } = useSpeechRecognition();

    const fetchAllRelevantQAs = useCallback(async (questions: string[]) => {
        setIsProcessing(true);
        setError('');
        try {
            const promises = questions.map(q => findRelevantQAs(q, faqData));
            const results = await Promise.all(promises);
            const newCache = questions.reduce((acc, q, index) => {
                acc[q] = results[index];
                return acc;
            }, {} as { [key: string]: RelevantQA[] });
            setQaCache(newCache);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch some relevant answers.");
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const processQuestion = useCallback(async (question: string) => {
        if (!question.trim()) return;

        setIsProcessing(true);
        setSubQuestions([]);
        setHighlightedWord('');
        setQaCache({});
        setSelectedSubQuestionIndex(0);
        setOpenAccordions(new Set());

        try {
            const newSubQuestions = await breakdownQuestion(question);
            setSubQuestions(newSubQuestions);
            if (newSubQuestions.length > 0) {
                await fetchAllRelevantQAs(newSubQuestions);
                setOpenAccordions(new Set([0])); 
            } else {
                setIsProcessing(false);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to break down the question.");
            setIsProcessing(false);
        }
    }, [fetchAllRelevantQAs]);

    useEffect(() => {
        if (transcript) {
            setTranscribedQuestion(transcript);
            processQuestion(transcript);
        }
    }, [transcript, processQuestion]);

    const handleMicClick = () => {
        if (!hasRecognitionSupport) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }
        startListening();
    };
    
    const handleSelectSubQuestion = (index: number) => {
        setSelectedSubQuestionIndex(index);
        setHighlightedWord('');
        setOpenAccordions(new Set([0]));
    }

    const handleWordDoubleClick = (word: string) => {
        const cleanWord = word.replace(/[.,?]$/, '');
        setHighlightedWord(prev => prev.toLowerCase() === cleanWord.toLowerCase() ? '' : cleanWord);
    };

    const highlightCounts = useMemo(() => {
        if (!highlightedWord) return {};
        const regex = new RegExp(`\\b${highlightedWord}\\b`, 'gi');
        
        return subQuestions.reduce((counts, q) => {
            const qas = qaCache[q] || [];
            counts[q] = qas.reduce((acc, qa) => {
                const qMatches = (qa.faq.question.match(regex) || []).length;
                const aMatches = (qa.faq.answer.match(regex) || []).length;
                return acc + qMatches + aMatches;
            }, 0);
            return counts;
        }, {} as {[key: string]: number});

    }, [highlightedWord, qaCache, subQuestions]);
    
    const currentRelevantQAs = qaCache[subQuestions[selectedSubQuestionIndex]] || [];

    const handleAccordionToggle = (index: number) => {
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

    const handleAccordionOnly = (index: number) => {
        setOpenAccordions(new Set([index]));
    };
    
    const handleAccordionOpenAll = () => {
        const allIndices = new Set(currentRelevantQAs.map((_, i) => i));
        setOpenAccordions(allIndices);
    };

    const handleAccordionCloseAll = () => {
        setOpenAccordions(new Set());
    };
    
    const handleRerun = () => {
        processQuestion(transcribedQuestion);
    };

    return (
        <div className="container mx-auto p-4 flex-grow flex flex-col">
            <div className="bg-white rounded-lg p-4 mb-6 shadow-sm border border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleMicClick}
                        disabled={isListening || isProcessing}
                        className={`p-4 rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'} ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : ''}`}
                    >
                       <MicrophoneIcon className="w-6 h-6 text-white" />
                    </button>
                    <div className="flex-1">
                        <p className="text-sm text-gray-500">
                            {isListening ? 'Listening...' : (subQuestions.length > 0 ? 'Your question:' : 'Click the mic or type your question')}
                        </p>
                         <input
                            type="text"
                            value={transcribedQuestion}
                            onChange={(e) => setTranscribedQuestion(e.target.value)}
                            placeholder="e.g., What's your return policy and how do I track an order?"
                            className="font-medium text-lg text-gray-800 w-full bg-transparent focus:outline-none p-0 border-0"
                            disabled={isListening || isProcessing}
                        />
                    </div>
                    {transcribedQuestion && !isProcessing && (
                        <button
                            onClick={handleRerun}
                            disabled={isListening || isProcessing}
                            className="px-4 py-2 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                           {isProcessing ? <LoadingSpinner/> : 'Rerun'}
                        </button>
                    )}
                </div>
                {(error || speechError) && <p className="text-red-500 mt-2 text-sm">{error || speechError}</p>}
            </div>

            <div className="flex flex-col md:flex-row gap-6 flex-grow min-h-0">
                {subQuestions.length > 0 && (
                   <aside className="w-full md:w-1/3 lg:w-1/4 p-4 bg-white md:bg-gray-100/50 border border-gray-200 rounded-lg md:h-full">
                        <h2 className="text-lg font-bold mb-4 text-blue-600 border-b border-gray-200 pb-2">Broken Down Questions</h2>
                        <ul className="space-y-2">
                            {subQuestions.map((q, index) => {
                                const count = highlightCounts[q] || 0;
                                return (
                                <li key={index}>
                                    <button
                                        onClick={() => handleSelectSubQuestion(index)}
                                        className={`w-full text-left p-3 rounded-md transition-colors duration-200 text-sm flex justify-between items-center ${
                                            selectedSubQuestionIndex === index
                                                ? 'bg-blue-500/10 text-blue-700 font-semibold'
                                                : 'text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        <span>{q}</span>
                                        {highlightedWord && count > 0 && (
                                            <span className={`ml-2 text-white text-xs font-bold px-2 py-0.5 rounded-full ${selectedSubQuestionIndex === index ? 'bg-blue-500' : 'bg-gray-400'}`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            )})}
                        </ul>
                    </aside>
                )}
                <main className="flex-1 flex flex-col min-h-0">
                    {subQuestions.length > 0 && (
                        <div className="flex justify-end items-center mb-4 gap-4 flex-shrink-0">
                            <span className="text-sm text-gray-500">Accordion View:</span>
                            <div className="flex gap-1 p-1 bg-gray-200/50 rounded-lg">
                                <button
                                    onClick={handleAccordionOpenAll}
                                    className='px-3 py-1 text-xs rounded-md transition-colors hover:bg-gray-300'
                                >
                                    Open All
                                </button>
                                <button
                                    onClick={handleAccordionCloseAll}
                                    className='px-3 py-1 text-xs rounded-md transition-colors hover:bg-gray-300'
                                >
                                    Close All
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="overflow-y-auto flex-grow">
                        {isProcessing && subQuestions.length === 0 ? (
                             <div className="flex justify-center items-center h-full">
                                <LoadingSpinner />
                                <span className="ml-2 text-gray-500">Breaking down question...</span>
                            </div>
                        ) : subQuestions.length > 0 ? (
                            <MainContent 
                                isLoading={isProcessing && !currentRelevantQAs.length}
                                relevantQAs={currentRelevantQAs}
                                openAccordions={openAccordions}
                                onAccordionToggle={handleAccordionToggle}
                                onAccordionOnly={handleAccordionOnly}
                                highlightedWord={highlightedWord}
                                onWordDoubleClick={handleWordDoubleClick}
                            />
                        ) : (
                           <WelcomeMessage />
                        )}
                    </div>
                </main>
            </div>
        </div>
    )
}

function App() {
    const [currentPage, setCurrentPage] = useState<Page>('assistant');

    return (
        <div className="min-h-screen bg-white text-gray-800 font-sans flex flex-col">
            <header className="p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-blue-600">AI FAQ Assistant</h1>
                     <nav className="flex items-center gap-2 sm:gap-4">
                        <button 
                            onClick={() => setCurrentPage('assistant')} 
                            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${currentPage === 'assistant' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                        >
                            AI Assistant
                        </button>
                        <button 
                            onClick={() => setCurrentPage('references')} 
                            className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${currentPage === 'references' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'}`}
                        >
                            References
                        </button>
                    </nav>
                </div>
            </header>
            
            {currentPage === 'assistant' ? <AssistantPage /> : <ReferencesPage />}
        </div>
    );
}

export default App;