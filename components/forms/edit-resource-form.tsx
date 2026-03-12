"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateResource } from "@/lib/actions/admin";
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
import { CheckCircle2, AlertTriangle, Globe, FileEdit } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import type { ResourceType, ResourceWithRelations } from "@/lib/types";

interface EditResourceFormProps {
  resource: ResourceWithRelations;
  subjects: { id: string; name: string; level: { id: string; title: string } | null }[];
  topics: { id: string; title: string; subjectId: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}

const RESOURCE_TYPES: ResourceType[] = ["notes", "video", "audio", "image"];

const ENDPOINTS: Record<ResourceType, string> = {
  notes: "notesUploader",
  video: "videoUploader",
  audio: "audioUploader",
  image: "imageUploader",
};

const ALLOWED_CONTENT: Record<ResourceType, string> = {
  notes: "PDF and text files (max 16MB)",
  video: "Video files (max 128MB)",
  audio: "Audio files (max 64MB)",
  image: "Image files (max 16MB)",
};

export function EditResourceForm({
  resource,
  subjects,
  topics,
  onSuccess,
  onCancel,
}: EditResourceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showTypeWarning, setShowTypeWarning] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    url: string;
    key: string;
  } | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<{
    name: string;
    url: string;
    key: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    title: resource.title,
    description: resource.description,
    type: resource.type,
    subjectId: resource.subjectId,
    topicId: resource.topicId || "",
    url: resource.url,
    thumbnailUrl: resource.thumbnailUrl || "",
    uploadthingKey: resource.uploadthingKey,
    status: (resource.status ?? "published") as "draft" | "published",
  });

  const filteredTopics = topics.filter(
    (topic) => topic.subjectId === formData.subjectId
  );

  // Check if current file URL is an external URL (not from uploadthing)
  const isExternalUrl = !resource.url.includes("utfs.io") && !resource.url.includes("uploadthing.com");

  useEffect(() => {
    if (formData.type !== resource.type) {
      setShowTypeWarning(true);
    } else {
      setShowTypeWarning(false);
    }
  }, [formData.type, resource.type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await updateResource({
        id: resource.id,
        ...formData,
        topicId: formData.topicId || undefined,
        thumbnailUrl: formData.thumbnailUrl || undefined,
      });
      router.refresh();
      toast.success("Resource updated");
      onSuccess();
    } catch (error) {
      toast.error("Failed to update resource. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (value: ResourceType) => {
    setFormData({ ...formData, type: value });
    // Only clear uploaded file if type changes
    if (value !== resource.type) {
      setUploadedFile(null);
    }
  };

  const handleFileUpload = (res: Array<{ name: string; url: string; ufsUrl: string; key: string }>) => {
    if (res && res[0]) {
      const file = res[0];
      // Use ufsUrl (permanent URL) for storage
      setFormData({ ...formData, url: file.ufsUrl, uploadthingKey: file.key });
      setUploadedFile({ name: file.name, url: file.ufsUrl, key: file.key });
    }
  };

  const handleThumbnailUpload = (res: Array<{ name: string; url: string; ufsUrl: string; key: string }>) => {
    if (res && res[0]) {
      const file = res[0];
      // Use ufsUrl (permanent URL) for storage
      setFormData({ ...formData, thumbnailUrl: file.ufsUrl });
      setThumbnailFile({ name: file.name, url: file.ufsUrl, key: file.key });
    }
  };

  const handleRemoveFile = () => {
    setFormData({ ...formData, url: "", uploadthingKey: "" });
    setUploadedFile(null);
  };

  const handleRemoveThumbnail = () => {
    setFormData({ ...formData, thumbnailUrl: "" });
    setThumbnailFile(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showTypeWarning && (
        <Alert variant="warning" className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">Type Changed</AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            You&apos;ve changed the resource type. The current file may not be compatible. Consider uploading a new file.
          </AlertDescription>
        </Alert>
      )}

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
                {subject.name} {subject.level && `(${subject.level.title})`}
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
            <SelectValue placeholder={filteredTopics.length === 0 ? "No topics available" : "Select a topic"} />
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
            This subject has no topics. Please select a different subject.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Current File</Label>
        {uploadedFile ? (
          <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/20 bg-green-50 dark:bg-green-900/10">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
              <p className="text-xs text-muted-foreground">New file uploaded</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
            >
              Remove
            </Button>
          </div>
        ) : formData.url ? (
          <div className="flex items-center gap-2 p-3 rounded-md border border-muted bg-muted/50">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{formData.url.split('/').pop() || 'Current file'}</p>
              <p className="text-xs text-muted-foreground">
                {isExternalUrl ? "External URL" : "Uploaded file"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
            >
              Replace
            </Button>
          </div>
        ) : null}
      </div>

      {(!formData.url || uploadedFile) && (
        <div className="space-y-2">
          <Label>Upload New File</Label>
          <p className="text-sm text-muted-foreground">{ALLOWED_CONTENT[formData.type]}</p>
          <div className="space-y-4">
            <UploadButton
              endpoint={ENDPOINTS[formData.type] as "notesUploader" | "videoUploader" | "audioUploader" | "imageUploader"}
              onClientUploadComplete={handleFileUpload}
              onUploadError={(error: Error) => {
                toast.error("Upload failed. Please try again.");
              }}
              appearance={{
                button:
                  "ut-ready:bg-primary ut-ready:text-primary-foreground ut-ready:hover:bg-primary/90 ut-uploading:bg-primary/50 ut-uploading:cursor-not-allowed ut-button:bg-secondary ut-button:text-secondary-foreground ut-button:hover:bg-secondary/80",
                allowedContent: "text-sm text-muted-foreground",
              }}
            />
          </div>
        </div>
      )}

      {/* URL Input for external resources */}
      <div className="space-y-2">
        <Label htmlFor="url">Or Enter URL</Label>
        <Input
          id="url"
          type="url"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value, uploadthingKey: "" })}
          placeholder="https://..."
        />
        <p className="text-xs text-muted-foreground">
          For external resources (YouTube, external PDFs, etc.)
        </p>
      </div>

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
                onClick={handleRemoveThumbnail}
              >
                Remove
              </Button>
            </div>
          ) : formData.thumbnailUrl ? (
            <div className="flex items-center gap-2 p-3 rounded-md border border-muted bg-muted/50">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Current thumbnail</p>
                <p className="text-xs text-muted-foreground">{formData.thumbnailUrl.split('/').pop()}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveThumbnail}
              >
                Replace
              </Button>
            </div>
          ) : (
            <UploadButton
              endpoint="imageUploader"
              onClientUploadComplete={handleThumbnailUpload}
              onUploadError={(error: Error) => {
                toast.error("Thumbnail upload failed. Please try again.");
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

      <div className="flex gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={isLoading || !formData.url || !formData.topicId}
          onClick={() => setFormData((prev) => ({ ...prev, status: "published" }))}
        >
          <Globe className="mr-2 h-4 w-4" />
          {isLoading && formData.status === "published" ? "Publishing..." : "Publish"}
        </Button>
        <Button
          type="submit"
          variant="outline"
          className="flex-1"
          disabled={isLoading || !formData.url || !formData.topicId}
          onClick={() => setFormData((prev) => ({ ...prev, status: "draft" }))}
        >
          <FileEdit className="mr-2 h-4 w-4" />
          {isLoading && formData.status === "draft" ? "Saving..." : "Save as Draft"}
        </Button>
      </div>
    </form>
  );
}
