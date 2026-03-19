import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function createAssignmentTool(ctx: ToolContext) {
  return tool({
    description:
      'Create assignments, homeworks, quizzes, or continuous assessment tests for TEACHERS and ADMINS. This generates a printable document with questions, answer key, and instructions. The output includes an "Export to PDF" button for easy printing and distribution. Use this when educators need paper-based assessments or worksheets, or for practice questions at the end of a topic or sub-topic. IMPORTANT: Generate AT LEAST 10 questions to ensure comprehensive coverage of the topic or sub-topic concepts.',
    inputSchema: z.object({
      title: z.string().describe('Title of the assignment'),
      subject: z.string().describe('Subject area'),
      level: z.string().describe('Level or class'),
      type: z
        .enum([
          'assignment',
          'homework',
          'quiz',
          'test',
          'continuous_assessment',
          'worksheet',
        ])
        .describe('Type of assessment'),
      instructions: z.string().describe('General instructions for students'),
      questions: z
        .array(
          z.object({
            id: z.string().describe('Unique identifier for the question'),
            type: z
              .enum([
                'multiple_choice',
                'true_false',
                'short_answer',
                'essay',
                'fill_in_blank',
                'matching',
              ])
              .describe('Question type'),
            text: z.string().describe('The question text'),
            options: z
              .array(z.string())
              .optional()
              .describe('For multiple choice: the answer options'),
            correctAnswer: z.any().describe('The correct answer'),
            marks: z.number().describe('Points/marks for this question'),
            explanation: z
              .string()
              .optional()
              .describe('Explanation of the correct answer'),
          })
        )
        .describe('Array of questions for the assessment'),
      totalMarks: z.number().describe('Total marks/points'),
      timeLimit: z.number().optional().describe('Time limit in minutes'),
      dueDate: z.string().optional().describe('Due date for submission'),
      includeAnswerKey: z
        .boolean()
        .optional()
        .describe('Whether to include an answer key (default: true)'),
    }),
    execute: async ({
      title,
      subject,
      level,
      type,
      instructions,
      questions,
      totalMarks,
      timeLimit,
      dueDate,
      includeAnswerKey = true,
    }) => {
      try {
        const answerKey = questions.map((q) => ({
          id: q.id,
          type: q.type,
          correctAnswer: q.correctAnswer,
          marks: q.marks,
          explanation: q.explanation || '',
        }));

        const calculatedTotalMarks = questions.reduce(
          (sum, q) => sum + (q.marks || 0),
          0
        );
        const finalTotalMarks = totalMarks || calculatedTotalMarks;

        const { saveAIAssignment } = await import('@/lib/actions/ai');
        const savedAssignment = await saveAIAssignment({
          userId: ctx.dbUserId,
          chatId: ctx.chatId,
          title,
          subject,
          level,
          type,
          instructions,
          totalMarks: finalTotalMarks,
          timeLimit,
          dueDate,
          includeAnswerKey,
          questions,
          answerKey: includeAnswerKey ? answerKey : undefined,
        });

        return {
          success: true,
          format: 'assignment',
          assignmentId: savedAssignment.id,
          metadata: {
            title,
            subject,
            level,
            type,
            createdAt: savedAssignment.createdAt.toISOString(),
            totalMarks: finalTotalMarks,
            questionCount: questions.length,
            timeLimit,
            dueDate,
            includeAnswerKey,
          },
          content: {
            header: {
              title,
              subject,
              level,
              type: type.replace(/_/g, ' ').toUpperCase(),
              totalMarks: finalTotalMarks,
              timeLimit,
              dueDate,
            },
            instructions,
            questions: questions.map((q, index) => ({
              number: index + 1,
              id: q.id,
              type: q.type,
              text: q.text,
              options: q.options,
              marks: q.marks,
            })),
          },
          answerKey: includeAnswerKey
            ? {
                title: `${title} - ANSWER KEY`,
                answers: answerKey.map((a, index) => ({
                  number: index + 1,
                  ...a,
                })),
              }
            : null,
          exportOptions: {
            canExportPDF: true,
            canExportWord: true,
            canPrint: true,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create assignment: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function createQuizTool(ctx: ToolContext) {
  return tool({
    description:
      'Create interactive quizzes for LEARNERS that can be taken within the app. Students can answer questions interactively, get immediate feedback, and track their score. IMPORTANT: Generate AT LEAST 30 questions for comprehensive exam coverage.',
    inputSchema: z.object({
      title: z.string().describe('Title of the quiz'),
      subject: z.string().describe('Subject area'),
      description: z
        .string()
        .optional()
        .describe('Brief description of what the quiz covers'),
      instructions: z.string().describe('Instructions for taking the quiz'),
      questions: z
        .array(
          z.object({
            id: z.string().describe('Unique identifier for the question'),
            type: z
              .enum([
                'multiple_choice',
                'true_false',
                'short_answer',
                'fill_in_blank',
              ])
              .describe('Question type'),
            text: z.string().describe('The question text'),
            options: z
              .array(
                z.object({
                  id: z.string().describe('Option identifier (e.g. "a", "b", "c", "d")'),
                  text: z.string().describe('Option text'),
                  isCorrect: z
                    .boolean()
                    .describe('REQUIRED boolean — set to true for the correct option, false for all others'),
                })
              )
              .describe(
                'REQUIRED for multiple_choice: exactly 4 objects {id, text, isCorrect} — isCorrect MUST be a BOOLEAN (true/false, NOT a string). Exactly ONE option must have isCorrect: true, the other three isCorrect: false. ' +
                'REQUIRED for true_false: exactly 2 objects [{id:"a",text:"True",isCorrect:true/false},{id:"b",text:"False",isCorrect:true/false}] — isCorrect is a BOOLEAN, exactly one true. ' +
                'For short_answer and fill_in_blank: MUST be an EMPTY array [].'
              ),
            correctAnswer: z
              .any()
              .describe('The correct answer value — for multiple_choice/true_false this must match the text of the option where isCorrect is true; for short_answer/fill_in_blank this is the expected answer string'),
            marks: z.number().describe('Points for this question'),
            explanation: z
              .string()
              .optional()
              .describe('Explanation shown after answering'),
            hint: z
              .string()
              .optional()
              .describe('Optional hint for the question'),
          })
        )
        .describe('Array of quiz questions'),
      settings: z
        .object({
          shuffleQuestions: z.boolean().optional(),
          shuffleOptions: z.boolean().optional(),
          showCorrectAnswerImmediately: z.boolean().optional(),
          showExplanation: z.boolean().optional(),
          allowRetake: z.boolean().optional(),
          timeLimit: z.number().optional(),
          passingScore: z.number().optional(),
          maxAttempts: z.number().optional(),
        })
        .optional()
        .describe('Quiz settings and behavior'),
    }),
    execute: async ({
      title,
      subject,
      description,
      instructions,
      questions,
      settings = {},
    }) => {
      try {
        const MIN_QUESTIONS = 30;
        if (questions.length < MIN_QUESTIONS) {
          console.warn(
            `[create_quiz] Warning: Quiz "${title}" has only ${questions.length} questions (minimum recommended: ${MIN_QUESTIONS})`
          );
        }

        const defaultSettings = {
          shuffleQuestions: false,
          shuffleOptions: false,
          showCorrectAnswerImmediately: true,
          showExplanation: true,
          allowRetake: true,
          timeLimit: null,
          passingScore: 60,
          maxAttempts: null,
          ...settings,
        };

        const totalMarks = questions.reduce(
          (sum, q) => sum + (q.marks || 0),
          0
        );
        const passingMarks = Math.ceil(
          totalMarks * (defaultSettings.passingScore / 100)
        );

        const { saveAIQuiz } = await import('@/lib/actions/ai');
        const savedQuiz = await saveAIQuiz({
          userId: ctx.dbUserId,
          chatId: ctx.chatId,
          title,
          subject,
          description,
          instructions,
          totalMarks,
          passingScore: defaultSettings.passingScore,
          timeLimit: defaultSettings.timeLimit,
          settings: defaultSettings,
          questions,
          validation: {
            answers: questions.map((q) => ({
              id: q.id,
              correctAnswer: q.correctAnswer,
              marks: q.marks,
            })),
          },
        });

        return {
          success: true,
          format: 'interactive_quiz',
          artifact: 'quiz',
          quizId: savedQuiz.id,
          metadata: {
            title,
            subject,
            description,
            createdAt: savedQuiz.createdAt.toISOString(),
            questionCount: questions.length,
            totalMarks,
            passingMarks,
            passingScore: defaultSettings.passingScore,
          },
          quiz: {
            title,
            subject,
            description,
            instructions,
            settings: defaultSettings,
            questions: questions.map((q, index) => ({
              number: index + 1,
              id: q.id,
              type: q.type,
              text: q.text,
              options: q.options,
              marks: q.marks,
              explanation: q.explanation || null,
              hint: q.hint || null,
            })),
            validation: {
              answers: questions.map((q) => ({
                id: q.id,
                correctAnswer: q.correctAnswer,
                marks: q.marks,
              })),
            },
          },
          exportOptions: { canExportPDF: true, canPrint: true },
          actions: {
            canStart: true,
            canSave: true,
            canSubmit: true,
            canViewResults: true,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create quiz: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function createExamTool(ctx: ToolContext) {
  return tool({
    description:
      'Generates a new original exam by analysing past papers or source material. Creates a structured exam with sections, various question types, and an optional answer key. Minimum 40 total marks across 3+ sections.',
    inputSchema: z.object({
      title: z.string().describe('Exam title'),
      subject: z.string().describe('Subject area'),
      level: z.string().describe('Academic level'),
      instructions: z.string().describe('General exam instructions'),
      totalMarks: z.number().min(40).describe('Total marks — minimum 40'),
      timeLimit: z.number().optional().describe('Time limit in minutes'),
      sections: z
        .array(
          z.object({
            sectionTitle: z.string().describe('Section title'),
            sectionInstructions: z
              .string()
              .describe('Instructions for this section'),
            marks: z.number().describe('Total marks for this section'),
            questions: z
              .array(
                z.object({
                  id: z.string().describe('Unique question ID'),
                  type: z
                    .enum([
                      'multiple_choice',
                      'true_false',
                      'short_answer',
                      'essay',
                      'structured',
                      'fill_in_blank',
                    ])
                    .describe('Question type'),
                  text: z.string().describe('Question text'),
                  options: z.array(z.string()).optional(),
                  marks: z.number().describe('Marks for this question'),
                  correctAnswer: z.string().describe('The correct answer'),
                  explanation: z.string().optional(),
                })
              )
              .describe('Questions in this section'),
          })
        )
        .min(3)
        .describe('Exam sections — minimum 3 sections'),
      includeAnswerKey: z.boolean().optional().default(true),
      resourceIds: z.array(z.string()).optional(),
      patternAnalysis: z.string().optional(),
      difficultyDistribution: z
        .object({
          easy: z.number(),
          medium: z.number(),
          hard: z.number(),
        })
        .optional(),
    }),
    execute: async ({
      title,
      subject,
      level,
      instructions,
      totalMarks,
      timeLimit,
      sections,
      includeAnswerKey = true,
      resourceIds = [],
      patternAnalysis,
      difficultyDistribution,
    }) => {
      try {
        const answerKey = sections.flatMap((section) =>
          section.questions.map((q) => ({
            questionId: q.id,
            sectionTitle: section.sectionTitle,
            correctAnswer: q.correctAnswer,
            marks: q.marks,
            explanation: q.explanation || null,
          }))
        );

        const examSections = sections.map((section) => ({
          ...section,
          questions: section.questions.map(
            ({
              correctAnswer: _ca,
              explanation: _ex,
              ...rest
            }) => rest
          ),
        }));

        const metadata = {
          patternAnalysis: patternAnalysis || null,
          difficultyDistribution: difficultyDistribution || null,
        };

        const { saveAIExam } = await import('@/lib/actions/ai');
        const saved = await saveAIExam({
          userId: ctx.dbUserId,
          chatId: ctx.chatId,
          title,
          subject,
          level,
          instructions,
          totalMarks,
          timeLimit,
          sections: examSections,
          answerKey,
          includeAnswerKey,
          resourceIds,
          metadata,
        });

        const questionCount = sections.reduce(
          (acc, s) => acc + s.questions.length,
          0
        );

        return {
          success: true,
          format: 'exam',
          examId: saved.id,
          metadata: {
            title,
            subject,
            level,
            totalMarks,
            timeLimit: timeLimit || null,
            sectionCount: sections.length,
            questionCount,
            includeAnswerKey,
            patternAnalysis: patternAnalysis || null,
            createdAt: saved.createdAt.toISOString(),
          },
          exam: {
            title,
            subject,
            level,
            instructions,
            totalMarks,
            timeLimit: timeLimit || null,
            sections: examSections,
          },
          answerKey: includeAnswerKey ? answerKey : null,
          exportOptions: { canExportPDF: true, canPrint: true },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create exam: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function createFlashcardsTool(ctx: ToolContext) {
  return tool({
    description:
      'Create interactive flashcard study sets for learners. Generates AT LEAST 15 flashcards with questions/prompts on the front and detailed answers/explanations on the back.',
    inputSchema: z.object({
      title: z.string().describe('Title of the flashcard set'),
      subject: z.string().describe('Subject area'),
      topic: z.string().optional().describe('Specific topic'),
      flashcards: z
        .array(
          z.object({
            id: z.string().describe('Unique identifier for the flashcard'),
            front: z
              .string()
              .describe('Front side content - question, term, or prompt'),
            back: z
              .string()
              .describe(
                'Back side content - answer, definition, or detailed explanation'
              ),
            tags: z.array(z.string()).optional(),
            difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
          })
        )
        .describe('Array of flashcards - must contain AT LEAST 15'),
      settings: z
        .object({
          shuffle: z.boolean().optional(),
          showDifficulty: z.boolean().optional(),
          reviewMode: z
            .enum(['sequential', 'random', 'spaced'])
            .optional(),
        })
        .optional(),
    }),
    execute: async ({ title, subject, topic, flashcards, settings = {} }) => {
      try {
        if (flashcards.length < 15) {
          return {
            success: false,
            error: `Flashcard set must contain at least 15 cards. Only ${flashcards.length} provided.`,
          };
        }

        const defaultSettings = {
          shuffle: true,
          showDifficulty: true,
          reviewMode: 'random',
          ...settings,
        };

        const { saveAIFlashcards } = await import('@/lib/actions/ai');
        const savedFlashcard = await saveAIFlashcards({
          userId: ctx.dbUserId,
          chatId: ctx.chatId,
          title,
          subject,
          topic,
          totalCards: flashcards.length,
          cards: flashcards,
          settings: defaultSettings,
        });

        return {
          success: true,
          format: 'flashcards',
          artifact: 'flashcards',
          flashcardId: savedFlashcard.id,
          metadata: {
            title,
            subject,
            topic: topic || null,
            totalCards: flashcards.length,
            createdAt: savedFlashcard.createdAt.toISOString(),
          },
          flashcards: {
            title,
            subject,
            topic: topic || null,
            cards: flashcards.map((card, index) => ({
              number: index + 1,
              ...card,
            })),
            settings: defaultSettings,
          },
          actions: {
            canStudy: true,
            canSave: true,
            canShuffle: defaultSettings.shuffle,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create flashcards: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}

export function createNotesDocumentTool(ctx: ToolContext) {
  return tool({
    description:
      'Creates a comprehensive, richly structured study notes document with sections, key terms, embedded YouTube video references, image references, and a summary. Minimum 4 sections and 8 key terms required.',
    inputSchema: z.object({
      title: z.string().describe('Title of the notes document'),
      subject: z.string().describe('Subject area'),
      topic: z.string().optional(),
      level: z.string().optional(),
      sections: z
        .array(
          z.object({
            heading: z.string().describe('Section heading'),
            content: z
              .string()
              .describe('Rich markdown content — minimum 150 words'),
            type: z
              .enum(['introduction', 'main', 'summary', 'practice'])
              .describe('Section type'),
          })
        )
        .min(4)
        .describe('Document sections — minimum 4'),
      keyTerms: z
        .array(
          z.object({
            term: z.string(),
            definition: z.string(),
          })
        )
        .min(8)
        .describe('Key terms glossary — minimum 8 terms'),
      youtubeVideos: z
        .array(
          z.object({
            title: z.string(),
            url: z.string(),
            description: z.string(),
          })
        )
        .optional(),
      images: z
        .array(
          z.object({
            url: z.string(),
            caption: z.string(),
            alt: z.string(),
          })
        )
        .optional(),
      summary: z.string().describe('3–5 sentence overview'),
      resourceIds: z.array(z.string()).optional(),
    }),
    execute: async ({
      title,
      subject,
      topic,
      level,
      sections,
      keyTerms,
      youtubeVideos = [],
      images = [],
      summary,
      resourceIds = [],
    }) => {
      try {
        const { saveAINotesDocument } = await import('@/lib/actions/ai');
        const saved = await saveAINotesDocument({
          userId: ctx.dbUserId,
          chatId: ctx.chatId,
          title,
          subject,
          topic,
          level,
          sections,
          keyTerms,
          youtubeVideos,
          images,
          summary,
          resourceIds,
        });

        return {
          success: true,
          format: 'notes_document',
          notesDocumentId: saved.id,
          metadata: {
            title,
            subject,
            topic: topic || null,
            level: level || null,
            sectionCount: sections.length,
            keyTermCount: keyTerms.length,
            hasVideos: youtubeVideos.length > 0,
            hasImages: images.length > 0,
            createdAt: saved.createdAt.toISOString(),
          },
          document: {
            title,
            subject,
            topic: topic || null,
            level: level || null,
            summary,
            sections,
            keyTerms,
            youtubeVideos,
            images,
          },
          exportOptions: { canExportPDF: true, canPrint: true },
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create notes document: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
