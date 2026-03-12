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
import { Plus, FileText, Video, Headphones, Image as ImageIcon, Check, User, Shield, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getResourcesForUser } from "@/lib/actions/admin";
import type { Resource } from "@/lib/types";
import type { UserRole } from "@/lib/types";

const TYPE_ICONS = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

const TYPE_COLORS = {
  notes: "bg-primary/15 text-foreground",
  video: "bg-red-500/15 text-foreground",
  audio: "bg-primary/35 text-foreground",
  image: "bg-primary/50 text-foreground",
};

export interface ChatResource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: "notes" | "video" | "audio" | "image";
}

type ResourceSource = "own" | "super_admin" | "admin";

interface ResourceWithSource extends Resource {
  source: ResourceSource;
}

interface AddResourceToChatProps {
  attachedResources: ChatResource[];
  onAddResource: (resource: ChatResource) => void;
  onRemoveResource: (resourceId: string) => void;
  userId?: string;
  userRole?: UserRole;
}

export function AddResourceToChat({
  attachedResources,
  onAddResource,
  onRemoveResource,
  userId,
  userRole,
}: AddResourceToChatProps) {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState<ResourceWithSource[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    if (resources.length === 0 && userId && userRole) {
      setIsLoading(true);
      try {
        const accessibleResources = await getResourcesForUser(userId, userRole);

        const resourcesWithSource = accessibleResources.map((resource) => {
          let source: ResourceSource = "own";
          if (resource.ownerRole === "super_admin") {
            source = "super_admin";
          } else if (resource.ownerId !== userId && resource.ownerRole === "admin") {
            source = "admin";
          }
          return { ...resource, source };
        });

        setResources(resourcesWithSource);
      } catch (error) {
        console.error("Failed to load resources:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const filteredResources = resources.filter((resource) =>
    resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    resource.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ownResources = filteredResources.filter(r => r.source === "own");
  const superAdminResources = filteredResources.filter(r => r.source === "super_admin");
  const adminResources = filteredResources.filter(r => r.source === "admin");

  const isAttached = (resourceId: string) =>
    attachedResources.some((r) => r.id === resourceId);

  const handleToggleResource = (resource: ResourceWithSource) => {
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

  const renderResourceItem = (resource: ResourceWithSource) => {
    const Icon = TYPE_ICONS[resource.type];
    const attached = isAttached(resource.id);

    return (
      <div
        key={resource.id}
        onClick={() => handleToggleResource(resource)}
        className={cn(
          "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors cursor-pointer",
          attached
            ? "bg-primary/10 border border-primary/20"
            : "hover:bg-muted border border-transparent"
        )}
      >
        <Checkbox
          checked={attached}
          onChange={() => {}}
        />
        <Icon
          className={cn(
            "h-4 w-4 flex-shrink-0",
            TYPE_COLORS[resource.type].split(" ").find(c => c.startsWith("text-")) ?? "text-muted-foreground"
          )}
        />
        <h4 className="flex-1 min-w-0 truncate font-medium text-sm">
          {resource.title}
        </h4>
        {attached && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
        <Badge
          variant="secondary"
          className={cn("text-xs", TYPE_COLORS[resource.type])}
        >
          {resource.type}
        </Badge>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" onClick={handleOpen}>
          <Plus className="h-4 w-4 mr-2" />
          Add Resources
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0 border-b">
          <DialogTitle>Add Resources to Chat</DialogTitle>
          <DialogDescription>
            Select resources to include in your conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4 overflow-hidden">
          <Input
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-shrink-0"
          />

          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No accessible resources available</p>
                <p className="text-sm mt-2">
                  No resources match your search
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {ownResources.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <User className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Your Content</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {ownResources.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {ownResources.map(renderResourceItem)}
                    </div>
                  </div>
                )}

                {superAdminResources.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <Shield className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">From Super Admin</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {superAdminResources.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {superAdminResources.map(renderResourceItem)}
                    </div>
                  </div>
                )}

                {adminResources.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <GraduationCap className="h-4 w-4 text-foreground" />
                      <h3 className="font-semibold text-sm">From Your Admin</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {adminResources.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {adminResources.map(renderResourceItem)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
