"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createSubject } from "@/lib/actions/admin";
import { getUserByClerkId } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LevelWithSubjects } from "@/lib/types";

interface CreateSubjectFormProps {
  levels: LevelWithSubjects[];
  onSuccess?: () => void;
}

export function CreateSubjectForm({ levels, onSuccess }: CreateSubjectFormProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    levelId: levels[0]?.id ?? "",
    name: "",
    icon: "📚",
    color: "#10b981",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!clerkUser) {
        throw new Error("User not authenticated");
      }
      
      // Get user info from database
      const user = await getUserByClerkId(clerkUser.id);
      if (!user) {
        throw new Error("User not found");
      }
      
      await createSubject({
        ...formData,
        ownerId: user.id,
        ownerRole: user.role,
        visibility: "admin_and_regulars",
      });
      router.refresh();
      setFormData({
        levelId: levels[0]?.id ?? "",
        name: "",
        icon: "📚",
        color: "#10b981",
      });
      toast.success("Subject created successfully");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create subject:", error);
      toast.error("Failed to create subject. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="levelId">Level</Label>
        <Select
          value={formData.levelId}
          onValueChange={(value) => setFormData({ ...formData, levelId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a level" />
          </SelectTrigger>
          <SelectContent>
            {levels.map((level) => (
              <SelectItem key={level.id} value={level.id}>
                {level.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Subject Name</Label>
        <Input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Mathematics, Science, etc."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="icon">Icon (emoji)</Label>
        <Input
          id="icon"
          type="text"
          value={formData.icon}
          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
          placeholder="e.g., 📚, 🔢, 🧪"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">Color</Label>
        <div className="flex items-center gap-2">
          <Input
            id="color"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="w-16 h-10 p-1"
          />
          <span className="text-sm text-muted-foreground">{formData.color}</span>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || levels.length === 0}>
        {isLoading ? "Creating..." : "Create Subject"}
      </Button>
    </form>
  );
}
