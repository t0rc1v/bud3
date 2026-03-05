"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  GraduationCap,
  BookOpen,
  FileText,
  Library,
  Plus,
  Edit,
  Trash2,
  Search,
  FolderOpen,
  MoreVertical,
  ExternalLink,
  ChevronDownSquare,
  ChevronRightSquare,
  Eye,
  User,
  Users,
  Shield,
  Lock,
  Unlock,
  CreditCard,
  Building2,
} from "lucide-react";
import { ResourceViewer, ResourceViewerSkeleton } from "@/components/resources/resource-viewer";
import { getResourceById } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ResourceUnlockModal } from "@/components/credits/resource-unlock-modal";
import { useUnlockedResources } from "@/components/credits/unlocked-resources-context";
import {
  deleteLevelWithSession,
  deleteSubjectWithSession,
  deleteTopicWithSession,
  deleteResource,
} from "@/lib/actions/admin";
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

interface UnifiedAdminPageClientProps {
  initialLevels: LevelWithFullHierarchy[] | LevelWithFullHierarchyAndUnlockStatus[];
  userId: string;
  userRole: "admin" | "super_admin";
}

export function AdminDashboardClient({
  initialLevels,
  userId,
  userRole,
}: UnifiedAdminPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: clerkUser } = useUser();
  const [levels, setLevels] = useState<LevelWithFullHierarchy[]>(initialLevels);

  // Tab state
  const [activeTab, setActiveTab] = useState<"my" | "institution">("my");

  // Sync levels when initialLevels changes (after revalidation)
  useEffect(() => {
    setLevels(initialLevels);
  }, [initialLevels]);

  // Expansion states
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");

  // Resource viewer state
  const [selectedResource, setSelectedResource] = useState<ResourceWithRelations | null>(null);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [openResourceInEditMode, setOpenResourceInEditMode] = useState(false);

  // Dialog states
  const [isCreateLevelOpen, setIsCreateLevelOpen] = useState(false);
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);

  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<{ id: string; type: string; data: unknown } | null>(null);
  const [isLoadingEditResource, setIsLoadingEditResource] = useState(false);

  // Delete dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCallback, setDeleteCallback] = useState<(() => Promise<void>) | null>(null);

  // Use shared context for unlocked resources
  const { isResourceUnlocked, addUnlockedResource } = useUnlockedResources();

  // Handle viewResource query param from file tree dropdown
  useEffect(() => {
    const viewResourceId = searchParams.get("viewResource");
    if (viewResourceId && levels.length > 0) {
      const loadResource = async () => {
        setIsLoadingResource(true);
        try {
          const resource = await getResourceById(viewResourceId);
          if (resource) {
            setSelectedResource(resource);
          }
        } catch (error) {
          console.error("Failed to load resource:", error);
        } finally {
          setIsLoadingResource(false);
        }
      };
      loadResource();
    }
  }, [searchParams, levels]);

  // Separate content by owner role and owner ID
  // My Content: only content owned by the current user (regardless of role when created)
  const myLevels = useMemo(() => 
    levels.filter((g) => g.ownerId === userId),
    [levels, userId]
  );
  
  // Institution: content owned by super_admin
  const institutionLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "super_admin"),
    [levels]
  );

  // Stats
  const myStats = useMemo(() => {
    const subjects = myLevels.flatMap((g) => g.subjects);
    const topics = subjects.flatMap((s) => s.topics);
    const resources = topics.flatMap((t) => t.resources);
    return {
      levels: myLevels.length,
      subjects: subjects.length,
      topics: topics.length,
      resources: resources.length,
    };
  }, [myLevels]);

  const institutionStats = useMemo(() => {
    const subjects = institutionLevels.flatMap((g) => g.subjects);
    const topics = subjects.flatMap((s) => s.topics);
    const resources = topics.flatMap((t) => t.resources);
    return {
      levels: institutionLevels.length,
      subjects: subjects.length,
      topics: topics.length,
      resources: resources.length,
    };
  }, [institutionLevels]);

  // Get all subjects and topics for forms (only from my content)
  const allSubjects = useMemo(() => myLevels.flatMap((g) => g.subjects), [myLevels]);
  const allTopics = useMemo(() => allSubjects.flatMap((s) => s.topics), [allSubjects]);

  // Get all subjects and topics for the current tab's expand/collapse functionality
  const currentTabLevels = activeTab === "my" ? myLevels : institutionLevels;
  const currentTabSubjects = useMemo(() => 
    currentTabLevels.flatMap((g) => g.subjects), 
    [currentTabLevels]
  );
  const currentTabTopics = useMemo(() => 
    currentTabSubjects.flatMap((s) => s.topics), 
    [currentTabSubjects]
  );

  // Filter levels based on search and active tab
  const filteredMyLevels = useMemo(() => {
    if (!searchQuery) return myLevels;
    const query = searchQuery.toLowerCase();
    return myLevels.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects.some(s => 
        s.name.toLowerCase().includes(query) ||
        s.topics.some(t => t.title.toLowerCase().includes(query))
      )
    );
  }, [myLevels, searchQuery]);

  const filteredInstitutionLevels = useMemo(() => {
    if (!searchQuery) return institutionLevels;
    const query = searchQuery.toLowerCase();
    return institutionLevels.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects.some(s => 
        s.name.toLowerCase().includes(query) ||
        s.topics.some(t => t.title.toLowerCase().includes(query))
      )
    );
  }, [institutionLevels, searchQuery]);

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
    setExpandedLevels(new Set(currentTabLevels.map((g) => g.id)));
    setExpandedSubjects(new Set(currentTabSubjects.map((s) => s.id)));
    setExpandedTopics(new Set(currentTabTopics.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedLevels(new Set());
    setExpandedSubjects(new Set());
    setExpandedTopics(new Set());
  };

  // Helper to get item name from ID
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
        const resources = topics.flatMap(t => t.resources);
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

  // View resource
  const handleViewResource = async (resource: Resource, editMode = false) => {
    setIsLoadingResource(true);
    setOpenResourceInEditMode(editMode);
    try {
      const fullResource = await getResourceById(resource.id);
      if (fullResource) {
        setSelectedResource(fullResource);
      }
    } finally {
      setIsLoadingResource(false);
    }
  };

  const handleEditResource = async (resource: Resource) => {
    // Open modal immediately with loading state
    setItemToEdit({ id: resource.id, type: "resource", data: resource });
    setIsEditDialogOpen(true);
    setIsLoadingEditResource(true);
    
    // Fetch full resource data with relations
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

  // Edit handlers for levels, subjects, topics
  const openEditDialog = (item: { id: string; type: string; data: unknown }) => {
    setItemToEdit(item);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setItemToEdit(null);
    router.refresh();
  };

  const handleBackFromViewer = () => {
    setSelectedResource(null);
    setOpenResourceInEditMode(false);
  };

  if (isLoadingResource) {
    return <ResourceViewerSkeleton />;
  }

  if (selectedResource) {
    return (
      <ResourceViewer
        resource={selectedResource}
        onBack={handleBackFromViewer}
        subjects={allSubjects.map((s) => ({
          ...s,
          level: levels.find((g) => g.subjects.some((sub) => sub.id === s.id)) || {
            id: "",
            title: "Unknown",
          },
        }))}
        topics={allTopics}
        initialEditMode={openResourceInEditMode}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Content Management
        </h2>
        <p className="text-muted-foreground">
          Manage all educational content from one central hub. Navigate through
          levels, subjects, topics, and resources.
        </p>
      </div>

      {/* Stats Cards - Clickable to switch tabs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === "my" && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={() => setActiveTab("my")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              My Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myStats.levels}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {myStats.subjects} subjects, {myStats.resources} resources
            </p>
            <p className="text-xs text-foreground mt-1">
              {activeTab === "my" ? "Currently viewing" : "Click to view"}
            </p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === "institution" && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={() => setActiveTab("institution")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Institution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{institutionStats.levels}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {institutionStats.subjects} subjects, {institutionStats.resources} resources
            </p>
            <p className="text-xs text-foreground mt-1">
              {activeTab === "institution" ? "Currently viewing" : "Click to view"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for My Content and Institution */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my" | "institution")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
            <User className="h-4 w-4" />
            <span className="text-xs sm:text-sm whitespace-nowrap">My Content</span>
            <Badge variant="secondary" className="ml-1 text-xs hidden sm:inline">{myStats.levels}</Badge>
          </TabsTrigger>
          <TabsTrigger value="institution" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs sm:text-sm whitespace-nowrap">Institution</span>
            <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground text-xs hidden sm:inline">{institutionStats.levels}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4 mt-6">
          {/* Quick Actions & Search - Only show in My Content tab */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Dialog open={isCreateLevelOpen} onOpenChange={setIsCreateLevelOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 sm:h-9 sm:h-10 gap-1">
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">Add Level</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Level</DialogTitle>
                  </DialogHeader>
                  <CreateLevelForm onSuccess={() => setIsCreateLevelOpen(false)} />
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1" disabled={levels.length === 0}>
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">Add Subject</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Subject</DialogTitle>
                  </DialogHeader>
                  <CreateSubjectForm levels={myLevels} onSuccess={() => setIsCreateSubjectOpen(false)} />
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateTopicOpen} onOpenChange={setIsCreateTopicOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1" disabled={allSubjects.length === 0}>
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">Add Topic</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Topic</DialogTitle>
                  </DialogHeader>
                  <CreateTopicForm subjects={allSubjects} onSuccess={() => setIsCreateTopicOpen(false)} />
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateResourceOpen} onOpenChange={setIsCreateResourceOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1" disabled={allTopics.length === 0}>
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">Add Resource</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create New Resource</DialogTitle>
                  </DialogHeader>
                  <CreateResourceForm subjects={allSubjects} topics={allTopics} onSuccess={() => setIsCreateResourceOpen(false)} />
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={expandAll}>
                <ChevronDownSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Expand</span>
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={collapseAll}>
                <ChevronRightSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Collapse</span>
              </Button>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          {/* My Content Tree */}
          {filteredMyLevels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No content yet</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Get started by creating your first level?"}
                </p>
                {!searchQuery && (
                  <Button className="mt-4" onClick={() => setIsCreateLevelOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Level
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredMyLevels.map((level: LevelWithFullHierarchy) => (
            <Card key={level.id} className="overflow-hidden">
              {/* Level Header */}
              <div 
                className="flex items-center justify-between p-2 sm:p-4 bg-muted/50 cursor-pointer hover:bg-muted gap-2"
                onClick={() => toggleLevel(level.id)}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {expandedLevels.has(level.id) ? (
                    <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0"
                    style={{ backgroundColor: level.color }}
                  >
                    {level.levelNumber}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-base sm:text-lg truncate block">{level.title}</span>
                  </div>
                  <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                    {level.subjects.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                        <Plus className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Add Subject</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Add Subject to {level.title}</DialogTitle>
                      </DialogHeader>
                      <CreateSubjectForm levels={[level]} onSuccess={() => {}} />
                    </DialogContent>
                  </Dialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog({ id: level.id, type: "level", data: level })}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Level
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteLevel(level.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Level
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Subjects */}
              {expandedLevels.has(level.id) && (
                <div className="border-t">
                  {level.subjects.length === 0 ? (
                    <div className="p-4 pl-12 text-sm text-muted-foreground">
                      No subjects yet. Add your first subject.
                    </div>
                  ) : (
                    level.subjects.map((subject) => (
                      <div key={subject.id}>
                        {/* Subject Header */}
                        <div 
                          className="flex items-center justify-between p-2 pl-4 sm:p-3 sm:pl-8 border-b cursor-pointer hover:bg-muted/30 gap-2"
                          onClick={() => toggleSubject(subject.id)}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                            {expandedSubjects.has(subject.id) ? (
                              <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="text-lg sm:text-2xl flex-shrink-0">{subject.icon}</span>
                            <span className="font-medium text-sm sm:text-base truncate">{subject.name}</span>
                            <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                              {subject.topics.length}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                                  <Plus className="h-4 w-4 sm:mr-1" />
                                  <span className="hidden sm:inline">Add Topic</span>
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                  <DialogTitle>Add Topic to {subject.name}</DialogTitle>
                                </DialogHeader>
                                <CreateTopicForm subjects={[subject]} onSuccess={() => {}} />
                              </DialogContent>
                            </Dialog>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog({ id: subject.id, type: "subject", data: subject })}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Subject
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteSubject(subject.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Subject
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Topics */}
                        {expandedSubjects.has(subject.id) && (
                          <div>
                            {subject.topics.length === 0 ? (
                              <div className="p-3 pl-16 text-sm text-muted-foreground border-b">
                                No topics yet. Add your first topic.
                              </div>
                            ) : (
                              subject.topics.map((topic) => (
                                <div key={topic.id} className="border-b last:border-b-0">
                                  {/* Topic Header */}
                                  <div 
                                    className="flex items-center justify-between p-2 pl-6 sm:p-3 sm:pl-12 cursor-pointer hover:bg-muted/20 gap-2"
                                    onClick={() => toggleTopic(topic.id)}
                                  >
                                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                      {expandedTopics.has(topic.id) ? (
                                        <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                      )}
                                      <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                                      <span className="font-medium text-sm sm:text-base truncate">{topic.title}</span>
                                      <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                                        {topic.resources?.length || 0}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button variant="ghost" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                                            <Plus className="h-4 w-4 sm:mr-1" />
                                            <span className="hidden sm:inline">Add Resource</span>
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                          <DialogHeader>
                                            <DialogTitle>Add Resource to {topic.title}</DialogTitle>
                                          </DialogHeader>
                                          <CreateResourceForm subjects={[subject]} topics={[topic]} onSuccess={() => {}} />
                                        </DialogContent>
                                      </Dialog>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                          <Button variant="ghost" size="icon">
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => openEditDialog({ id: topic.id, type: "topic", data: topic })}>
                                            <Edit className="h-4 w-4 mr-2" />
                                            Edit Topic
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            className="text-destructive"
                                            onClick={() => handleDeleteTopic(topic.id)}
                                          >
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete Topic
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>

                                    {/* Resources */}
                                    {expandedTopics.has(topic.id) && (
                                      <div className="pl-8 sm:pl-16">
                                        {!topic.resources || topic.resources.length === 0 ? (
                                          <div className="p-1.5 sm:p-2 text-xs sm:text-sm text-muted-foreground">
                                            No resources yet.
                                          </div>
                                        ) : (
                                          topic.resources.map((resource) => (
                                          <div 
                                            key={resource.id}
                                            className="flex items-center justify-between p-1.5 sm:p-2 hover:bg-muted/20 rounded gap-2"
                                          >
                                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                              {resource.isLocked ? (
                                                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 flex-shrink-0" />
                                              ) : (
                                                <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                                              )}
                                              <span className="text-xs sm:text-sm truncate">{resource.title}</span>
                                              <span className="text-[10px] sm:text-xs text-muted-foreground capitalize flex-shrink-0 hidden sm:inline">
                                                ({resource.type})
                                              </span>
                                              {resource.isLocked && (
                                                <span className="text-[10px] sm:text-xs text-yellow-600 font-medium flex items-center gap-1 flex-shrink-0">
                                                  <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                  <span className="hidden sm:inline">Ksh </span>
                                                  <span className="sm:hidden">K</span>
                                                  {resource.unlockFee}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                                              <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="h-7 w-7 sm:h-9 sm:w-9"
                                                onClick={() => handleViewResource(resource)}
                                              >
                                                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 sm:h-9 sm:w-9"
                                                onClick={() => window.open(resource.url, "_blank")}
                                              >
                                                <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                              </Button>
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-9 sm:w-9">
                                                    <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onClick={() => handleViewResource(resource)}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem onClick={() => handleEditResource(resource)}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    className="text-destructive"
                                                    onClick={() => handleDeleteResource(resource.id)}
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          ))
          )}
        </TabsContent>

        <TabsContent value="institution" className="space-y-4 mt-6">
          {/* Search - Only show search in Institution tab */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={expandAll}>
                <ChevronDownSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Expand</span>
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={collapseAll}>
                <ChevronRightSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                <span className="hidden sm:inline">Collapse</span>
              </Button>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Institution Notice */}
          <div className="bg-primary/15 border border-primary/60 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Institution Content</p>
              <p className="text-sm text-foreground">
                This content is curated by platform administrators and is available to all users. These resources are read-only and form the foundation of the learning curriculum.
              </p>
            </div>
          </div>

          {/* Institution Tree */}
          {filteredInstitutionLevels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No institution content available yet</p>
                <p className="text-sm text-muted-foreground">
                  Institution content will appear here when platform administrators add resources
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredInstitutionLevels.map((level: LevelWithFullHierarchy) => (
              <Card key={level.id} className="overflow-hidden border-primary/60">
                {/* Level Header */}
                <div 
                  className="flex items-center justify-between p-2 sm:p-4 bg-primary/10 cursor-pointer hover:bg-primary/15 gap-2"
                  onClick={() => toggleLevel(level.id)}
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {expandedLevels.has(level.id) ? (
                      <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <div 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0"
                      style={{ backgroundColor: level.color }}
                    >
                      {level.levelNumber}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-base sm:text-lg truncate block">{level.title}</span>
                      <Badge variant="outline" className="mt-0.5 bg-primary text-primary-foreground border-primary/70 text-xs sm:ml-2 sm:mt-0">
                        Public
                      </Badge>
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                      {level.subjects.length}
                    </span>
                  </div>
                </div>

                {/* Subjects */}
                {expandedLevels.has(level.id) && (
                  <div className="border-t">
                    {level.subjects.length === 0 ? (
                      <div className="p-4 pl-12 text-sm text-muted-foreground">
                        No subjects available.
                      </div>
                    ) : (
                      level.subjects.map((subject: SubjectWithTopics) => (
                        <div key={subject.id}>
                          <div 
                            className="flex items-center justify-between p-2 pl-4 sm:p-3 sm:pl-8 border-b cursor-pointer hover:bg-primary/8 gap-2"
                            onClick={() => toggleSubject(subject.id)}
                          >
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                              {expandedSubjects.has(subject.id) ? (
                                <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="text-lg sm:text-2xl flex-shrink-0">{subject.icon}</span>
                              <span className="font-medium text-sm sm:text-base truncate">{subject.name}</span>
                              <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                                {subject.topics.length}
                              </span>
                            </div>
                          </div>

                          {/* Topics */}
                          {expandedSubjects.has(subject.id) && (
                            <div>
                              {subject.topics.length === 0 ? (
                                <div className="p-3 pl-20 text-sm text-muted-foreground border-b">
                                  No topics available.
                                </div>
                              ) : (
                                subject.topics.map((topic: TopicWithResources) => (
                                  <div key={topic.id} className="border-b last:border-b-0">
                                    <div 
                                      className="flex items-center justify-between p-2 pl-6 sm:p-3 sm:pl-12 cursor-pointer hover:bg-primary/6 gap-2"
                                      onClick={() => toggleTopic(topic.id)}
                                    >
                                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                        {expandedTopics.has(topic.id) ? (
                                          <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                        )}
                                        <FolderOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                                        <span className="font-medium text-sm sm:text-base truncate">{topic.title}</span>
                                        <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                                          {topic.resources?.length || 0}
                                        </span>
                                      </div>
                                    </div>

                                      {/* Resources */}
                                      {expandedTopics.has(topic.id) && (
                                        <div className="pl-8 sm:pl-16">
                                          {!topic.resources || topic.resources.length === 0 ? (
                                            <div className="p-1.5 sm:p-2 text-xs sm:text-sm text-muted-foreground">
                                              No resources available.
                                            </div>
                                          ) : (
                                            topic.resources.map((resource: Resource) => {
                                              // Check unlock status: context takes priority, then API field, then isLocked
                                              const contextUnlocked = isResourceUnlocked(resource.id);
                                              const hasUnlockStatus = 'isUnlocked' in resource;
                                              const isUnlocked = contextUnlocked || 
                                                (hasUnlockStatus && (resource as ResourceWithUnlockStatus).isUnlocked) || 
                                                !resource.isLocked;
                                              return (
                                                <div 
                                                  key={resource.id}
                                                  className="flex items-center justify-between p-1.5 sm:p-2 hover:bg-primary/5 rounded gap-2"
                                                >
                                                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                                    {resource.isLocked ? (
                                                      <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 flex-shrink-0" />
                                                    ) : (
                                                      <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                                                    )}
                                                    <span className="text-xs sm:text-sm truncate">{resource.title}</span>
                                                    <span className="text-[10px] sm:text-xs text-muted-foreground capitalize flex-shrink-0 hidden sm:inline">
                                                      ({resource.type})
                                                    </span>
                                                    {resource.isLocked && (
                                                      <span className="text-[10px] sm:text-xs text-yellow-600 font-medium flex items-center gap-1 flex-shrink-0">
                                                        <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                        <span className="hidden sm:inline">Ksh </span>
                                                        <span className="sm:hidden">K</span>
                                                        {resource.unlockFee}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {resource.isLocked && !isUnlocked ? (
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
                                                          className="h-7 w-7 sm:h-9 sm:w-auto sm:px-3 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10"
                                                        >
                                                          <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                                                          <span className="hidden sm:inline">Unlock</span>
                                                        </Button>
                                                      }
                                                      onUnlockSuccess={() => {
                                                        addUnlockedResource(resource.id);
                                                      }}
                                                    />
                                                  ) : (
                                                    <Button 
                                                      variant="ghost" 
                                                      size="icon"
                                                      className="h-7 w-7 sm:h-9 sm:w-9"
                                                      onClick={() => handleViewResource(resource)}
                                                    >
                                                      <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                    </Button>
                                                  )}
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {itemToDelete?.type} &ldquo;{itemToDelete?.name}&rdquo;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setItemToDelete(null); setDeleteCallback(null); }}>
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
              levels={levels}
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
                subjects={allSubjects.map(s => ({ id: s.id, name: s.name, level: { id: s.levelId, title: "Level" } }))}
                topics={allTopics.map(t => ({ id: t.id, title: t.title, subjectId: t.subjectId }))}
                onSuccess={handleEditSuccess}
                onCancel={() => setIsEditDialogOpen(false)}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
