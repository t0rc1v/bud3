"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLevelWithSession } from "@/lib/actions/admin";
import type { Level } from "@/lib/types";

interface EditLevelFormProps {
  level: Level;
  onSuccess?: () => void;
}

export function EditLevelForm({ level, onSuccess }: EditLevelFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    levelNumber: level.levelNumber,
    title: level.title,
    order: level.order,
    color: level.color,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateLevelWithSession({
        id: level.id,
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
        <Label htmlFor="levelNumber">Level Number</Label>
        <Input
          id="levelNumber"
          type="number"
          min={1}
          value={formData.levelNumber}
          onChange={(e) =>
            setFormData({ ...formData, levelNumber: parseInt(e.target.value) || 1 })
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
          placeholder="e.g., Level 1, Form 1, etc."
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
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Changes"}
      </Button>
    </form>
  );
}
