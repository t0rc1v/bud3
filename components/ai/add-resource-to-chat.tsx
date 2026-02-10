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
import { Plus, FileText, Video, Headphones, Image as ImageIcon, Check, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getResources } from "@/lib/actions/teacher";
import { hasUserUnlockedContent, getUnlockFeeByResource } from "@/lib/actions/credits";
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

export interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: "notes" | "video" | "audio" | "image";
}

interface ResourceWithUnlockStatus extends ResourceWithRelations {
  isUnlocked: boolean;
  creditsRequired: number;
}

interface AddResourceToChatProps {
  attachedResources: Resource[];
  onAddResource: (resource: Resource) => void;
  onRemoveResource: (resourceId: string) => void;
  userId?: string;
}

export function AddResourceToChat({
  attachedResources,
  onAddResource,
  onRemoveResource,
  userId,
}: AddResourceToChatProps) {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState<ResourceWithUnlockStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    if (resources.length === 0) {
      setIsLoading(true);
      try {
        // Get all resources
        const allResources = await getResources();
        
        // Check unlock status for each resource
        const resourcesWithStatus = await Promise.all(
          allResources.map(async (resource) => {
            let isUnlocked = true; // Default to unlocked if no fee exists
            let creditsRequired = 0;
            
            if (userId) {
              const unlockFee = await getUnlockFeeByResource(resource.id);
              if (unlockFee) {
                creditsRequired = unlockFee.creditsRequired;
                isUnlocked = await hasUserUnlockedContent(userId, unlockFee.id);
              }
            }
            
            return {
              ...resource,
              isUnlocked,
              creditsRequired,
            };
          })
        );
        
        setResources(resourcesWithStatus);
      } catch (error) {
        console.error("Failed to load resources:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Filter only unlocked resources
  const unlockedResources = resources.filter(r => r.isUnlocked);
  
  const filteredResources = unlockedResources.filter(
    (resource) =>
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isAttached = (resourceId: string) =>
    attachedResources.some((r) => r.id === resourceId);

  const handleToggleResource = async (resource: ResourceWithUnlockStatus) => {
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

  // Count locked resources
  const lockedCount = resources.filter(r => !r.isUnlocked).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <Plus className="h-4 w-4 mr-2" />
          Add Resources
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Add Resources to Chat</DialogTitle>
          <DialogDescription>
            Select unlocked resources to include in your conversation.
            {lockedCount > 0 && (
              <span className="block mt-2 text-yellow-600">
                <Lock className="h-4 w-4 inline mr-1" />
                {lockedCount} resources are locked and not shown. 
                <a href="/learner/dashboard" className="underline">Unlock them first</a>.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {unlockedResources.length === 0 ? (
                  <>
                    <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No unlocked resources available</p>
                    <p className="text-sm mt-2">
                      <a href="/learner/dashboard" className="text-primary underline">
                        Go to dashboard to unlock content
                      </a>
                    </p>
                  </>
                ) : (
                  <p>No resources match your search</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredResources.map((resource) => {
                  const Icon = TYPE_ICONS[resource.type];
                  const attached = isAttached(resource.id);

                  return (
                    <div
                      key={resource.id}
                      onClick={() => handleToggleResource(resource)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                        attached
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted border border-transparent"
                      )}
                    >
                      <Checkbox
                        checked={attached}
                        onChange={() => {}}
                        className="mt-1"
                      />
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          TYPE_COLORS[resource.type]
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium truncate">
                            {resource.title}
                          </h4>
                          {attached && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
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
                          <Unlock className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-600">Unlocked</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
