/**
 * Multi-language support for AI responses and content generation.
 */

export const SUPPORTED_LANGUAGES: Record<string, { name: string; nativeName: string }> = {
  en: { name: 'English', nativeName: 'English' },
  sw: { name: 'Swahili', nativeName: 'Kiswahili' },
  fr: { name: 'French', nativeName: 'Français' },
  ar: { name: 'Arabic', nativeName: 'العربية' },
  es: { name: 'Spanish', nativeName: 'Español' },
  pt: { name: 'Portuguese', nativeName: 'Português' },
  am: { name: 'Amharic', nativeName: 'አማርኛ' },
  yo: { name: 'Yoruba', nativeName: 'Yorùbá' },
  ha: { name: 'Hausa', nativeName: 'Hausa' },
  zu: { name: 'Zulu', nativeName: 'isiZulu' },
};

/**
 * Build a system prompt snippet that instructs the AI to respond in the given language.
 */
export function buildLanguageInstruction(langCode: string): string {
  const lang = SUPPORTED_LANGUAGES[langCode];
  if (!lang || langCode === 'en') return '';

  return `\n\nIMPORTANT: Respond in ${lang.name} (${lang.nativeName}). All explanations, questions, and content should be in ${lang.name}. If the user writes in English, still respond in ${lang.name}. Only technical terms and code examples may remain in English.`;
}
