import { auth } from "@clerk/nextjs/server";
import { getClassPerformance } from "@/lib/actions/teacher-analytics";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const data = await getClassPerformance(clerkId);

  // Transform flat data into the shape the client expects
  const totalStudents = data.students.length;
  const averageScore = Math.round(data.averageScore);
  const completionRate = Math.round(data.completionRate);

  // Group students by subject (from quiz attempts) — not available per-student,
  // so we return an empty subjects array for now
  return NextResponse.json({
    overview: { totalStudents, averageScore, completionRate },
    students: data.students,
    subjects: [],
  });
}
