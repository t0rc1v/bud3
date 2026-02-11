"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createGrade } from "@/lib/actions/admin";
import { getUserByClerkId } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Level } from "@/lib/types";

interface CreateGradeFormProps {
  onSuccess?: () => void;
}

export function CreateGradeForm({ onSuccess }: CreateGradeFormProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    gradeNumber: 1,
    title: "",
    order: 1,
    color: "#3b82f6",
    level: "elementary" as Level,
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
      
      await createGrade({
        ...formData,
        ownerId: user.id,
        ownerRole: user.role,
        visibility: "admin_and_regulars",
      });
      router.refresh();
      setFormData({
        gradeNumber: 1,
        title: "",
        order: 1,
        color: "#3b82f6",
        level: "elementary",
      });
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="gradeNumber">Grade Number</Label>
        <Input
          id="gradeNumber"
          type="number"
          min={1}
          value={formData.gradeNumber}
          onChange={(e) =>
            setFormData({ ...formData, gradeNumber: parseInt(e.target.value) || 1 })
          }
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Grade 1, Form 1, etc."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="order">Display Order</Label>
        <Input
          id="order"
          type="number"
          min={1}
          value={formData.order}
          onChange={(e) =>
            setFormData({ ...formData, order: parseInt(e.target.value) || 1 })
          }
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
      <div className="space-y-2">
        <Label htmlFor="level">Level</Label>
        <Select
          value={formData.level}
          onValueChange={(value: Level) =>
            setFormData({ ...formData, level: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="elementary">Elementary</SelectItem>
            <SelectItem value="middle_school">Middle School</SelectItem>
            <SelectItem value="junior_high">Junior High</SelectItem>
            <SelectItem value="high_school">High School</SelectItem>
            <SelectItem value="higher_education">Higher Education</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating..." : "Create Grade"}
      </Button>
    </form>
  );
}
