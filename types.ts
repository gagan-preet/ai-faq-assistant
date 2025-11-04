export interface FAQItem {
  question: string;
  answer: string;
}

export interface RelevantQA {
  faq: FAQItem;
  confidenceScore: number;
}
