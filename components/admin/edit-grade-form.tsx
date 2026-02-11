"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { updateGradeWithSession } from "@/lib/actions/admin";
import type { Grade, Level } from "@/lib/types";

interface EditGradeFormProps {
  grade: Grade;
  onSuccess?: () => void;
}

export function EditGradeForm({ grade, onSuccess }: EditGradeFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    gradeNumber: grade.gradeNumber,
    title: grade.title,
    order: grade.order,
    color: grade.color,
    level: grade.level as Level,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateGradeWithSession({
        id: grade.id,
        ...formData,
      });
      router.refresh();
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
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
