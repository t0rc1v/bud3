"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUnlockedResources } from "@/components/credits/unlocked-resources-context";
import {
  Crown,
  Download,
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
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
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
import { ContentTabCard } from "@/components/shared/content-tab-card";
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
  SystemStats,
  getResourceById,
  getSuperAdminAdminIds,
  getSuperAdminRegularIds,
} from "@/lib/actions/admin";
import { ResourceViewer, ResourceViewerSkeleton } from "@/components/resources/resource-viewer";
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
  
  // State for tracking admins and regulars managed by this super-admin
  const [myAdminIds, setMyAdminIds] = useState<string[]>([]);
  const [myRegularIds, setMyRegularIds] = useState<string[]>([]);
  
  // Fetch admins and regulars managed by this super-admin
  useEffect(() => {
    const fetchMyUsers = async () => {
      const adminIds = await getSuperAdminAdminIds(currentUserId);
      const regularIds = await getSuperAdminRegularIds(currentUserId);
      setMyAdminIds(adminIds);
      setMyRegularIds(regularIds);
    };
    fetchMyUsers();
  }, [currentUserId]);

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
  // My Content tab: only show content owned by current super-admin
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

  // Helper function to get owner email from user ID
  const getOwnerEmail = useMemo(() => {
    const emailMap = new Map(initialUsers.map(u => [u.id, u.email || "Unknown"]));
    return (ownerId: string | null) => {
      if (!ownerId) return "Unknown";
      return emailMap.get(ownerId) || "Unknown";
    };
  }, [initialUsers]);
  
  // My Admins Content: content owned by admins under this super-admin
  const adminLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "admin" && myAdminIds.includes(g.ownerId || "")),
    [levels, myAdminIds]
  );

  // My Regulars Content: content owned by regulars under this super-admin
  const regularLevels = useMemo(() => 
    levels.filter((g) => g.ownerRole === "regular" && myRegularIds.includes(g.ownerId || "")),
    [levels, myRegularIds]
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
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
          <Button variant="outline" size="sm" onClick={() => window.open("/api/admin/content/export", "_blank")}>
            <Download className="h-4 w-4 mr-2" />
            Export Content
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <ContentTabCard
          icon={Shield}
          label="My Content"
          levelCount={superAdminStats.levels}
          subjectCount={superAdminStats.subjects}
          resourceCount={superAdminStats.resources}
          isActive={activeTab === "super"}
          onClick={() => setActiveTab("super")}
        />
        <ContentTabCard
          icon={Building2}
          label="My Admins"
          levelCount={adminStats.levels}
          subjectCount={adminStats.subjects}
          resourceCount={adminStats.resources}
          isActive={activeTab === "admin"}
          onClick={() => setActiveTab("admin")}
        />
        <ContentTabCard
          icon={User}
          label="My Regulars"
          levelCount={regularStats.levels}
          subjectCount={regularStats.subjects}
          resourceCount={regularStats.resources}
          isActive={activeTab === "regular"}
          onClick={() => setActiveTab("regular")}
        />
      </div>

      {/* System Overview Stats */}
      <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="inline">Total Users</span>
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
              <GraduationCap className="h-4 w-4 text-primary" />
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
              <BookOpen className="h-4 w-4 text-primary" />
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
              <FileText className="h-4 w-4 text-primary" />
              Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold">{initialStats.totalResources}</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/15 border-primary/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2 text-foreground">
              <DollarSign className="h-4 w-4 text-foreground" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Ksh {revenueStats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-foreground">
              {revenueStats.completedPurchases} completed purchases
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <TooltipProvider>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="super" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-xs sm:text-sm whitespace-nowrap">My Content</span>
            <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground text-xs inline">{superAdminStats.levels}</Badge>
          </TabsTrigger>
          <TabsTrigger value="admin" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-xs sm:text-sm whitespace-nowrap">My Admins</span>
            <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground text-xs inline">{adminStats.levels}</Badge>
          </TabsTrigger>
          <TabsTrigger value="regular" className="flex items-center gap-1 sm:gap-2 px-1 sm:px-3">
            <User className="h-4 w-4 text-primary" />
            <span className="text-xs sm:text-sm whitespace-nowrap">My Regulars</span>
            <Badge variant="secondary" className="ml-1 bg-primary text-primary-foreground text-xs inline">{regularStats.levels}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Quick Actions & Search - Only show Add buttons on My Content tab */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between mt-6">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {activeTab === "super" && (
              <>
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
                    <CreateLevelForm onSuccess={handleCreateSuccess} />
                  </DialogContent>
                </Dialog>
                {ownedLevels.length > 0 ? (
                  <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1">
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">Add Subject</span>
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
                      <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1" disabled>
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">Add Subject</span>
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
                      <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1">
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">Add Topic</span>
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
                      <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1" disabled>
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">Add Topic</span>
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
                      <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1">
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">Add Resource</span>
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
                      <Button variant="outline" size="sm" className="h-8 sm:h-9 sm:h-10 gap-1" disabled>
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">Add Resource</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Create a topic first</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
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

        {/* My Content Tab */}
        <TabsContent value="super" className="space-y-4">
          <div className="bg-primary/15 border border-primary/60 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">My Content</p>
              <p className="text-sm text-foreground">
                Your own content is visible to users you manage. This forms the foundation of your institution's learning curriculum.
              </p>
            </div>
          </div>

          {filteredSuperAdminLevels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No content yet</p>
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
                        My Content
                      </Badge>
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                      {level.subjects?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                    {level.ownerId === currentUserId ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                            <Plus className="h-4 w-4 sm:mr-1" />
                            {/* <span className="inline">Add Subject</span> */}
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
                          <Button variant="outline" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" disabled onClick={(e) => e.stopPropagation()}>
                            <Plus className="h-4 w-4" />
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
                                {subject.topics?.length || 0}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                              {subject.ownerId === currentUserId ? (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                                      <Plus className="h-4 w-4 sm:mr-1" />
                                      {/* <span className="inline">Add Topic</span> */}
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
                                    <Button variant="ghost" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" disabled onClick={(e) => e.stopPropagation()}>
                                      <Plus className="h-4 w-4" />
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
                              {topic.ownerId && (
                                <Badge variant="outline" className="ml-1 bg-primary/15 text-foreground border-primary/60 text-xs flex-shrink-0">
                                  <User className="h-3 w-3 mr-1" />
                                  <span className="inline">{getOwnerName(topic.ownerId)}</span>
                                </Badge>
                              )}
                              <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                                {topic.resources?.length || 0}
                              </span>
                            </div>
                                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                                        {topic.ownerId === currentUserId ? (
                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <Button variant="ghost" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" onClick={(e) => e.stopPropagation()}>
                                                <Plus className="h-4 w-4 sm:mr-1" />
                                                {/* <span className="inline">Add Resource</span> */}
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
                                              <Button variant="ghost" size="icon" className="sm:h-9 sm:w-auto sm:px-3 sm:py-2" disabled onClick={(e) => e.stopPropagation()}>
                                                <Plus className="h-4 w-4" />
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
                                      <div className="pl-8 sm:pl-16">
                                        {topic.resources?.length === 0 ? (
                                          <div className="p-1.5 sm:p-2 text-xs sm:text-sm text-muted-foreground">
                                            No resources available.
                                          </div>
                                        ) : (
                                          topic.resources?.map((resource: Resource) => {
                                            const contextUnlocked = isResourceUnlocked(resource.id);
                                            const isUnlocked = contextUnlocked || !resource.isLocked;
                                            return (
                                            <div 
                                              key={resource.id}
                                              className="flex items-center justify-between p-1.5 sm:p-2 hover:bg-primary/5 rounded gap-2"
                                            >
                                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                                {isUnlocked ? (
                                                  <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                                                ) : (
                                                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 flex-shrink-0" />
                                                )}
                                                <span className="text-xs sm:text-sm truncate">{resource.title}</span>
                                                <span className="text-[10px] sm:text-xs text-muted-foreground capitalize flex-shrink-0 inline">
                                                  ({resource.type})
                                                </span>
                                                {!isUnlocked && resource.isLocked && (
                                                  <span className="text-[10px] sm:text-xs text-yellow-600 font-medium flex items-center gap-1 flex-shrink-0">
                                                    <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                    <span className="inline">Ksh </span>
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

        {/* My Admins Content Tab */}
        <TabsContent value="admin" className="space-y-4">
          <div className="bg-primary/15 border border-primary/60 rounded-lg p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">My Admins Content</p>
              <p className="text-sm text-foreground">
                Content created by admins you manage. You can view and manage content from all admins in your institution.
              </p>
            </div>
          </div>

          {filteredAdminLevels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No admin content yet</p>
                <p className="text-sm text-muted-foreground">
                  Your admins will create content for your institution
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAdminLevels.map((level: LevelWithFullHierarchy) => (
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
                      {level.ownerId && (
                        <Badge variant="outline" className="mt-0.5 bg-primary/15 text-foreground border-primary/60 text-xs">
                          <User className="h-3 w-3 mr-1" />
                          <span className="truncate max-w-[150px] inline">{getOwnerEmail(level.ownerId)}</span>
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                      {level.subjects?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                                {subject.topics?.length || 0}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                              {topic.ownerId && (
                                <Badge variant="outline" className="ml-1 bg-primary/15 text-foreground border-primary/60 text-xs flex-shrink-0">
                                  <User className="h-3 w-3 mr-1" />
                                  <span className="inline">{getOwnerName(topic.ownerId)}</span>
                                </Badge>
                              )}
                              <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                                {topic.resources?.length || 0}
                              </span>
                            </div>
                                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                                              className="flex items-center justify-between p-1.5 sm:p-2 hover:bg-primary/5 rounded gap-2"
                                            >
                                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                                {isUnlocked ? (
                                                  <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                                                ) : (
                                                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 flex-shrink-0" />
                                                )}
                                                <span className="text-xs sm:text-sm truncate">{resource.title}</span>
                                                <span className="text-[10px] sm:text-xs text-muted-foreground capitalize flex-shrink-0 inline">
                                                  ({resource.type})
                                                </span>
                                                {!isUnlocked && resource.isLocked && (
                                                  <span className="text-[10px] sm:text-xs text-yellow-600 font-medium flex items-center gap-1 flex-shrink-0">
                                                    <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                    <span className="inline">Ksh </span>
                                                    <span className="sm:hidden">K</span>
                                                    {resource.unlockFee}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
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

        {/* My Regulars Content Tab */}
        <TabsContent value="regular" className="space-y-4">
          <div className="bg-primary/15 border border-primary/60 rounded-lg p-4 flex items-start gap-3">
            <User className="h-5 w-5 text-foreground mt-0.5" />
            <div>
              <p className="font-medium text-foreground">My Regulars Content</p>
              <p className="text-sm text-foreground">
                Personal content created by regular users you manage. You can view content from all regular users in your institution.
              </p>
            </div>
          </div>

          {filteredRegularLevels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No regular user content yet</p>
                <p className="text-sm text-muted-foreground">
                  Your regular users will create their personal content
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredRegularLevels.map((level: LevelWithFullHierarchy) => (
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
                      {level.ownerId && (
                        <Badge variant="outline" className="mt-0.5 bg-primary/15 text-foreground border-primary/60 text-xs">
                          <User className="h-3 w-3 mr-1" />
                          <span className="truncate max-w-[150px] inline">{getOwnerEmail(level.ownerId)}</span>
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0 inline">
                      {level.subjects?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                                {subject.topics?.length || 0}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                                       <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
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
                                        {topic.resources?.length === 0 ? (
                                          <div className="p-1.5 sm:p-2 text-xs sm:text-sm text-muted-foreground">
                                            No resources available.
                                          </div>
                                        ) : (
                                          topic.resources?.map((resource: Resource) => {
                                            const contextUnlocked = isResourceUnlocked(resource.id);
                                            const isUnlocked = contextUnlocked || !resource.isLocked;
                                            return (
                                            <div 
                                              key={resource.id}
                                              className="flex items-center justify-between p-1.5 sm:p-2 hover:bg-primary/5 rounded gap-2"
                                            >
                                              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                                {isUnlocked ? (
                                                  <Unlock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                                                ) : (
                                                  <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-yellow-600 flex-shrink-0" />
                                                )}
                                                <span className="text-xs sm:text-sm truncate">{resource.title}</span>
                                                <span className="text-[10px] sm:text-xs text-muted-foreground capitalize flex-shrink-0 inline">
                                                  ({resource.type})
                                                </span>
                                                {!isUnlocked && resource.isLocked && (
                                                  <span className="text-[10px] sm:text-xs text-yellow-600 font-medium flex items-center gap-1 flex-shrink-0">
                                                    <CreditCard className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                    <span className="inline">Ksh </span>
                                                    <span className="sm:hidden">K</span>
                                                    {resource.unlockFee}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
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
      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setItemToDelete(null);
        }}
        description={`This will permanently delete the ${itemToDelete?.type ?? ""} "${itemToDelete?.name ?? ""}". This action cannot be undone.`}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />

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


