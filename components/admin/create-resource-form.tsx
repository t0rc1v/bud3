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
import { UploadButton } from "@/lib/uploadthing";
import type { SubjectWithTopics, TopicWithResources, ResourceType } from "@/lib/types";
import { CheckCircle2, ExternalLink } from "lucide-react";

interface CreateResourceFormProps {
  subjects: SubjectWithTopics[];
  topics: TopicWithResources[];
}

const RESOURCE_TYPES: ResourceType[] = ["notes", "video", "audio", "image"];

const ENDPOINTS = {
  notes: "notesUploader",
  video: "videoUploader",
  audio: "audioUploader",
  image: "imageUploader",
} as const;

const ALLOWED_CONTENT = {
  notes: "PDF and text files (max 16MB)",
  video: "Video files (max 128MB)",
  audio: "Audio files (max 64MB)",
  image: "Image files (max 16MB)",
} as const;

export function CreateResourceForm({ subjects, topics }: CreateResourceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<{ name: string; url: string } | null>(null);
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
      setUploadedFile(null);
      setThumbnailFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (value: ResourceType) => {
    setFormData({ ...formData, type: value, url: "", uploadthingKey: "", thumbnailUrl: "" });
    setUploadedFile(null);
    setThumbnailFile(null);
  };

  const handleFileUpload = (res: Array<{ name: string; url: string; key: string }>) => {
    if (res && res[0]) {
      const file = res[0];
      setFormData({ ...formData, url: file.url, uploadthingKey: file.key });
      setUploadedFile({ name: file.name, url: file.url });
    }
  };

  const handleThumbnailUpload = (res: Array<{ name: string; url: string; key: string }>) => {
    if (res && res[0]) {
      const file = res[0];
      setFormData({ ...formData, thumbnailUrl: file.url });
      setThumbnailFile({ name: file.name, url: file.url });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-auto">
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
          onValueChange={(value) => handleTypeChange(value as ResourceType)}
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
        <Label htmlFor="topicId">Topic</Label>
        <Select
          value={formData.topicId}
          onValueChange={(value) => setFormData({ ...formData, topicId: value })}
          disabled={filteredTopics.length === 0}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder={filteredTopics.length === 0 ? "No topics available for this subject" : "Select a topic"} />
          </SelectTrigger>
          <SelectContent>
            {filteredTopics.map((topic) => (
              <SelectItem key={topic.id} value={topic.id}>
                {topic.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filteredTopics.length === 0 && (
          <p className="text-xs text-destructive">
            This subject has no topics. Please add a topic first or select a different subject.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Upload File</Label>
        <p className="text-sm text-muted-foreground">{ALLOWED_CONTENT[formData.type]}</p>
        {uploadedFile ? (
          <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/20 bg-green-50 dark:bg-green-900/10">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
              <p className="text-xs text-muted-foreground">Uploaded successfully</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFormData({ ...formData, url: "", uploadthingKey: "" });
                setUploadedFile(null);
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <UploadButton
              endpoint={ENDPOINTS[formData.type]}
              onClientUploadComplete={handleFileUpload}
              onUploadError={(error: Error) => {
                console.error("Upload error:", error);
                alert(`Upload failed: ${error.message}`);
              }}
              appearance={{
                button:
                  "ut-ready:bg-primary ut-ready:text-primary-foreground ut-ready:hover:bg-primary/90 ut-uploading:bg-primary/50 ut-uploading:cursor-not-allowed ut-button:bg-secondary ut-button:text-secondary-foreground ut-button:hover:bg-secondary/80",
                allowedContent: "text-sm text-muted-foreground",
              }}
            />
          </div>
        )}
      </div>

      {/* YouTube URL Input for Video Type */}
      {formData.type === "video" && (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="youtubeUrl">YouTube URL (Optional)</Label>
          <p className="text-sm text-muted-foreground">
            Enter a YouTube video URL instead of uploading a file
          </p>
          <div className="flex gap-2">
            <Input
              id="youtubeUrl"
              type="url"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              value={formData.url}
              onChange={(e) => {
                const url = e.target.value;
                setFormData({ ...formData, url, uploadthingKey: "" });
                if (url) {
                  setUploadedFile(null);
                }
              }}
              disabled={uploadedFile !== null}
            />
            {formData.url && !uploadedFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData({ ...formData, url: "", uploadthingKey: "" })}
              >
                Clear
              </Button>
            )}
          </div>
          {formData.url && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ExternalLink className="h-4 w-4" />
              <span>YouTube video will be embedded</span>
            </div>
          )}
        </div>
      )}

      {(formData.type === "video" || formData.type === "image") && (
        <div className="space-y-2">
          <Label>Thumbnail (Optional)</Label>
          <p className="text-sm text-muted-foreground">Upload a thumbnail image (max 16MB)</p>
          {thumbnailFile ? (
            <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/20 bg-green-50 dark:bg-green-900/10">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{thumbnailFile.name}</p>
                <p className="text-xs text-muted-foreground">Uploaded successfully</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFormData({ ...formData, thumbnailUrl: "" });
                  setThumbnailFile(null);
                }}
              >
                Remove
              </Button>
            </div>
          ) : (
            <UploadButton
              endpoint="imageUploader"
              onClientUploadComplete={handleThumbnailUpload}
              onUploadError={(error: Error) => {
                console.error("Thumbnail upload error:", error);
                alert(`Thumbnail upload failed: ${error.message}`);
              }}
              appearance={{
                button:
                  "ut-ready:bg-primary ut-ready:text-primary-foreground ut-ready:hover:bg-primary/90 ut-uploading:bg-primary/50 ut-uploading:cursor-not-allowed ut-button:bg-secondary ut-button:text-secondary-foreground ut-button:hover:bg-secondary/80",
                allowedContent: "text-sm text-muted-foreground",
              }}
            />
          )}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || subjects.length === 0 || !formData.url || !formData.topicId}
      >
        {isLoading ? "Creating..." : "Create Resource"}
      </Button>
    </form>
  );
}
