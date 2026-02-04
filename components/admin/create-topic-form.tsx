"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTopic } from "@/lib/actions/admin";
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
import type { SubjectWithTopics } from "@/lib/types";

interface CreateTopicFormProps {
  subjects: SubjectWithTopics[];
}

export function CreateTopicForm({ subjects }: CreateTopicFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    subjectId: subjects[0]?.id ?? "",
    title: "",
    order: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createTopic(formData);
      router.refresh();
      setFormData({
        subjectId: subjects[0]?.id ?? "",
        title: "",
        order: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="subjectId">Subject</Label>
        <Select
          value={formData.subjectId}
          onValueChange={(value) => setFormData({ ...formData, subjectId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((subject) => (
              <SelectItem key={subject.id} value={subject.id}>
                {subject.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Topic Title</Label>
        <Input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Algebra, Photosynthesis, etc."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="order">Order</Label>
        <Input
          id="order"
          type="number"
          value={formData.order}
          onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
          placeholder="e.g., 1, 2, 3"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || subjects.length === 0}>
        {isLoading ? "Creating..." : "Create Topic"}
      </Button>
    </form>
  );
}
