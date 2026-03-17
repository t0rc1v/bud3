import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function getCurrentTimeTool(_ctx: ToolContext) {
  return tool({
    description:
      'Get the current date and time. Use this when the user asks about scheduling, deadlines, planning events, or any time-sensitive calculations. Also useful when saving memories that should include timestamps.',
    inputSchema: z.object({
      format: z
        .enum(['full', 'date-only', 'time-only', 'iso'])
        .optional()
        .describe('Format of the datetime to return (default: full)'),
      timezone: z
        .string()
        .optional()
        .describe('Timezone to use (default: local timezone)'),
    }),
    execute: async ({ format = 'full', timezone }) => {
      try {
        const now = new Date();
        let formatted;

        switch (format) {
          case 'date-only':
            formatted = now.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: timezone,
            });
            break;
          case 'time-only':
            formatted = now.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZone: timezone,
            });
            break;
          case 'iso':
            formatted = now.toISOString();
            break;
          case 'full':
          default:
            formatted = now.toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZoneName: 'short',
              timeZone: timezone,
            });
            break;
        }

        return {
          success: true,
          datetime: formatted,
          iso: now.toISOString(),
          timestamp: now.getTime(),
          timezone: timezone || 'local',
          format,
          components: {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
            hour: now.getHours(),
            minute: now.getMinutes(),
            second: now.getSeconds(),
            dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
            dayOfYear: Math.floor(
              (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
                (1000 * 60 * 60 * 24)
            ),
          },
          academicYear:
            now.getMonth() >= 7
              ? `${now.getFullYear()}-${now.getFullYear() + 1}`
              : `${now.getFullYear() - 1}-${now.getFullYear()}`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get current time: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  });
}
