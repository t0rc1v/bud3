"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createResource } from "@/lib/actions/admin";
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
import { Textarea } from "@/components/ui/textarea";
import type { SubjectWithTopics, TopicWithResources, ResourceType } from "@/lib/types";

interface CreateResourceFormProps {
  subjects: SubjectWithTopics[];
  topics: TopicWithResources[];
}

const RESOURCE_TYPES: ResourceType[] = ["notes", "video", "audio", "image"];

export function CreateResourceForm({ subjects, topics }: CreateResourceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "notes" as ResourceType,
    subjectId: subjects[0]?.id ?? "",
    topicId: "",
    url: "",
    thumbnailUrl: "",
    uploadthingKey: "",
  });

  const filteredTopics = topics.filter(
    (topic) => topic.subjectId === formData.subjectId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createResource({
        ...formData,
        uploadthingKey: formData.uploadthingKey || "",
      });
      router.refresh();
      setFormData({
        title: "",
        description: "",
        type: "notes",
        subjectId: subjects[0]?.id ?? "",
        topicId: "",
        url: "",
        thumbnailUrl: "",
        uploadthingKey: "",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Introduction to Algebra"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter resource description..."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="type">Resource Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value as ResourceType })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a resource type" />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subjectId">Subject</Label>
        <Select
          value={formData.subjectId}
          onValueChange={(value) => {
            setFormData({ ...formData, subjectId: value, topicId: "" });
          }}
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
        <Label htmlFor="topicId">Topic (Optional)</Label>
        <Select
          value={formData.topicId}
          onValueChange={(value) => setFormData({ ...formData, topicId: value })}
          disabled={filteredTopics.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a topic" />
          </SelectTrigger>
          <SelectContent>
            {filteredTopics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          type="url"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="https://..."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="thumbnailUrl">Thumbnail URL (Optional)</Label>
        <Input
          id="thumbnailUrl"
          type="url"
          value={formData.thumbnailUrl}
          onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="uploadthingKey">UploadThing Key</Label>
        <Input
          id="uploadthingKey"
          type="text"
          value={formData.uploadthingKey}
          onChange={(e) => setFormData({ ...formData, uploadthingKey: e.target.value })}
          placeholder="Enter UploadThing key..."
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isLoading || subjects.length === 0}>
        {isLoading ? "Creating..." : "Create Resource"}
      </Button>
    </form>
  );
}
