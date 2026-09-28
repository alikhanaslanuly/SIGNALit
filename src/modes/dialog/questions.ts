import type { Locale } from '../../ui/i18n';

export interface Question { id: string; en: string; ru: string }
export const QUESTIONS: readonly Question[] = [
  { id: 'pain', en: 'Are you in pain?', ru: 'Вам больно?' },
  { id: 'water', en: 'Do you need water?', ru: 'Вам нужна вода?' },
  { id: 'help', en: 'Do you need help?', ru: 'Вам нужна помощь?' },
  { id: 'toilet', en: 'Do you need the toilet?', ru: 'Вам нужно в туалет?' },
  { id: 'okay', en: 'Are you feeling okay?', ru: 'Вы хорошо себя чувствуете?' },
  { id: 'cold', en: 'Are you cold?', ru: 'Вам холодно?' },
  { id: 'dizzy', en: 'Are you dizzy?', ru: 'У вас кружится голова?' },
  { id: 'breathe', en: 'Can you breathe comfortably?', ru: 'Вам удобно дышать?' },
];
export const getQuestion = (id: string, locale: Locale): string | null => QUESTIONS.find(question => question.id === id)?.[locale] ?? null;
