"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSubject } from "@/lib/actions/admin";
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
import type { GradeWithSubjects } from "@/lib/types";

interface CreateSubjectFormProps {
  grades: GradeWithSubjects[];
  onSuccess?: () => void;
}

export function CreateSubjectForm({ grades, onSuccess }: CreateSubjectFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    gradeId: grades[0]?.id ?? "",
    name: "",
    icon: "📚",
    color: "#10b981",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createSubject(formData);
      router.refresh();
      setFormData({
        gradeId: grades[0]?.id ?? "",
        name: "",
        icon: "📚",
        color: "#10b981",
      });
      onSuccess?.();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="gradeId">Grade</Label>
        <Select
          value={formData.gradeId}
          onValueChange={(value) => setFormData({ ...formData, gradeId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a grade" />
          </SelectTrigger>
          <SelectContent>
            {grades.map((grade) => (
              <SelectItem key={grade.id} value={grade.id}>
                {grade.title}
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
      <Button type="submit" className="w-full" disabled={isLoading || grades.length === 0}>
        {isLoading ? "Creating..." : "Create Subject"}
      </Button>
    </form>
  );
}
