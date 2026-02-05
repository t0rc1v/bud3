"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, FileText, Video, Headphones, Image as ImageIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getResources } from "@/lib/actions/teacher";
import type { ResourceWithRelations } from "@/lib/types";

const TYPE_ICONS = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

const TYPE_COLORS = {
  notes: "bg-blue-100 text-blue-800",
  video: "bg-red-100 text-red-800",
  audio: "bg-purple-100 text-purple-800",
  image: "bg-green-100 text-green-800",
};

interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: "notes" | "video" | "audio" | "image";
}

interface AddResourceToChatProps {
  attachedResources: Resource[];
  onAddResource: (resource: Resource) => void;
  onRemoveResource: (resourceId: string) => void;
}

export function AddResourceToChat({
  attachedResources,
  onAddResource,
  onRemoveResource,
}: AddResourceToChatProps) {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState<ResourceWithRelations[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    if (resources.length === 0) {
      setIsLoading(true);
      try {
        const allResources = await getResources();
        setResources(allResources);
      } catch (error) {
        console.error("Failed to load resources:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const filteredResources = resources.filter(
    (resource) =>
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAttached = (resourceId: string) =>
    attachedResources.some((r) => r.id === resourceId);

  const handleToggleResource = (resource: ResourceWithRelations) => {
    if (isAttached(resource.id)) {
      onRemoveResource(resource.id);
    } else {
      onAddResource({
        id: resource.id,
        title: resource.title,
        description: resource.description,
        url: resource.url,
        type: resource.type,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" onClick={handleOpen}>
          <Plus className="h-4 w-4 mr-1" />
          Add Resource
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Resources to Chat</DialogTitle>
          <DialogDescription>
            Select resources to provide context for your conversation
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading resources...
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No resources found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredResources.map((resource) => {
                const Icon = TYPE_ICONS[resource.type];
                const attached = isAttached(resource.id);

                return (
                  <div
                    key={resource.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      attached
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    )}
                    onClick={() => handleToggleResource(resource)}
                  >
                    <Checkbox checked={attached} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium truncate">
                          {resource.title}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {resource.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", TYPE_COLORS[resource.type])}
                        >
                          {resource.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {resource.subject.name} · {resource.topic?.title}
                        </span>
                      </div>
                    </div>
                    {attached && (
                      <Check className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {attachedResources.length} resource
            {attachedResources.length !== 1 ? "s" : ""} attached
          </span>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
