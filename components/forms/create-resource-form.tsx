"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createResource } from "@/lib/actions/admin";
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
import { Textarea } from "@/components/ui/textarea";
import { UploadButton } from "@/lib/uploadthing";
import type { SubjectWithTopicsAndLevelTitle, TopicWithResources, ResourceType } from "@/lib/types";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, CreditCard, Eye, FileEdit, Globe, AlertCircle } from "lucide-react";

interface CreateResourceFormProps {
  subjects: SubjectWithTopicsAndLevelTitle[];
  topics: TopicWithResources[];
  onSuccess?: () => void;
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

interface UploadFeeInfo {
  isEnabled: boolean;
  baseFee: number;
  effectiveFee: number;
  discountPercent: number;
  uploadCount: number;
  balance: number;
  canAfford: boolean;
  nextTier: { threshold: number; discountPercent: number } | null;
}

export function CreateResourceForm({ subjects, topics, onSuccess }: CreateResourceFormProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadFeeInfo, setUploadFeeInfo] = useState<UploadFeeInfo | null>(null);
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
    visibility: "admin_and_regulars" as "public" | "admin_only" | "admin_and_regulars" | "regular_only",
    status: "published" as "draft" | "published",
  });

  // Sync subjectId when subjects prop changes
  useEffect(() => {
    if (subjects.length > 0 && !formData.subjectId) {
      setFormData(prev => ({ ...prev, subjectId: subjects[0].id, topicId: "" }));
    }
  }, [subjects]);

  // Fetch upload fee info on mount
  useEffect(() => {
    if (!clerkUser) return;
    fetch("/api/upload-fee/my-rate")
      .then((r) => r.json())
      .then(setUploadFeeInfo)
      .catch(() => {});
  }, [clerkUser]);

  const filteredTopics = topics.filter(
    (topic) => topic.subjectId === formData.subjectId
  );

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
      
      await createResource({
        ...formData,
        uploadthingKey: formData.uploadthingKey || "",
        ownerId: user.id,
        ownerRole: user.role,
        visibility: formData.visibility,
        status: formData.status,
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
        visibility: "admin_and_regulars",
        status: "published",
      });
      setUploadedFile(null);
      setThumbnailFile(null);
      toast.success("Resource created successfully");
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create resource. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (value: ResourceType) => {
    setFormData({ ...formData, type: value, url: "", uploadthingKey: "", thumbnailUrl: "" });
    setUploadedFile(null);
    setThumbnailFile(null);
  };

  const handleFileUpload = (res: Array<{ name: string; url: string; ufsUrl: string; key: string }>) => {
    if (res && res[0]) {
      const file = res[0];
      // Use ufsUrl (permanent URL) for storage
      setFormData({ ...formData, url: file.ufsUrl, uploadthingKey: file.key });
      setUploadedFile({ name: file.name, url: file.ufsUrl });
    }
  };

  const handleThumbnailUpload = (res: Array<{ name: string; url: string; ufsUrl: string; key: string }>) => {
    if (res && res[0]) {
      const file = res[0];
      // Use ufsUrl (permanent URL) for storage
      setFormData({ ...formData, thumbnailUrl: file.ufsUrl });
      setThumbnailFile({ name: file.name, url: file.ufsUrl });
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
                {subject.name} ({subject.levelTitle})
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
                toast.error("Upload failed. Please try again.");
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

      {/* Visibility Settings */}
      <div className="space-y-2">
        <Label htmlFor="visibility" className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Visibility
        </Label>
        <Select
          value={formData.visibility}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              visibility: value as typeof formData.visibility,
            })
          }
        >
          <SelectTrigger id="visibility">
            <SelectValue placeholder="Select visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="public">
              Public — visible to everyone, including unauthenticated visitors
            </SelectItem>
            <SelectItem value="admin_and_regulars">
              Admin & Learners — visible to admins and enrolled learners (default)
            </SelectItem>
            <SelectItem value="regular_only">
              Learners only — visible only to enrolled learners, not admins
            </SelectItem>
            <SelectItem value="admin_only">
              Admin only — visible only to admins, hidden from learners
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Controls who can see this resource in the content browser.
        </p>
      </div>

      {/* Upload fee info */}
      {uploadFeeInfo?.isEnabled && (
        <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-1.5">
              <CreditCard className="h-4 w-4" />
              Upload fee:
            </span>
            <span className="font-semibold flex items-center gap-1.5">
              {uploadFeeInfo.effectiveFee} credit{uploadFeeInfo.effectiveFee !== 1 ? "s" : ""}
              {uploadFeeInfo.discountPercent > 0 && (
                <span className="text-xs text-green-600 font-normal">
                  ({uploadFeeInfo.discountPercent}% off)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Your balance:</span>
            <span className={uploadFeeInfo.canAfford ? "" : "text-destructive font-medium"}>
              {uploadFeeInfo.balance} credit{uploadFeeInfo.balance !== 1 ? "s" : ""}
            </span>
          </div>
          {!uploadFeeInfo.canAfford && (
            <div className="flex items-start gap-1.5 text-destructive text-xs pt-0.5">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                Insufficient credits. You need {uploadFeeInfo.effectiveFee} credits to upload. Please top up your balance.
              </span>
            </div>
          )}
          {uploadFeeInfo.nextTier && (
            <p className="text-xs text-muted-foreground">
              Upload {uploadFeeInfo.nextTier.threshold - uploadFeeInfo.uploadCount} more resource{uploadFeeInfo.nextTier.threshold - uploadFeeInfo.uploadCount !== 1 ? "s" : ""} to unlock {uploadFeeInfo.nextTier.discountPercent}% off future uploads.
            </p>
          )}
        </div>
      )}

      {/* Publish / Save as Draft */}
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          className="flex-1"
          disabled={
                  isLoading ||
                  subjects.length === 0 ||
                  !formData.url ||
                  !formData.topicId ||
                  (uploadFeeInfo?.isEnabled === true && uploadFeeInfo.canAfford === false)
                }
          onClick={() => setFormData(prev => ({ ...prev, status: "published" }))}
        >
          <Globe className="mr-2 h-4 w-4" />
          {isLoading && formData.status === "published" ? "Publishing..." : "Publish"}
        </Button>
        <Button
          type="submit"
          variant="outline"
          className="flex-1"
          disabled={
                  isLoading ||
                  subjects.length === 0 ||
                  !formData.url ||
                  !formData.topicId ||
                  (uploadFeeInfo?.isEnabled === true && uploadFeeInfo.canAfford === false)
                }
          onClick={() => setFormData(prev => ({ ...prev, status: "draft" }))}
        >
          <FileEdit className="mr-2 h-4 w-4" />
          {isLoading && formData.status === "draft" ? "Saving..." : "Save as Draft"}
        </Button>
      </div>
    </form>
  );
}
