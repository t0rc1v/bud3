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
import { Plus, FileText, Video, Headphones, Image as ImageIcon, Check, Lock, Unlock, User, Shield, GraduationCap, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { getResourcesForUser } from "@/lib/actions/admin";
import { hasUserUnlockedContent, getUnlockFeeByResource } from "@/lib/actions/credits";
import { ResourceUnlockModal } from "@/components/credits/resource-unlock-modal";
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

interface ResourceWithUnlockStatus extends Resource {
  isUnlocked: boolean;
  creditsRequired: number;
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
  const [resources, setResources] = useState<ResourceWithUnlockStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    if (resources.length === 0 && userId && userRole) {
      setIsLoading(true);
      try {
        // Get resources the user has access to based on ownership rules
        const accessibleResources = await getResourcesForUser(userId, userRole);
        
        // Check unlock status for each resource and categorize by source
        const resourcesWithStatus = await Promise.all(
          accessibleResources.map(async (resource) => {
            let isUnlocked = true; // Default to unlocked
            let creditsRequired = 0;
            
            // Determine source
            let source: ResourceSource = "own";
            if (resource.ownerRole === "super_admin") {
              source = "super_admin";
            } else if (resource.ownerId !== userId && resource.ownerRole === "admin") {
              source = "admin";
            }
            
            // Super-admins bypass all locking - all resources are unlocked for them
            if (userRole === "super_admin") {
              isUnlocked = true;
            } else if (source !== "own" && resource.isLocked && userId) {
              const unlockFee = await getUnlockFeeByResource(resource.id);
              if (unlockFee) {
                creditsRequired = unlockFee.creditsRequired;
                isUnlocked = await hasUserUnlockedContent(userId, unlockFee.id);
              } else {
                // Resource is marked as locked but no unlock fee exists
                isUnlocked = false;
              }
            }
            
            return {
              ...resource,
              isUnlocked,
              creditsRequired,
              source,
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

  // Filter resources based on search only - show all accessible resources including locked ones
  const filteredResources = resources.filter((resource) => {
    return (
      resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      resource.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Group resources by source
  const ownResources = filteredResources.filter(r => r.source === "own");
  const superAdminResources = filteredResources.filter(r => r.source === "super_admin");
  const adminResources = filteredResources.filter(r => r.source === "admin");

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

  const renderResourceItem = (resource: ResourceWithUnlockStatus) => {
    const Icon = TYPE_ICONS[resource.type];
    const attached = isAttached(resource.id);
    const isLocked = !resource.isUnlocked && resource.source !== "own";

    const handleUnlockSuccess = () => {
      // Update the resource's unlock status in the local state
      setResources(prev => prev.map(r => 
        r.id === resource.id ? { ...r, isUnlocked: true } : r
      ));
    };

    return (
      <div
        key={resource.id}
        onClick={() => !isLocked && handleToggleResource(resource)}
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg transition-colors",
          isLocked
            ? "bg-muted/50 border border-muted cursor-not-allowed"
            : attached
              ? "bg-primary/10 border border-primary/20 cursor-pointer"
              : "hover:bg-muted border border-transparent cursor-pointer"
        )}
      >
        <Checkbox
          checked={attached}
          disabled={isLocked}
          onChange={() => {}}
          className="mt-1"
        />
        <div
          className={cn(
            "p-2 rounded-lg flex-shrink-0",
            isLocked ? "bg-muted text-muted-foreground" : TYPE_COLORS[resource.type]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn("font-medium truncate", isLocked && "text-muted-foreground")}>
              {resource.title}
            </h4>
            {attached && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </div>
          <p className={cn("text-sm line-clamp-2", isLocked ? "text-muted-foreground/70" : "text-muted-foreground")}>
            {resource.description}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant="secondary"
              className={cn("text-xs", isLocked ? "bg-muted text-muted-foreground" : TYPE_COLORS[resource.type])}
            >
              {resource.type}
            </Badge>
            {isLocked ? (
              <>
                <Lock className="h-3 w-3 text-yellow-600" />
                <span className="text-xs text-yellow-600">Locked</span>
                {resource.source !== "own" && (
                  <ResourceUnlockModal
                    resourceId={resource.id}
                    resourceTitle={resource.title}
                    resourceType={resource.type}
                    unlockFeeKes={resource.unlockFee || 100}
                    isUnlocked={false}
                    trigger={
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-6 px-2 text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 ml-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Unlock
                      </Button>
                    }
                    onUnlockSuccess={handleUnlockSuccess}
                  />
                )}
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">Unlocked</span>
              </>
            )}
          </div>
        </div>
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
            {userRole === "regular" ? (
              <>
                Select unlocked resources to include in your conversation.
                <span className="block mt-1 text-xs text-muted-foreground">
                  Showing: Your content + Super Admin content + Content from your Admin (locked resources shown but require unlock)
                </span>
              </>
            ) : (
              "Select resources to include in your conversation."
            )}
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
                <Lock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No accessible resources available</p>
                <p className="text-sm mt-2">
                  No resources match your search
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Your Content Section */}
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

                {/* Super Admin Content Section */}
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

                {/* Admin Content Section */}
                {adminResources.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                      <GraduationCap className="h-4 w-4 text-foreground" />
                      <h3 className="font-semibold text-sm">From Your Admin</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {adminResources.filter(r => r.isUnlocked).length} unlocked
                        {adminResources.filter(r => !r.isUnlocked).length > 0 && (
                          <span className="text-yellow-600 ml-1">
                            ({adminResources.filter(r => !r.isUnlocked).length} locked)
                          </span>
                        )}
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
