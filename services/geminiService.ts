import { GoogleGenAI, Type } from "@google/genai";
import { FAQItem, RelevantQA } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const breakdownQuestion = async (question: string): Promise<string[]> => {
  const breakdownPrompt = `
    You are an expert at understanding user queries. A user will ask a question that might contain multiple parts. Your task is to break down this compound question into a clear, concise list of individual, self-contained questions.

    Analyze the following user query:
    "${question}"

    Return your response as a JSON object with a single key "subQuestions" which is an array of strings. Each string in the array should be one of the individual questions you identified.

    Example Input: "What's your return policy and how long does shipping take?"
    Example Output:
    {
      "subQuestions": [
        "What is the return policy?",
        "How long does shipping take?"
      ]
    }
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: breakdownPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["subQuestions"],
        },
      },
    });

    const parsed = JSON.parse(response.text);
    return parsed.subQuestions || [];
  } catch (error) {
    console.error("Error breaking down question:", error);
    return ["Could not process question."];
  }
};


export const findRelevantQAs = async (subQuestion: string, faqData: FAQItem[]): Promise<RelevantQA[]> => {
    const retrievalPrompt = `
    You are an AI assistant designed to find the most relevant information from a provided knowledge base. I will give you a user's question and a list of Frequently Asked Questions (FAQs). Your task is to select up to 3 of the most relevant FAQs that best answer the user's question.

    User's Question:
    "${subQuestion}"

    Available FAQs (in JSON format):
    ${JSON.stringify(faqData)}

    Return your response as a JSON object with a single key "relevantFAQs" which is an array of objects. Each object in the array must be an exact copy of a matching FAQ from the provided list, containing its original "question" and "answer" fields. For each FAQ, also provide a "confidenceScore" (a number between 0.0 and 1.0) indicating how relevant it is to the user's question. Do not modify the content of the questions or answers. If you find no relevant FAQs, return an empty array.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: retrievalPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    relevantFAQs: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          question: { type: Type.STRING },
                          answer: { type: Type.STRING },
                          confidenceScore: { type: Type.NUMBER },
                        },
                        required: ["question", "answer", "confidenceScore"],
                      },
                    },
                  },
                  required: ["relevantFAQs"],
                },
            },
        });
        
        const parsed = JSON.parse(response.text);
        return (parsed.relevantFAQs || []).map((item: any) => ({
          faq: { question: item.question, answer: item.answer },
          confidenceScore: item.confidenceScore,
        }));
    } catch (error) {
        console.error("Error finding relevant Q&As:", error);
        return [];
    }
};