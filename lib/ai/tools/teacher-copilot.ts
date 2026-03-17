import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types';

export function queryStudentPerformanceTool(_ctx: ToolContext) {
  return tool({
    description: 'Query performance data for a specific student. Returns quiz scores, grades, and resource progress.',
    inputSchema: z.object({
      studentId: z.string().describe('The UUID of the student'),
    }),
    execute: async ({ studentId }) => {
      try {
        const { getStudentPerformance } = await import('@/lib/actions/teacher-analytics');
        const data = await getStudentPerformance(studentId);
        return { success: true, ...data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}

export function generateParentReportTool(_ctx: ToolContext) {
  return tool({
    description: 'Generate a parent report for a student with performance summary, grades, and progress data.',
    inputSchema: z.object({
      studentId: z.string().describe('The UUID of the student'),
    }),
    execute: async ({ studentId }) => {
      try {
        const { generateParentReportData } = await import('@/lib/actions/teacher-analytics');
        const data = await generateParentReportData(studentId);
        return { success: true, report: data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}

export function queryTopicAnalyticsTool(_ctx: ToolContext) {
  return tool({
    description: 'Get topic difficulty analytics across all students. Shows which subjects/topics have the lowest pass rates.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { getTopicDifficulty } = await import('@/lib/actions/teacher-analytics');
        const data = await getTopicDifficulty();
        return { success: true, topics: data };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}

export function generateLessonPlanTool(_ctx: ToolContext) {
  return tool({
    description: 'Generate a structured lesson plan for a given topic. The AI will produce the plan content in its response.',
    inputSchema: z.object({
      subject: z.string().describe('Subject area'),
      topic: z.string().describe('Specific topic'),
      level: z.string().optional().describe('Academic level'),
      duration: z.number().optional().describe('Lesson duration in minutes'),
      objectives: z.array(z.string()).optional().describe('Learning objectives'),
    }),
    execute: async ({ subject, topic, level, duration, objectives }) => {
      return {
        success: true,
        format: 'lesson_plan',
        subject,
        topic,
        level: level || 'General',
        duration: duration || 60,
        objectives: objectives || [],
        generatedAt: new Date().toISOString(),
      };
    },
  });
}

export function getClassRosterTool(ctx: ToolContext) {
  return tool({
    description: 'Get the list of students (regulars) managed by this admin/teacher.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const { getClassPerformance } = await import('@/lib/actions/teacher-analytics');
        const data = await getClassPerformance(ctx.clerkId);
        return {
          success: true,
          studentCount: data.students.length,
          averageScore: data.averageScore,
          students: data.students,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  });
}
