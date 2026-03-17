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
import { Paperclip, Plus, FileText, Video, Headphones, Image as ImageIcon, Check, User, Shield, GraduationCap, ChevronDown, ChevronRight, List, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";
import { getResourcesForUser, getResourcesForUserWithHierarchy } from "@/lib/actions/admin";
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

interface HierarchyResource {
  id: string;
  title: string;
  description: string;
  url: string;
  type: "notes" | "video" | "audio" | "image";
  ownerId: string;
  ownerRole: string;
}

interface HierarchyData {
  subjects: Array<{
    id: string;
    name: string;
    topics: Array<{
      id: string;
      title: string;
      resources: HierarchyResource[];
    }>;
  }>;
}

type ViewMode = "flat" | "hierarchy";

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
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("flat");
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const handleOpen = async () => {
    setOpen(true);
    if (resources.length === 0 && userId && userRole) {
      setIsLoading(true);
      try {
        const [accessibleResources, hierarchyData] = await Promise.all([
          getResourcesForUser(userId, userRole),
          getResourcesForUserWithHierarchy(userId, userRole),
        ]);

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
        setHierarchy(hierarchyData);
        // Auto-expand all subjects
        setExpandedSubjects(new Set(hierarchyData.subjects.map((s) => s.id)));
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

  const handleToggleResource = (res: { id: string; title: string; description: string; url: string; type: "notes" | "video" | "audio" | "image" }) => {
    if (isAttached(res.id)) {
      onRemoveResource(res.id);
    } else {
      onAddResource({
        id: res.id,
        title: res.title,
        description: res.description,
        url: res.url,
        type: res.type,
      });
    }
  };

  const handleSelectAllInGroup = (groupResources: Array<{ id: string; title: string; description: string; url: string; type: "notes" | "video" | "audio" | "image" }>) => {
    const allAttached = groupResources.every((r) => isAttached(r.id));
    if (allAttached) {
      groupResources.forEach((r) => onRemoveResource(r.id));
    } else {
      groupResources.forEach((r) => {
        if (!isAttached(r.id)) {
          onAddResource({ id: r.id, title: r.title, description: r.description, url: r.url, type: r.type });
        }
      });
    }
  };

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) next.delete(topicId);
      else next.add(topicId);
      return next;
    });
  };

  const renderResourceItem = (res: ResourceWithSource | HierarchyResource) => {
    const Icon = TYPE_ICONS[res.type];
    const attached = isAttached(res.id);

    return (
      <div
        key={res.id}
        onClick={() => handleToggleResource(res)}
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
            TYPE_COLORS[res.type].split(" ").find(c => c.startsWith("text-")) ?? "text-muted-foreground"
          )}
        />
        <h4 className="flex-1 min-w-0 truncate font-medium text-sm">
          {res.title}
        </h4>
        {attached && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
        <Badge
          variant="secondary"
          className={cn("text-xs", TYPE_COLORS[res.type])}
        >
          {res.type}
        </Badge>
      </div>
    );
  };

  const renderFlatView = () => (
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
  );

  const renderHierarchyView = () => {
    if (!hierarchy) return null;

    const query = searchQuery.toLowerCase();

    return (
      <div className="space-y-2">
        {hierarchy.subjects.map((subj) => {
          // Filter topics/resources by search
          const filteredTopics = subj.topics
            .map((top) => ({
              ...top,
              resources: top.resources.filter(
                (r) =>
                  !query ||
                  r.title.toLowerCase().includes(query) ||
                  r.description.toLowerCase().includes(query)
              ),
            }))
            .filter((top) => top.resources.length > 0);

          if (filteredTopics.length === 0) return null;

          const isSubjectExpanded = expandedSubjects.has(subj.id);
          const allSubjectResources = filteredTopics.flatMap((t) => t.resources);
          const allSubjectAttached = allSubjectResources.length > 0 && allSubjectResources.every((r) => isAttached(r.id));

          return (
            <div key={subj.id} className="border rounded-lg">
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50 rounded-t-lg"
                onClick={() => toggleSubject(subj.id)}
              >
                {isSubjectExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <h3 className="font-semibold text-sm flex-1">{subj.name}</h3>
                <Checkbox
                  checked={allSubjectAttached}
                  onCheckedChange={() => handleSelectAllInGroup(allSubjectResources)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Badge variant="secondary" className="text-xs">
                  {allSubjectResources.length}
                </Badge>
              </div>

              {isSubjectExpanded && (
                <div className="pl-4 pb-2 space-y-1">
                  {filteredTopics.map((top) => {
                    const isTopicExpanded = expandedTopics.has(top.id);
                    const allTopicAttached = top.resources.length > 0 && top.resources.every((r) => isAttached(r.id));

                    return (
                      <div key={top.id}>
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 rounded"
                          onClick={() => toggleTopic(top.id)}
                        >
                          {isTopicExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="text-sm flex-1 text-muted-foreground">{top.title}</span>
                          <Checkbox
                            checked={allTopicAttached}
                            onCheckedChange={() => handleSelectAllInGroup(top.resources)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Badge variant="outline" className="text-xs">
                            {top.resources.length}
                          </Badge>
                        </div>

                        {isTopicExpanded && (
                          <div className="pl-6 space-y-1">
                            {top.resources.map((r) => renderResourceItem(r as ResourceWithSource | HierarchyResource))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const selectedCount = attachedResources.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={handleOpen}
          className={cn(
            "relative flex items-center justify-center shrink-0 h-7 w-7 rounded-lg text-xs font-medium transition-colors",
            selectedCount > 0
              ? "bg-primary/10 text-primary hover:bg-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
          title={selectedCount > 0 ? `${selectedCount} resource${selectedCount > 1 ? 's' : ''} attached` : "Attach resources"}
        >
          <Paperclip className="h-3.5 w-3.5" />
          {selectedCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center h-3.5 min-w-[0.875rem] rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none px-0.5">
              {selectedCount}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[85vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Add Resources to Chat</DialogTitle>
              <DialogDescription>
                Select resources to include in your conversation.
              </DialogDescription>
            </div>
            {selectedCount > 0 && (
              <Badge variant="default" className="text-xs">
                {selectedCount} selected
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 px-6 py-4 gap-4 overflow-hidden">
          <div className="flex gap-2 flex-shrink-0">
            <Input
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <div className="flex border rounded-md overflow-hidden flex-shrink-0">
              <Button
                variant={viewMode === "flat" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-9 px-2"
                onClick={() => setViewMode("flat")}
                title="Flat List"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "hierarchy" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-9 px-2"
                onClick={() => setViewMode("hierarchy")}
                title="Browse by Topic"
              >
                <FolderTree className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full w-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredResources.length === 0 && viewMode === "flat" ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No accessible resources available</p>
                <p className="text-sm mt-2">
                  No resources match your search
                </p>
              </div>
            ) : viewMode === "flat" ? (
              renderFlatView()
            ) : (
              renderHierarchyView()
            )}
          </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
