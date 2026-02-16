"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUnlockedResources } from "@/components/credits/unlocked-resources-context";
import {
  Crown,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  Trash2,
  Gift,
  Unlock,
  Lock,
  DollarSign,
  User,
  Shield,
  Building2,
  MoreVertical,
  Edit,
  ExternalLink,
  Eye,
  Library,
  ChevronDownSquare,
  ChevronRightSquare,
  FolderOpen,
  CreditCard,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CreateLevelForm } from "@/components/admin/create-level-form";
import { CreateSubjectForm } from "@/components/admin/create-subject-form";
import { CreateTopicForm } from "@/components/admin/create-topic-form";
import { CreateResourceForm } from "@/components/admin/create-resource-form";
import { EditLevelForm } from "@/components/admin/edit-level-form";
import { EditSubjectForm } from "@/components/admin/edit-subject-form";
import { EditTopicForm } from "@/components/admin/edit-topic-form";
import { EditResourceForm } from "@/components/admin/edit-resource-form";
import {
  deleteLevelWithSession,
  deleteSubjectWithSession,
  deleteTopicWithSession,
  deleteResource,
  SystemStats,
  getResourceById,
} from "@/lib/actions/admin";
import { ResourceViewer, ResourceViewerSkeleton } from "@/components/admin/resource-viewer";
import type {
  LevelWithFullHierarchy,
  SubjectWithTopics,
  TopicWithResources,
  Resource,
  ResourceWithRelations,
  User as UserType,
  Level,
  Subject,
  Topic,
} from "@/lib/types";
import Link from "next/link";

interface SuperAdminDashboardClientProps {
  initialLevels: LevelWithFullHierarchy[];
  initialUsers: UserType[];
  initialStats: SystemStats;
  currentUserId: string;
}

export function SuperAdminDashboardClient({
  initialLevels,
  initialUsers,
  initialStats,
  currentUserId,
}: SuperAdminDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isResourceUnlocked } = useUnlockedResources();
  const [levels, setLevels] = useState<LevelWithFullHierarchy[]>(initialLevels);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("super");
  const [revenueStats, setRevenueStats] = useState({
    totalRevenue: 0,
    totalPurchases: 0,
    completedPurchases: 0,
  });

  // Sync levels when initialLevels changes (after revalidation)
  useEffect(() => {
    setLevels(initialLevels);
  }, [initialLevels]);

  // Dialog states
  const [isCreateLevelOpen, setIsCreateLevelOpen] = useState(false);
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCallback, setDeleteCallback] = useState<(() => Promise<void>) | null>(null);

  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<{ id: string; type: string; data: unknown } | null>(null);
  const [isLoadingEditResource, setIsLoadingEditResource] = useState(false);

  // Resource viewer state
  const [selectedResource, setSelectedResource] = useState<ResourceWithRelations | null>(null);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [openResourceInEditMode, setOpenResourceInEditMode] = useState(false);

  // Expansion states
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // Load revenue stats
  useEffect(() => {
    const loadRevenueStats = async () => {
      try {
        const response = await fetch("/api/admin/revenue-stats");
        if (response.ok) {
          const data = await response.json();
          setRevenueStats(data);
        }
      } catch (error) {
        console.error("Failed to load revenue stats:", error);
      }
    };
    loadRevenueStats();
  }, []);

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

  // Separate content by owner role
  // Public tab: only show content owned by current super-admin
  const superAdminLevels = useMemo(() =>
    levels.filter((g) => g.ownerRole === "super_admin" && g.ownerId === currentUserId),
    [levels, currentUserId]
  );

  // Helper function to get owner name from user ID
  const getOwnerName = useMemo(() => {
    const userMap = new Map(initialUsers.map(u => [u.id, u.name || u.email || "Unknown"]));
    return (ownerId: string | null) => {
      if (!ownerId) return "Unknown";
      return userMap.get(ownerId) || "Unknown";
    };
  }, [initialUsers]);
  
  const adminLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "admin"),
    [levels]
  );

  const regularLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "regular"),
    [levels]
  );

  // Stats calculation
  const superAdminStats = useMemo(() => {
    const subjects = superAdminLevels.flatMap((g) => g.subjects || []);
    const topics = subjects.flatMap((s) => s.topics || []);
    const resources = topics.flatMap((t) => t.resources || []);
    return {
      levels: superAdminLevels.length,
      subjects: subjects.length,
      topics: topics.length,
      resources: resources.length,
    };
  }, [superAdminLevels]);

  const adminStats = useMemo(() => {
    const subjects = adminLevels.flatMap((g) => g.subjects || []);
    const topics = subjects.flatMap((s) => s.topics || []);
    const resources = topics.flatMap((t) => t.resources || []);
    return {
      levels: adminLevels.length,
      subjects: subjects.length,
      topics: topics.length,
      resources: resources.length,
    };
  }, [adminLevels]);

  const regularStats = useMemo(() => {
    const subjects = regularLevels.flatMap((g) => g.subjects || []);
    const topics = subjects.flatMap((s) => s.topics || []);
    const resources = topics.flatMap((t) => t.resources || []);
    return {
      levels: regularLevels.length,
      subjects: subjects.length,
      topics: topics.length,
      resources: resources.length,
    };
  }, [regularLevels]);

  // Get all subjects and topics for forms
  const allSubjects = useMemo(() => levels.flatMap((g) => g.subjects || []), [levels]);
  const allTopics = useMemo(() => allSubjects.flatMap((s) => s.topics || []), [allSubjects]);

  // Filter content owned by current super-admin for Add buttons
  const ownedLevels = useMemo(() =>
    levels.filter((g) => g.ownerId === currentUserId),
    [levels, currentUserId]
  );

  // Subjects that can have topics added to them - must be in an owned level
  const ownedSubjects = useMemo(() =>
    ownedLevels.flatMap((g) => g.subjects || []),
    [ownedLevels]
  );

  // Topics that can have resources added to them - must be in an owned subject chain
  const ownedTopics = useMemo(() =>
    ownedSubjects.flatMap((s) => s.topics || []),
    [ownedSubjects]
  );

  // Filter levels based on search
  const filterLevels = (levelsToFilter: LevelWithFullHierarchy[]) => {
    if (!searchQuery) return levelsToFilter;
    const query = searchQuery.toLowerCase();
    return levelsToFilter.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects?.some((s: SubjectWithTopics) => 
        s.name.toLowerCase().includes(query) ||
        s.topics?.some((t: TopicWithResources) => 
          t.title.toLowerCase().includes(query)
        )
      )
    );
  };

  const filteredSuperAdminLevels = filterLevels(superAdminLevels);
  const filteredAdminLevels = filterLevels(adminLevels);
  const filteredRegularLevels = filterLevels(regularLevels);

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
    const allLevelIds = levels.map((g) => g.id);
    const allSubjectIds = levels.flatMap((g) => g.subjects?.map((s) => s.id) || []);
    const allTopicIds = levels.flatMap((g) => 
      g.subjects?.flatMap((s) => s.topics?.map((t) => t.id) || []) || []
    );
    setExpandedLevels(new Set(allLevelIds));
    setExpandedSubjects(new Set(allSubjectIds));
    setExpandedTopics(new Set(allTopicIds));
  };

  const collapseAll = () => {
    setExpandedLevels(new Set());
    setExpandedSubjects(new Set());
    setExpandedTopics(new Set());
  };

  const getItemName = (id: string, type: string): string => {
    switch (type) {
      case "level": {
        const level = levels.find(g => g.id === id);
        return level?.title || "Unknown Level";
      }
      case "subject": {
        const subjects = levels.flatMap(g => g.subjects || []);
        const subject = subjects.find(s => s.id === id);
        return subject?.name || "Unknown Subject";
      }
      case "topic": {
        const subjects = levels.flatMap(g => g.subjects || []);
        const topics = subjects.flatMap(s => s.topics || []);
        const topic = topics.find(t => t.id === id);
        return topic?.title || "Unknown Topic";
      }
      case "resource": {
        const subjects = levels.flatMap(g => g.subjects || []);
        const topics = subjects.flatMap(s => s.topics || []);
        const resources = topics.flatMap(t => t.resources || []);
        const resource = resources.find(r => r.id === id);
        return resource?.title || "Unknown Resource";
      }
      default:
        return "Unknown Item";
    }
  };

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

  const handleCreateSuccess = () => {
    setIsCreateLevelOpen(false);
    setIsCreateSubjectOpen(false);
    setIsCreateTopicOpen(false);
    setIsCreateResourceOpen(false);
    router.refresh();
  };

  const handleBackFromViewer = () => {
    setSelectedResource(null);
    setOpenResourceInEditMode(false);
  };

  const handleDeleteLevel = async (levelId: string) => {
    openDeleteDialog(levelId, "level", async () => {
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
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Super Admin Dashboard
            </h2>
            <p className="text-muted-foreground">
              System-wide management and configuration
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Super Admin Content Card */}
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === "super" && "ring-2 ring-purple-500 ring-offset-2"
          )}
          onClick={() => setActiveTab("super")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              Public Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{superAdminStats.levels}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {superAdminStats.subjects} subjects, {superAdminStats.resources} resources
            </p>
            <p className="text-xs text-purple-600 mt-1">
              {activeTab === "super" ? "Currently viewing" : "Click to view"}
            </p>
          </CardContent>
        </Card>

        {/* Admin Content Card */}
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === "admin" && "ring-2 ring-blue-500 ring-offset-2"
          )}
          onClick={() => setActiveTab("admin")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              Admin Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminStats.levels}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {adminStats.subjects} subjects, {adminStats.resources} resources
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {activeTab === "admin" ? "Currently viewing" : "Click to view"}
            </p>
          </CardContent>
        </Card>

        {/* Regular Users Content Card */}
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === "regular" && "ring-2 ring-green-500 ring-offset-2"
          )}
          onClick={() => setActiveTab("regular")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-green-500" />
              Regular User Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regularStats.levels}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {regularStats.subjects} subjects, {regularStats.resources} resources
            </p>
            <p className="text-xs text-green-600 mt-1">
              {activeTab === "regular" ? "Currently viewing" : "Click to view"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Overview Stats */}
      <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="hidden sm:inline">Total Users</span>
              <span className="sm:hidden">Users</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{initialStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {initialStats.totalRegulars} regulars, {initialStats.totalAdmins} admins
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-green-500" />
              Levels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{initialStats.totalLevels}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-amber-500" />
              Subjects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{initialStats.totalSubjects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-500" />
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{initialStats.totalResources}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2 text-green-700">
              <DollarSign className="h-4 w-4 text-green-600" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-700">Ksh {revenueStats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-green-600">
              {revenueStats.completedPurchases} completed purchases
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <TooltipProvider>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="super" className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-500" />
            Public
            <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-800">{superAdminStats.levels}</Badge>
          </TabsTrigger>
          <TabsTrigger value="admin" className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Admin
            <Badge variant="secondary" className="ml-1 bg-blue-100 text-blue-800">{adminStats.levels}</Badge>
          </TabsTrigger>
          <TabsTrigger value="regular" className="flex items-center gap-2">
            <User className="h-4 w-4 text-green-500" />
            Regular
            <Badge variant="secondary" className="ml-1 bg-green-100 text-green-800">{regularStats.levels}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Quick Actions & Search - Only show Add buttons on Public tab */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mt-6">
          <div className="flex flex-wrap gap-2">
            {activeTab === "super" && (
              <>
                <Dialog open={isCreateLevelOpen} onOpenChange={setIsCreateLevelOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-9 sm:h-10 gap-1.5">
                      <Plus className="h-4 w-4" />
                      <span>Add Level</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Create New Level</DialogTitle>
                    </DialogHeader>
                    <CreateLevelForm onSuccess={handleCreateSuccess} />
                  </DialogContent>
                </Dialog>
                {ownedLevels.length > 0 ? (
                  <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5">
                        <Plus className="h-4 w-4" />
                        <span>Add Subject</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Create New Subject</DialogTitle>
                      </DialogHeader>
                      <CreateSubjectForm levels={ownedLevels} onSuccess={handleCreateSuccess} />
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5" disabled>
                        <Plus className="h-4 w-4" />
                        <span>Add Subject</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Create a level first</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {ownedSubjects.length > 0 ? (
                  <Dialog open={isCreateTopicOpen} onOpenChange={setIsCreateTopicOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5">
                        <Plus className="h-4 w-4" />
                        <span>Add Topic</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Create New Topic</DialogTitle>
                      </DialogHeader>
                      <CreateTopicForm subjects={ownedSubjects} onSuccess={handleCreateSuccess} />
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5" disabled>
                        <Plus className="h-4 w-4" />
                        <span>Add Topic</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Create a subject first</p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {ownedTopics.length > 0 ? (
                  <Dialog open={isCreateResourceOpen} onOpenChange={setIsCreateResourceOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5">
                        <Plus className="h-4 w-4" />
                        <span>Add Resource</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>Create New Resource</DialogTitle>
                      </DialogHeader>
                      <CreateResourceForm subjects={ownedSubjects} topics={ownedTopics} onSuccess={handleCreateSuccess} />
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5" disabled>
                        <Plus className="h-4 w-4" />
                        <span>Add Resource</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Create a topic first</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
            <Button variant="outline" size="sm" onClick={expandAll} className="h-9 sm:h-10 gap-1.5">
              <ChevronDownSquare className="h-4 w-4" />
              <span>Expand</span>
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll} className="h-9 sm:h-10 gap-1.5">
              <ChevronRightSquare className="h-4 w-4" />
              <span>Collapse</span>
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

        {/* Public Content Tab */}
        <TabsContent value="super" className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-medium text-purple-800">Public Platform Content</p>
              <p className="text-sm text-purple-700">
                Content created by super admins is visible to all users. This forms the foundation of the learning curriculum.
              </p>
            </div>
          </div>

          {filteredSuperAdminLevels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No public content yet</p>
                <p className="text-sm text-muted-foreground">
                  Create levels, subjects, and resources that will be available to all users
                </p>
                <Button className="mt-4" onClick={() => setIsCreateLevelOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Level
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredSuperAdminLevels.map((level: LevelWithFullHierarchy) => (
              <Card key={level.id} className="overflow-hidden border-purple-200">
                {/* Level Header */}
                <div 
                  className="flex items-center justify-between p-4 bg-purple-50/50 cursor-pointer hover:bg-purple-50"
                  onClick={() => toggleLevel(level.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedLevels.has(level.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: level.color }}
                    >
                      {level.levelNumber}
                    </div>
                    <div>
                      <span className="font-semibold text-lg">{level.title}</span>
                      <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800 border-purple-300">
                        Public
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({level.subjects?.length || 0} subjects)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {level.ownerId === currentUserId ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Subject
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Add Subject to {level.title}</DialogTitle>
                          </DialogHeader>
                          <CreateSubjectForm levels={[level]} onSuccess={handleCreateSuccess} />
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" disabled onClick={(e) => e.stopPropagation()}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Subject
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>You don't own this level</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog({ id: level.id, type: "level", data: level ?? null })}>
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
                    {level.subjects?.length === 0 ? (
                      <div className="p-4 pl-12 text-sm text-muted-foreground">
                        No subjects yet. Add your first subject.
                      </div>
                    ) : (
                      level.subjects?.map((subject: SubjectWithTopics) => (
                        <div key={subject.id}>
                          {/* Subject Header */}
                          <div 
                            className="flex items-center justify-between p-3 pl-8 border-b cursor-pointer hover:bg-purple-50/30"
                            onClick={() => toggleSubject(subject.id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedSubjects.has(subject.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-2xl">{subject.icon}</span>
                              <span className="font-medium">{subject.name}</span>
                              <span className="text-sm text-muted-foreground">
                                ({subject.topics?.length || 0} topics)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {subject.ownerId === currentUserId ? (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add Topic
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                      <DialogTitle>Add Topic to {subject.name}</DialogTitle>
                                    </DialogHeader>
                                    <CreateTopicForm subjects={[subject]} onSuccess={handleCreateSuccess} />
                                  </DialogContent>
                                </Dialog>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" disabled onClick={(e) => e.stopPropagation()}>
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add Topic
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>You don't own this subject</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
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
                              {subject.topics?.length === 0 ? (
                                <div className="p-3 pl-16 text-sm text-muted-foreground border-b">
                                  No topics yet. Add your first topic.
                                </div>
                              ) : (
                                subject.topics?.map((topic: TopicWithResources) => (
                                  <div key={topic.id} className="border-b last:border-b-0">
                                    {/* Topic Header */}
                                    <div 
                                      className="flex items-center justify-between p-3 pl-12 cursor-pointer hover:bg-purple-50/20"
                                      onClick={() => toggleTopic(topic.id)}
                                    >
                            <div className="flex items-center gap-3">
                              {expandedSubjects.has(subject.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-2xl">{subject.icon}</span>
                              <span className="font-medium">{subject.name}</span>
                              {subject.ownerId && (
                                <Badge variant="outline" className="ml-1 bg-blue-50 text-blue-600 border-blue-200 text-xs">
                                  <User className="h-3 w-3 mr-1" />
                                  {getOwnerName(subject.ownerId)}
                                </Badge>
                              )}
                              <span className="text-sm text-muted-foreground">
                                ({subject.topics?.length || 0} topics)
                              </span>
                            </div>
                                      <div className="flex items-center gap-2">
                                        {topic.ownerId === currentUserId ? (
                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add Resource
                                              </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-[425px]">
                                              <DialogHeader>
                                                <DialogTitle>Add Resource to {topic.title}</DialogTitle>
                                              </DialogHeader>
                                              <CreateResourceForm subjects={[subject]} topics={[topic]} onSuccess={handleCreateSuccess} />
                                            </DialogContent>
                                          </Dialog>
                                        ) : (
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button variant="ghost" size="sm" disabled onClick={(e) => e.stopPropagation()}>
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add Resource
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>You don't own this topic</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        )}
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
                                      <div className="pl-16">
                                        {topic.resources?.length === 0 ? (
                                          <div className="p-2 text-sm text-muted-foreground">
                                            No resources yet.
                                          </div>
                                        ) : (
                                          topic.resources?.map((resource: Resource) => {
                                            const contextUnlocked = isResourceUnlocked(resource.id);
                                            const isUnlocked = contextUnlocked || !resource.isLocked;
                                            return (
                                            <div 
                                              key={resource.id}
                                              className="flex items-center justify-between p-2 hover:bg-purple-50/10 rounded"
                                            >
                                              <div className="flex items-center gap-3">
                                                {isUnlocked ? (
                                                  <Unlock className="h-4 w-4 text-green-600" />
                                                ) : (
                                                  <Lock className="h-4 w-4 text-yellow-600" />
                                                )}
                                                <span className="text-sm">{resource.title}</span>
                                                <span className="text-xs text-muted-foreground capitalize">
                                                  ({resource.type})
                                                </span>
                                                {!isUnlocked && resource.isLocked && (
                                                  <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                                                    <CreditCard className="h-3 w-3" />
                                                    Ksh {resource.unlockFee}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm"
                                                  onClick={() => handleViewResource(resource)}
                                                >
                                                  <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => window.open(resource.url, "_blank")}
                                                >
                                                  <ExternalLink className="h-4 w-4" />
                                                </Button>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                      <MoreVertical className="h-4 w-4" />
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

        {/* Admin Content Tab */}
        <TabsContent value="admin" className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">Admin Content</p>
              <p className="text-sm text-blue-700">
                Content created by admin users for their institutions. You can view and manage all admin content.
              </p>
            </div>
          </div>

          {filteredAdminLevels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No admin content yet</p>
                <p className="text-sm text-muted-foreground">
                  Admins will create content for their institutions
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAdminLevels.map((level: LevelWithFullHierarchy) => (
              <Card key={level.id} className="overflow-hidden border-blue-200">
                {/* Level Header */}
                <div 
                  className="flex items-center justify-between p-4 bg-blue-50/50 cursor-pointer hover:bg-blue-50"
                  onClick={() => toggleLevel(level.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedLevels.has(level.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: level.color }}
                    >
                      {level.levelNumber}
                    </div>
                    <div>
                      <span className="font-semibold text-lg">{level.title}</span>
                      <Badge variant="outline" className="ml-2 bg-blue-100 text-blue-800 border-blue-300">
                        Admin
                      </Badge>
                      {level.ownerId && (
                        <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600 border-blue-200">
                          <User className="h-3 w-3 mr-1" />
                          {getOwnerName(level.ownerId)}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({level.subjects?.length || 0} subjects)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog({ id: level.id, type: "level", data: level ?? null })}>
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
                    {level.subjects?.length === 0 ? (
                      <div className="p-4 pl-12 text-sm text-muted-foreground">
                        No subjects yet.
                      </div>
                    ) : (
                      level.subjects?.map((subject: SubjectWithTopics) => (
                        <div key={subject.id}>
                          {/* Subject Header */}
                          <div 
                            className="flex items-center justify-between p-3 pl-8 border-b cursor-pointer hover:bg-blue-50/30"
                            onClick={() => toggleSubject(subject.id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedSubjects.has(subject.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-2xl">{subject.icon}</span>
                              <span className="font-medium">{subject.name}</span>
                              <span className="text-sm text-muted-foreground">
                                ({subject.topics?.length || 0} topics)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
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
                              {subject.topics?.length === 0 ? (
                                <div className="p-3 pl-16 text-sm text-muted-foreground border-b">
                                  No topics available.
                                </div>
                              ) : (
                                subject.topics?.map((topic: TopicWithResources) => (
                                  <div key={topic.id} className="border-b last:border-b-0">
                                    {/* Topic Header */}
                                    <div 
                                      className="flex items-center justify-between p-3 pl-12 cursor-pointer hover:bg-blue-50/20"
                                      onClick={() => toggleTopic(topic.id)}
                                    >
                            <div className="flex items-center gap-3">
                              {expandedSubjects.has(subject.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-2xl">{subject.icon}</span>
                              <span className="font-medium">{subject.name}</span>
                              {subject.ownerId && (
                                <Badge variant="outline" className="ml-1 bg-green-50 text-green-600 border-green-200 text-xs">
                                  <User className="h-3 w-3 mr-1" />
                                  {getOwnerName(subject.ownerId)}
                                </Badge>
                              )}
                              <span className="text-sm text-muted-foreground">
                                ({subject.topics?.length || 0} topics)
                              </span>
                            </div>
                                      <div className="flex items-center gap-2">
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
                                      <div className="pl-16">
                                        {topic.resources?.length === 0 ? (
                                          <div className="p-2 text-sm text-muted-foreground">
                                            No resources available.
                                          </div>
                                        ) : (
                                          topic.resources?.map((resource: Resource) => {
                                            const contextUnlocked = isResourceUnlocked(resource.id);
                                            const isUnlocked = contextUnlocked || !resource.isLocked;
                                            return (
                                            <div 
                                              key={resource.id}
                                              className="flex items-center justify-between p-2 hover:bg-blue-50/10 rounded"
                                            >
                                              <div className="flex items-center gap-3">
                                                {isUnlocked ? (
                                                  <Unlock className="h-4 w-4 text-green-600" />
                                                ) : (
                                                  <Lock className="h-4 w-4 text-yellow-600" />
                                                )}
                                                <span className="text-sm">{resource.title}</span>
                                                <span className="text-xs text-muted-foreground capitalize">
                                                  ({resource.type})
                                                </span>
                                                {!isUnlocked && resource.isLocked && (
                                                  <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                                                    <CreditCard className="h-3 w-3" />
                                                    Ksh {resource.unlockFee}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm"
                                                  onClick={() => handleViewResource(resource)}
                                                >
                                                  <Eye className="h-4 w-4" />
                                                </Button>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                      <MoreVertical className="h-4 w-4" />
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

        {/* Regular User Content Tab */}
        <TabsContent value="regular" className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <User className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Regular User Content</p>
              <p className="text-sm text-green-700">
                Personal content created by regular users. You can view and manage all user content.
              </p>
            </div>
          </div>

          {filteredRegularLevels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No regular user content yet</p>
                <p className="text-sm text-muted-foreground">
                  Regular users will create their personal content
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredRegularLevels.map((level: LevelWithFullHierarchy) => (
              <Card key={level.id} className="overflow-hidden border-green-200">
                {/* Level Header */}
                <div 
                  className="flex items-center justify-between p-4 bg-green-50/50 cursor-pointer hover:bg-green-50"
                  onClick={() => toggleLevel(level.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedLevels.has(level.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: level.color }}
                    >
                      {level.levelNumber}
                    </div>
                    <div>
                      <span className="font-semibold text-lg">{level.title}</span>
                      <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 border-green-300">
                        Regular
                      </Badge>
                      {level.ownerId && (
                        <Badge variant="outline" className="ml-2 bg-green-50 text-green-600 border-green-200">
                          <User className="h-3 w-3 mr-1" />
                          {getOwnerName(level.ownerId)}
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({level.subjects?.length || 0} subjects)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog({ id: level.id, type: "level", data: level ?? null })}>
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
                    {level.subjects?.length === 0 ? (
                      <div className="p-4 pl-12 text-sm text-muted-foreground">
                        No subjects yet.
                      </div>
                    ) : (
                      level.subjects?.map((subject: SubjectWithTopics) => (
                        <div key={subject.id}>
                          {/* Subject Header */}
                          <div 
                            className="flex items-center justify-between p-3 pl-8 border-b cursor-pointer hover:bg-green-50/30"
                            onClick={() => toggleSubject(subject.id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedSubjects.has(subject.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-2xl">{subject.icon}</span>
                              <span className="font-medium">{subject.name}</span>
                              <span className="text-sm text-muted-foreground">
                                ({subject.topics?.length || 0} topics)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
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
                              {subject.topics?.length === 0 ? (
                                <div className="p-3 pl-16 text-sm text-muted-foreground border-b">
                                  No topics available.
                                </div>
                              ) : (
                                subject.topics?.map((topic: TopicWithResources) => (
                                  <div key={topic.id} className="border-b last:border-b-0">
                                    {/* Topic Header */}
                                    <div 
                                      className="flex items-center justify-between p-3 pl-12 cursor-pointer hover:bg-green-50/20"
                                      onClick={() => toggleTopic(topic.id)}
                                    >
                                      <div className="flex items-center gap-3">
                                        {expandedTopics.has(topic.id) ? (
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <FolderOpen className="h-4 w-4 text-green-500" />
                                        <span className="font-medium">{topic.title}</span>
                                        <span className="text-sm text-muted-foreground">
                                          ({topic.resources?.length || 0} resources)
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
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
                                      <div className="pl-16">
                                        {topic.resources?.length === 0 ? (
                                          <div className="p-2 text-sm text-muted-foreground">
                                            No resources available.
                                          </div>
                                        ) : (
                                          topic.resources?.map((resource: Resource) => {
                                            const contextUnlocked = isResourceUnlocked(resource.id);
                                            const isUnlocked = contextUnlocked || !resource.isLocked;
                                            return (
                                            <div 
                                              key={resource.id}
                                              className="flex items-center justify-between p-2 hover:bg-green-50/10 rounded"
                                            >
                                              <div className="flex items-center gap-3">
                                                {isUnlocked ? (
                                                  <Unlock className="h-4 w-4 text-green-600" />
                                                ) : (
                                                  <Lock className="h-4 w-4 text-yellow-600" />
                                                )}
                                                <span className="text-sm">{resource.title}</span>
                                                <span className="text-xs text-muted-foreground capitalize">
                                                  ({resource.type})
                                                </span>
                                                {!isUnlocked && resource.isLocked && (
                                                  <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                                                    <CreditCard className="h-3 w-3" />
                                                    Ksh {resource.unlockFee}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <Button 
                                                  variant="ghost" 
                                                  size="sm"
                                                  onClick={() => handleViewResource(resource)}
                                                >
                                                  <Eye className="h-4 w-4" />
                                                </Button>
                                                <DropdownMenu>
                                                  <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                      <MoreVertical className="h-4 w-4" />
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
      </TooltipProvider>
    </div>
  );
}


