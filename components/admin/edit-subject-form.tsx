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
import { updateSubjectWithSession } from "@/lib/actions/admin";
import type { Subject, LevelWithSubjects } from "@/lib/types";

interface EditSubjectFormProps {
  subject: Subject;
  levels: LevelWithSubjects[];
  onSuccess?: () => void;
}

export function EditSubjectForm({ subject, levels, onSuccess }: EditSubjectFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    levelId: subject.levelId,
    name: subject.name,
    icon: subject.icon,
    color: subject.color,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateSubjectWithSession({
        id: subject.id,
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
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
