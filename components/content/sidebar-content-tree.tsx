"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  GraduationCap,
  BookOpen,
  FileText,
  FolderOpen,
  Plus,
  Edit,
  Trash2,
  Search,
  ChevronDownSquare,
  ChevronRightSquare,
  MoreVertical,
  Eye,
  User,
  Users,
  Shield,
  Building2,
  Crown,
  Lock,
  Unlock,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateLevelForm } from "@/components/forms/create-level-form";
import { CreateSubjectForm } from "@/components/forms/create-subject-form";
import { CreateTopicForm } from "@/components/forms/create-topic-form";
import { CreateResourceForm } from "@/components/forms/create-resource-form";
import { EditLevelForm } from "@/components/forms/edit-level-form";
import { EditSubjectForm } from "@/components/forms/edit-subject-form";
import { EditTopicForm } from "@/components/forms/edit-topic-form";
import { EditResourceForm } from "@/components/forms/edit-resource-form";
import {
  deleteLevelWithSession,
  deleteSubjectWithSession,
  deleteTopicWithSession,
  deleteResource,
  getResourceById,
  getRegularSuperAdminId,
  getSuperAdminAdminIds,
} from "@/lib/actions/admin";
import { ResourceUnlockModal } from "@/components/credits/resource-unlock-modal";
import type {
  LevelWithFullHierarchy,
  LevelWithFullHierarchyAndUnlockStatus,
  SubjectWithTopics,
  TopicWithResources,
  Resource,
  ResourceWithUnlockStatus,
  ResourceWithRelations,
  Level,
  Subject,
  Topic,
} from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnlockedResources } from "@/components/credits/unlocked-resources-context";

type ContentTab = "my" | "admin(s)" | "institution" | "super" | "admin" | "regular";
type UserRole = "regular" | "admin" | "super_admin";

interface SidebarContentTreeProps {
  initialLevels: LevelWithFullHierarchy[] | LevelWithFullHierarchyAndUnlockStatus[];
  userId: string;
  userRole: UserRole;
  adminIds?: string[];
  availableTabs?: ContentTab[];
  defaultTab?: ContentTab;
  onResourceSelect?: (resource: Resource) => void;
  onAddResourceToChat?: (resource: Resource) => void;
  enableCrud?: boolean;
  className?: string;
}

export function SidebarContentTree({
  initialLevels,
  userId,
  userRole,
  adminIds = [],
  availableTabs,
  defaultTab,
  onResourceSelect,
  onAddResourceToChat,
  enableCrud = true,
  className,
}: SidebarContentTreeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [levels, setLevels] = useState<LevelWithFullHierarchy[]>(initialLevels);
  
  // State for super-admin's admin IDs (for regular users)
  const [superAdminAdminIds, setSuperAdminAdminIds] = useState<string[]>([]);
  
  // Fetch super-admin's admins for regular users
  useEffect(() => {
    if (userRole === "regular") {
      const fetchSuperAdminAdmins = async () => {
        const superAdminId = await getRegularSuperAdminId(userId);
        if (superAdminId) {
          const adminIds = await getSuperAdminAdminIds(superAdminId);
          setSuperAdminAdminIds(adminIds);
        }
      };
      fetchSuperAdminAdmins();
    }
  }, [userRole, userId]);

  // Determine available tabs based on user role if not provided
  const tabs = useMemo(() => {
    if (availableTabs) return availableTabs;
    
    switch (userRole) {
      case "super_admin":
        return ["super", "admin", "regular"] as ContentTab[];
      case "admin":
        return ["my", "institution"] as ContentTab[];
      case "regular":
        return superAdminAdminIds.length > 0 
          ? ["my", "admin(s)", "institution"] as ContentTab[]
          : ["my", "institution"] as ContentTab[];
      default:
        return ["my"] as ContentTab[];
    }
  }, [availableTabs, userRole, superAdminAdminIds]);

  // Determine default tab
  const initialTab = defaultTab || tabs[0];
  const [activeTab, setActiveTab] = useState<ContentTab>(initialTab);

  // Sync levels when initialLevels changes
  useEffect(() => {
    setLevels(initialLevels);
  }, [initialLevels]);

  // Expansion states
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Dialog states
  const [isCreateLevelOpen, setIsCreateLevelOpen] = useState(false);
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCallback, setDeleteCallback] = useState<(() => Promise<void>) | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<{ id: string; type: string; data: unknown } | null>(null);
  const [isLoadingEditResource, setIsLoadingEditResource] = useState(false);

  // Separate content by owner role
  const myLevels = useMemo(() => 
    levels.filter((g) => g.ownerId === userId),
    [levels, userId]
  );

  // Admin(s) Content: content owned by admins under the user's super-admin
  const adminLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "admin" && superAdminAdminIds.includes(g.ownerId || "")),
    [levels, superAdminAdminIds]
  );

  // Institution Content: content owned by the user's super-admin
  const institutionLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "super_admin"),
    [levels]
  );

  const adminAllLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "admin"),
    [levels]
  );

  const regularAllLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "regular"),
    [levels]
  );

  // Get current tab levels
  const currentTabLevels = useMemo(() => {
    switch (activeTab) {
      case "my": return myLevels;
      case "admin(s)": return adminLevels;
      case "institution": return institutionLevels;
      case "super": return institutionLevels;
      case "admin": return adminAllLevels;
      case "regular": return regularAllLevels;
      default: return myLevels;
    }
  }, [activeTab, myLevels, adminLevels, institutionLevels, adminAllLevels, regularAllLevels]);

  // Filter levels based on search
  const filteredLevels = useMemo(() => {
    if (!searchQuery) return currentTabLevels;
    const query = searchQuery.toLowerCase();
    return currentTabLevels.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects.some(s => 
        s.name.toLowerCase().includes(query) ||
        s.topics.some(t => t.title.toLowerCase().includes(query))
      )
    );
  }, [currentTabLevels, searchQuery]);

  // Expansion handlers
  const toggleLevel = (levelId: string) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(levelId)) {
      newExpanded.delete(levelId);
    } else {
      newExpanded.add(levelId);
    }
    setExpandedLevels(newExpanded);
  };

  const toggleSubject = (subjectId: string) => {
    const newExpanded = new Set(expandedSubjects);
    if (newExpanded.has(subjectId)) {
      newExpanded.delete(subjectId);
    } else {
      newExpanded.add(subjectId);
    }
    setExpandedSubjects(newExpanded);
  };

  const toggleTopic = (topicId: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicId)) {
      newExpanded.delete(topicId);
    } else {
      newExpanded.add(topicId);
    }
    setExpandedTopics(newExpanded);
  };

  const expandAll = () => {
    const allSubjects = currentTabLevels.flatMap((g) => g.subjects);
    const allTopics = allSubjects.flatMap((s) => s.topics);
    setExpandedLevels(new Set(currentTabLevels.map((g) => g.id)));
    setExpandedSubjects(new Set(allSubjects.map((s) => s.id)));
    setExpandedTopics(new Set(allTopics.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedLevels(new Set());
    setExpandedSubjects(new Set());
    setExpandedTopics(new Set());
  };

  // Helper to get item name
  const getItemName = (id: string, type: string): string => {
    switch (type) {
      case "level": {
        const level = levels.find(g => g.id === id);
        return level?.title || "Unknown Level";
      }
      case "subject": {
        const subjects = levels.flatMap(g => g.subjects);
        const subject = subjects.find(s => s.id === id);
        return subject?.name || "Unknown Subject";
      }
      case "topic": {
        const subjects = levels.flatMap(g => g.subjects);
        const topics = subjects.flatMap(s => s.topics);
        const topic = topics.find(t => t.id === id);
        return topic?.title || "Unknown Topic";
      }
      case "resource": {
        const subjects = levels.flatMap(g => g.subjects);
        const topics = subjects.flatMap(s => s.topics);
        const resources = topics.flatMap(t => t.resources || []);
        const resource = resources.find(r => r.id === id);
        return resource?.title || "Unknown Resource";
      }
      default:
        return "Unknown Item";
    }
  };

  // Delete handlers
  const openDeleteDialog = (id: string, type: string, deleteFn: () => Promise<void>) => {
    const name = getItemName(id, type);
    setItemToDelete({ id, type, name });
    setDeleteCallback(() => deleteFn);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCallback) return;
    
    setIsDeleting(true);
    try {
      await deleteCallback();
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteCallback(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete item:", error);
      alert("Failed to delete item. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteLevel = async (levelId: string) => {
    openDeleteDialog(levelId, "level?", async () => {
      await deleteLevelWithSession(levelId);
    });
  };

  const handleDeleteSubject = async (subjectId: string) => {
    openDeleteDialog(subjectId, "subject", async () => {
      await deleteSubjectWithSession(subjectId);
    });
  };

  const handleDeleteTopic = async (topicId: string) => {
    openDeleteDialog(topicId, "topic", async () => {
      await deleteTopicWithSession(topicId);
    });
  };

  const handleDeleteResource = async (resourceId: string) => {
    openDeleteDialog(resourceId, "resource", async () => {
      await deleteResource(resourceId);
    });
  };

  // Edit handlers
  const openEditDialog = (item: { id: string; type: string; data: unknown }) => {
    setItemToEdit(item);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setItemToEdit(null);
    router.refresh();
  };

  const handleEditResource = async (resource: Resource) => {
    setItemToEdit({ id: resource.id, type: "resource", data: resource });
    setIsEditDialogOpen(true);
    setIsLoadingEditResource(true);
    
    try {
      const fullResource = await getResourceById(resource.id);
      if (fullResource) {
        setItemToEdit({ id: resource.id, type: "resource", data: fullResource });
      }
    } catch (error) {
      console.error("Failed to load resource for editing:", error);
    } finally {
      setIsLoadingEditResource(false);
    }
  };

  // View resource
  const handleViewResource = useCallback((resource: Resource) => {
    if (onResourceSelect) {
      onResourceSelect(resource);
    } else {
      // Navigate with viewResource query param
      const params = new URLSearchParams(searchParams.toString());
      params.set("viewResource", resource.id);
      router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    }
  }, [onResourceSelect, router, searchParams]);

  // Handle add to chat
  const handleAddToChat = (resource: Resource) => {
    if (onAddResourceToChat) {
      onAddResourceToChat(resource);
    }
  };

  // Get all subjects and topics for forms
  const allSubjects = useMemo(() => currentTabLevels.flatMap((g) => g.subjects), [currentTabLevels]);
  const allTopics = useMemo(() => allSubjects.flatMap((s) => s.topics), [allSubjects]);

  // Get tab icon
  const getTabIcon = (tab: ContentTab) => {
    switch (tab) {
      case "my": return <User className="h-3 w-3" />;
      case "admin(s)": return <Users className="h-3 w-3" />;
      case "institution": return <Building2 className="h-3 w-3" />;
      case "super": return <Shield className="h-3 w-3" />;
      case "admin": return <Building2 className="h-3 w-3" />;
      case "regular": return <User className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  };

  // Get tab label
  const getTabLabel = (tab: ContentTab) => {
    switch (tab) {
      case "my": return "My";
      case "admin(s)": return "Admin(s)";
      case "institution": return "Institution";
      case "super": return "My Content";
      case "admin": return "My Admins";
      case "regular": return "My Regulars";
      default: return tab;
    }
  };

  // Get tab color
  const getTabColor = (tab: ContentTab) => {
    switch (tab) {
      case "my": return "text-primary";
      case "admin(s)": return "text-primary";
      case "institution": return "text-primary";
      case "super": return "text-primary";
      case "admin": return "text-primary";
      case "regular": return "text-primary";
      default: return "text-muted-foreground";
    }
  };

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full", className)}>
        {/* Header with Tabs */}
        {tabs.length > 1 && (
          <div className="border-b">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentTab)} className="w-full">
              <TabsList className="w-full grid grid-cols-2 h-8">
                {tabs.slice(0, 2).map((tab) => (
                  <TabsTrigger 
                    key={tab} 
                    value={tab} 
                    className="text-xs px-1 py-1 h-full flex items-center gap-1"
                  >
                    <span className={cn(getTabColor(tab))}>
                      {getTabIcon(tab)}
                    </span>
                    <span className="hidden sm:inline">{getTabLabel(tab)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.length > 2 && (
                <TabsList className="w-full grid grid-cols-1 h-8 mt-0 rounded-t-none border-t">
                  <TabsTrigger 
                    value={tabs[2]} 
                    className="text-xs px-1 py-1 h-full flex items-center gap-1"
                  >
                    <span className={cn(getTabColor(tabs[2]))}>
                      {getTabIcon(tabs[2])}
                    </span>
                    <span className="hidden sm:inline">{getTabLabel(tabs[2])}</span>
                  </TabsTrigger>
                </TabsList>
              )}
            </Tabs>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/30">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={expandAll}
                >
                  <ChevronDownSquare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Expand All</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={collapseAll}
                >
                  <ChevronRightSquare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Collapse All</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-6 w-6", showSearch && "bg-accent")}
                  onClick={() => setShowSearch(!showSearch)}
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Search</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          {enableCrud && activeTab === "my" && (
            <Dialog open={isCreateLevelOpen} onOpenChange={setIsCreateLevelOpen}>
              <DialogTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Add Level</p>
                  </TooltipContent>
                </Tooltip>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Level</DialogTitle>
                </DialogHeader>
                <CreateLevelForm onSuccess={() => { setIsCreateLevelOpen(false); router.refresh(); }} />
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Search Input */}
        {showSearch && (
          <div className="px-2 py-1.5 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-7 text-xs"
              />
            </div>
          </div>
        )}

        {/* Tree Content */}
        <ScrollArea className="flex-1">
          <div className="p-1">
            {filteredLevels.length === 0 ? (
              <div className="text-center py-4 px-2">
                <FolderOpen className="h-6 w-6 mx-auto mb-1 text-muted-foreground opacity-50" />
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? "No results" : "No content"}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredLevels.map((level) => (
                  <LevelNode
                    key={level.id}
                    level={level}
                    isExpanded={expandedLevels.has(level.id)}
                    expandedSubjects={expandedSubjects}
                    expandedTopics={expandedTopics}
                    onToggle={() => toggleLevel(level.id)}
                    onToggleSubject={toggleSubject}
                    onToggleTopic={toggleTopic}
                    onViewResource={handleViewResource}
                    onAddToChat={handleAddToChat}
                    onDeleteLevel={enableCrud ? handleDeleteLevel : undefined}
                    onDeleteSubject={enableCrud ? handleDeleteSubject : undefined}
                    onDeleteTopic={enableCrud ? handleDeleteTopic : undefined}
                    onDeleteResource={enableCrud ? handleDeleteResource : undefined}
                    onEditLevel={enableCrud ? (g) => openEditDialog({ id: g.id, type: "level", data: g }) : undefined}
                    onEditSubject={enableCrud ? (s) => openEditDialog({ id: s.id, type: "subject", data: s }) : undefined}
                    onEditTopic={enableCrud ? (t) => openEditDialog({ id: t.id, type: "topic", data: t }) : undefined}
                    onEditResource={enableCrud ? handleEditResource : undefined}
                    userId={userId}
                    userRole={userRole}
                    activeTab={activeTab}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground border-t bg-muted/20">
          <span>{filteredLevels.length} items</span>
          <span>{expandedLevels.size + expandedSubjects.size + expandedTopics.size} expanded</span>
        </div>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {itemToDelete?.type}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete &ldquo;{itemToDelete?.name}&rdquo;. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setItemToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className={itemToEdit?.type === "resource" ? "sm:max-w-[600px] max-h-[90vh] overflow-y-auto" : "sm:max-w-[425px]"}>
            <DialogHeader>
              <DialogTitle>Edit {itemToEdit?.type}</DialogTitle>
            </DialogHeader>
            {itemToEdit?.type === "level" && (
              <EditLevelForm 
                level={itemToEdit.data as Level} 
                onSuccess={handleEditSuccess}
              />
            )}
            {itemToEdit?.type === "subject" && (
              <EditSubjectForm 
                subject={itemToEdit.data as Subject}
                levels={currentTabLevels}
                onSuccess={handleEditSuccess}
              />
            )}
            {itemToEdit?.type === "topic" && (
              <EditTopicForm 
                topic={itemToEdit.data as Topic}
                subjects={allSubjects}
                onSuccess={handleEditSuccess}
              />
            )}
            {itemToEdit?.type === "resource" && (
              isLoadingEditResource ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-24 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-10 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <div className="h-10 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-10 w-24 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ) : (
                <EditResourceForm
                  resource={itemToEdit.data as ResourceWithRelations}
                  subjects={currentTabLevels.flatMap(g => g.subjects.map(s => ({ 
                    id: s.id, 
                    name: s.name, 
                    level: { id: g.id, title: g.title } 
                  })))}
                  topics={allTopics.map(t => ({ id: t.id, title: t.title, subjectId: t.subjectId }))}
                  onSuccess={handleEditSuccess}
                  onCancel={() => setIsEditDialogOpen(false)}
                />
              )
            )}
          </DialogContent>
        </Dialog>

        {/* Create Dialogs */}
        <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Subject</DialogTitle>
            </DialogHeader>
            <CreateSubjectForm 
              levels={currentTabLevels} 
              onSuccess={() => { setIsCreateSubjectOpen(false); router.refresh(); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateTopicOpen} onOpenChange={setIsCreateTopicOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Topic</DialogTitle>
            </DialogHeader>
            <CreateTopicForm 
              subjects={allSubjects} 
              onSuccess={() => { setIsCreateTopicOpen(false); router.refresh(); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateResourceOpen} onOpenChange={setIsCreateResourceOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Resource</DialogTitle>
            </DialogHeader>
            <CreateResourceForm 
              subjects={allSubjects}
              topics={allTopics}
              onSuccess={() => { setIsCreateResourceOpen(false); router.refresh(); }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// Level Node Component
interface LevelNodeProps {
  level: LevelWithFullHierarchy;
  isExpanded: boolean;
  expandedSubjects: Set<string>;
  expandedTopics: Set<string>;
  onToggle: () => void;
  onToggleSubject: (id: string) => void;
  onToggleTopic: (id: string) => void;
  onViewResource: (resource: Resource) => void;
  onAddToChat: (resource: Resource) => void;
  onDeleteLevel?: (id: string) => void;
  onDeleteSubject?: (id: string) => void;
  onDeleteTopic?: (id: string) => void;
  onDeleteResource?: (id: string) => void;
  onEditLevel?: (level: LevelWithFullHierarchy) => void;
  onEditSubject?: (subject: SubjectWithTopics) => void;
  onEditTopic?: (topic: TopicWithResources) => void;
  onEditResource?: (resource: Resource) => void;
  userId: string;
  userRole: UserRole;
  activeTab: ContentTab;
}

function LevelNode({
  level,
  isExpanded,
  expandedSubjects,
  expandedTopics,
  onToggle,
  onToggleSubject,
  onToggleTopic,
  onViewResource,
  onAddToChat,
  onDeleteLevel,
  onDeleteSubject,
  onDeleteTopic,
  onDeleteResource,
  onEditLevel,
  onEditSubject,
  onEditTopic,
  onEditResource,
  userId,
  userRole,
  activeTab,
}: LevelNodeProps) {
  const isOwner = level?.ownerId === userId;
  const isSuperAdmin = userRole === "super_admin";
  const canManage = onDeleteLevel && (isOwner || isSuperAdmin);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);

  return (
    <div>
      <div 
        className={cn(
          "flex items-center gap-1 py-1 px-1 rounded-sm hover:bg-accent cursor-pointer group",
          isExpanded && "bg-accent/50"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </Button>
        
        <div 
          className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
          style={{ backgroundColor: level.color }}
        >
          {level.levelNumber}
        </div>
        
        <span 
          className="text-xs font-medium flex-1 truncate"
          onClick={onToggle}
        >
          {level.title}
        </span>
        
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {level.subjects.length}
        </span>
        
        {canManage && (
          <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity flex-shrink-0">
            <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Subject to {level.title}</DialogTitle>
                </DialogHeader>
                <CreateSubjectForm
                  levels={[level]}
                  onSuccess={() => { setIsAddSubjectOpen(false); window.location.reload(); }}
                />
              </DialogContent>
            </Dialog>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditLevel?.(level)}>
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDeleteLevel?.(level.id)}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      
      {isExpanded && (
        <div className="ml-2 pl-2 border-l">
          {level.subjects.map((subject) => (
            <SubjectNode
              key={subject.id}
              subject={subject}
              isExpanded={expandedSubjects.has(subject.id)}
              expandedTopics={expandedTopics}
              onToggle={() => onToggleSubject(subject.id)}
              onToggleTopic={onToggleTopic}
              onViewResource={onViewResource}
              onAddToChat={onAddToChat}
              onDeleteSubject={onDeleteSubject}
              onDeleteTopic={onDeleteTopic}
              onDeleteResource={onDeleteResource}
              onEditSubject={onEditSubject}
              onEditTopic={onEditTopic}
              onEditResource={onEditResource}
              userId={userId}
              userRole={userRole}
              activeTab={activeTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Subject Node Component
interface SubjectNodeProps {
  subject: SubjectWithTopics;
  isExpanded: boolean;
  expandedTopics: Set<string>;
  onToggle: () => void;
  onToggleTopic: (id: string) => void;
  onViewResource: (resource: Resource) => void;
  onAddToChat: (resource: Resource) => void;
  onDeleteSubject?: (id: string) => void;
  onDeleteTopic?: (id: string) => void;
  onDeleteResource?: (id: string) => void;
  onEditSubject?: (subject: SubjectWithTopics) => void;
  onEditTopic?: (topic: TopicWithResources) => void;
  onEditResource?: (resource: Resource) => void;
  userId: string;
  userRole: UserRole;
  activeTab: ContentTab;
}

function SubjectNode({
  subject,
  isExpanded,
  expandedTopics,
  onToggle,
  onToggleTopic,
  onViewResource,
  onAddToChat,
  onDeleteSubject,
  onDeleteTopic,
  onDeleteResource,
  onEditSubject,
  onEditTopic,
  onEditResource,
  userId,
  userRole,
  activeTab,
}: SubjectNodeProps) {
  const isOwner = subject.ownerId === userId;
  const isSuperAdmin = userRole === "super_admin";
  const canManage = onDeleteSubject && (isOwner || isSuperAdmin);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);

  return (
    <div>
      <div 
        className={cn(
          "flex items-center gap-1 py-0.5 px-1 rounded-sm hover:bg-accent cursor-pointer group",
          isExpanded && "bg-accent/30"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
        
        <div 
          className="w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center text-[8px]"
          style={{ backgroundColor: subject.color }}
        >
          {subject.icon}
        </div>
        
        <BookOpen className="h-3 w-3 text-primary flex-shrink-0" />
        
        <span 
          className="text-[11px] flex-1 truncate"
          onClick={onToggle}
        >
          {subject.name}
        </span>
        
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {subject.topics.length}
        </span>
        
        {canManage && (
          <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity flex-shrink-0">
            <Dialog open={isAddTopicOpen} onOpenChange={setIsAddTopicOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="h-2.5 w-2.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Topic to {subject.name}</DialogTitle>
                </DialogHeader>
                <CreateTopicForm
                  subjects={[subject]}
                  onSuccess={() => { setIsAddTopicOpen(false); window.location.reload(); }}
                />
              </DialogContent>
            </Dialog>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditSubject?.(subject)}>
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDeleteSubject?.(subject.id)}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      
      {isExpanded && (
        <div className="ml-1.5 pl-1.5 border-l">
          {subject.topics.map((topic) => (
            <TopicNode
              key={topic.id}
              topic={topic}
              isExpanded={expandedTopics.has(topic.id)}
              onToggle={() => onToggleTopic(topic.id)}
              onViewResource={onViewResource}
              onAddToChat={onAddToChat}
              onDeleteTopic={onDeleteTopic}
              onDeleteResource={onDeleteResource}
              onEditTopic={onEditTopic}
              onEditResource={onEditResource}
              userId={userId}
              userRole={userRole}
              activeTab={activeTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Topic Node Component
interface TopicNodeProps {
  topic: TopicWithResources;
  isExpanded: boolean;
  onToggle: () => void;
  onViewResource: (resource: Resource) => void;
  onAddToChat: (resource: Resource) => void;
  onDeleteTopic?: (id: string) => void;
  onDeleteResource?: (id: string) => void;
  onEditTopic?: (topic: TopicWithResources) => void;
  onEditResource?: (resource: Resource) => void;
  userId: string;
  userRole: UserRole;
  activeTab: ContentTab;
}

function TopicNode({
  topic,
  isExpanded,
  onToggle,
  onViewResource,
  onAddToChat,
  onDeleteTopic,
  onDeleteResource,
  onEditTopic,
  onEditResource,
  userId,
  userRole,
  activeTab,
}: TopicNodeProps) {
  const isOwner = topic.ownerId === userId;
  const isSuperAdmin = userRole === "super_admin";
  const canManage = onDeleteTopic && (isOwner || isSuperAdmin);
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);

  return (
    <div>
      <div 
        className={cn(
          "flex items-center gap-1 py-0.5 px-1 rounded-sm hover:bg-accent cursor-pointer group",
          isExpanded && "bg-accent/20"
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 p-0 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
        
        <FolderOpen className="h-3 w-3 text-primary flex-shrink-0" />
        
        <span 
          className="text-[11px] flex-1 truncate"
          onClick={onToggle}
        >
          {topic.title}
        </span>
        
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {topic.resources?.length || 0}
        </span>
        
        {canManage && (
          <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity flex-shrink-0">
            <Dialog open={isAddResourceOpen} onOpenChange={setIsAddResourceOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="h-2.5 w-2.5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add Resource to {topic.title}</DialogTitle>
                </DialogHeader>
                <CreateResourceForm
                  subjects={[]}
                  topics={[topic]}
                  onSuccess={() => { setIsAddResourceOpen(false); window.location.reload(); }}
                />
              </DialogContent>
            </Dialog>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditTopic?.(topic)}>
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDeleteTopic?.(topic.id)}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      
      {isExpanded && topic.resources && (
        <div className="ml-1 pl-1 border-l">
          {topic.resources.map((resource) => (
            <ResourceNode
              key={resource.id}
              resource={resource}
              onView={() => onViewResource(resource)}
              onAddToChat={() => onAddToChat(resource)}
              onDelete={onDeleteResource}
              onEdit={onEditResource}
              userId={userId}
              userRole={userRole}
              activeTab={activeTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Resource Node Component
interface ResourceNodeProps {
  resource: Resource | ResourceWithUnlockStatus;
  onView: () => void;
  onAddToChat: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (resource: Resource) => void | Promise<void>;
  userId: string;
  userRole: UserRole;
  activeTab: ContentTab;
}

function ResourceNode({
  resource,
  onView,
  onAddToChat,
  onDelete,
  onEdit,
  userId,
  userRole,
  activeTab,
}: ResourceNodeProps) {
  const { isResourceUnlocked, addUnlockedResource } = useUnlockedResources();
  const isOwner = resource.ownerId === userId;
  const isSuperAdmin = userRole === "super_admin";
  const canDelete = onDelete && (isOwner || isSuperAdmin);
  const canEdit = onEdit && (isOwner || isSuperAdmin);
  
  // Check if resource has isUnlocked field (from new API) or fall back to computing from isLocked
  const hasUnlockStatus = 'isUnlocked' in resource;
  const contextUnlocked = isResourceUnlocked(resource.id);
  const initiallyUnlocked = contextUnlocked || hasUnlockStatus 
    ? (resource as ResourceWithUnlockStatus).isUnlocked || !resource.isLocked || isOwner || isSuperAdmin
    : !resource.isLocked || isOwner || isSuperAdmin;
  const [localUnlocked, setLocalUnlocked] = useState(initiallyUnlocked);
  
  // Use context state if available, otherwise fall back to local state
  const isUnlocked = contextUnlocked || localUnlocked;

  const handleUnlockSuccess = () => {
    addUnlockedResource(resource.id);
    setLocalUnlocked(true);
  };

  return (
    <div className="flex items-center gap-1 py-0.5 px-1 rounded-sm hover:bg-accent group">
      {resource.isLocked ? (
        <Lock className="h-3 w-3 text-yellow-500 flex-shrink-0" />
      ) : (
        <FileText className="h-3 w-3 text-primary flex-shrink-0" />
      )}
      
      <span 
        className="text-[11px] flex-1 truncate cursor-pointer"
        onClick={isUnlocked ? onView : undefined}
      >
        {resource.title}
      </span>
      
      {resource.isLocked && !isUnlocked && !isOwner && !isSuperAdmin ? (
        <ResourceUnlockModal
          resourceId={resource.id}
          resourceTitle={resource.title}
          resourceType={resource.type}
          unlockFeeKes={resource.unlockFee || 100}
          isUnlocked={false}
          trigger={
            <Button 
              variant="ghost" 
              size="icon"
              className="h-4 w-4 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10"
            >
              <CreditCard className="h-2.5 w-2.5" />
            </Button>
          }
          onUnlockSuccess={handleUnlockSuccess}
        />
      ) : (
            <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity flex-shrink-0"
            >
              <MoreVertical className="h-2.5 w-2.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Eye className="h-3 w-3 mr-2" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddToChat}>
              <Plus className="h-3 w-3 mr-2" />
              Add to Chat
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit?.(resource)}>
                <Edit className="h-3 w-3 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete?.(resource.id)}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
