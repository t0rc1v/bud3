import { type ReactNode } from "react";
import { AdminFileTree } from "@/components/admin/admin-file-tree";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - File Tree */}
      <div className="w-72 flex-shrink-0 border-r bg-sidebar flex flex-col">
        <AdminFileTree />
      </div>
      
      {/* Center - Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
      
      {/* Right Sidebar - AI Chat (Reserved) */}
      <div className="w-80 flex-shrink-0 border-l bg-background flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">Coming soon...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">AI chat will be available here</p>
        </div>
      </div>
    </div>
  );
}
