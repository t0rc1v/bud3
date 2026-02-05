import { streamText, UIMessage, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { getModel } from '@/lib/ai/providers';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

interface MemoryItem {
  id: string;
  userId: string;
  title: string;
  category: string | null;
  content: Record<string, unknown>;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { messages, chatId, resources }: { 
    messages: UIMessage[]; 
    chatId?: string;
    resources?: { title: string; description: string; url: string; type: string }[];
  } = await req.json();

  // Get user's memory items for context
  let memoryItems: MemoryItem[] = [];
  try {
    const { getMemoryItems } = await import('@/lib/actions/ai');
    memoryItems = await getMemoryItems(userId);
  } catch (error) {
    console.error('Failed to load memory items:', error);
  }

  // Build system prompt with context
  let systemPrompt = `You are a helpful AI assistant for an educational platform called Bud. 
You help teachers, students, and admins with their questions about educational content.

You have access to the following tools:
1. web_search - Search the web for information
2. youtube_search - Search YouTube for educational videos
3. save_memory - Save important information to memory for future reference

When responding:
- Be concise and educational
- Use the available tools when needed to provide accurate information
- You can reference resources that users share with you`;

  // Add memory context if available
  if (memoryItems && memoryItems.length > 0) {
    systemPrompt += `\n\nYou have access to the following saved memory:\n`;
    memoryItems.forEach((item: MemoryItem) => {
      systemPrompt += `- ${item.title}: ${JSON.stringify(item.content)}\n`;
    });
  }

  // Add resource context if provided
  if (resources && resources.length > 0) {
    systemPrompt += `\n\nThe user has shared the following resources with you:\n`;
    resources.forEach((resource) => {
      systemPrompt += `- ${resource.title} (${resource.type}): ${resource.description}\n  URL: ${resource.url}\n`;
    });
  }

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      web_search: tool({
        description: 'Search the web for current information on any topic',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
        }),
        execute: async ({ query }) => {
          // This is a placeholder - in production, integrate with Exa AI or similar
          return {
            results: [
              { title: 'Web search not yet configured', url: '', snippet: 'Please configure Exa AI integration' }
            ]
          };
        },
      }),
      youtube_search: tool({
        description: 'Search YouTube for educational videos',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
        }),
        execute: async ({ query }) => {
          // This is a placeholder - in production, integrate with YouTube API via Exa AI
          return {
            results: [
              { title: 'YouTube search not yet configured', url: '', snippet: 'Please configure Exa AI integration' }
            ]
          };
        },
      }),
      save_memory: tool({
        description: 'Save important information to memory for future reference',
        inputSchema: z.object({
          title: z.string().describe('A title for this memory'),
          category: z.string().describe('Category for organization (e.g., "student_results", "lesson_plans")'),
          content: z.any().describe('The structured data to save'),
          description: z.string().describe('A description of what this memory contains'),
        }),
        execute: async ({ title, category, content, description }) => {
          try {
            const { saveMemoryItem } = await import('@/lib/actions/ai');
            await saveMemoryItem({
              userId,
              title,
              category,
              content,
              description,
            });
            return { success: true, message: 'Memory saved successfully' };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },
      }),
      add_learner: tool({
        description: 'Add a learner to the teacher\'s my_learners list (teachers only)',
        inputSchema: z.object({
          email: z.string().describe('The learner\'s email address'),
          gradeId: z.string().describe('The grade ID for the learner'),
          metadata: z.object({}).optional().describe('Optional metadata about the learner'),
        }),
        execute: async ({ email, gradeId, metadata }) => {
          try {
            const { addMyLearner } = await import('@/lib/actions/teacher');
            await addMyLearner(userId, email, gradeId, metadata);
            return { success: true, message: 'Learner added successfully' };
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },
      }),
    },
    onFinish: async ({ response }) => {
      // Save the assistant's response to the database if chatId is provided
      if (chatId) {
        try {
          const { saveChatMessage } = await import('@/lib/actions/ai');
          const assistantMessage = response.messages.find(m => m.role === 'assistant');
          if (assistantMessage) {
            // Convert content array to string
            let contentStr = '';
            if (Array.isArray(assistantMessage.content)) {
              contentStr = assistantMessage.content.map((part: { type: string; text?: string }) => {
                if (part.type === 'text') return part.text || '';
                return '';
              }).join('');
            } else if (typeof assistantMessage.content === 'string') {
              contentStr = assistantMessage.content;
            }
            
            await saveChatMessage({
              chatId,
              role: 'assistant',
              content: contentStr,
            });
          }
        } catch (error) {
          console.error('Failed to save chat message:', error);
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
