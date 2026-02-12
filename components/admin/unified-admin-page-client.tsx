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
} from "lucide-react";
import { ResourceViewer, ResourceViewerSkeleton } from "./resource-viewer";
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
import { CreateGradeForm } from "@/components/admin/create-grade-form";
import { CreateSubjectForm } from "@/components/admin/create-subject-form";
import { CreateTopicForm } from "@/components/admin/create-topic-form";
import { CreateResourceForm } from "@/components/admin/create-resource-form";
import { EditGradeForm } from "@/components/admin/edit-grade-form";
import { EditSubjectForm } from "@/components/admin/edit-subject-form";
import { EditTopicForm } from "@/components/admin/edit-topic-form";
import { EditResourceForm } from "@/components/admin/edit-resource-form";
import { ResourceUnlockModal } from "@/components/credits/resource-unlock-modal";
import {
  deleteGradeWithSession,
  deleteSubjectWithSession,
  deleteTopicWithSession,
  deleteResource,
} from "@/lib/actions/admin";
import type {
  GradeWithFullHierarchy,
  SubjectWithTopics,
  TopicWithResources,
  Resource,
  ResourceWithRelations,
  Grade,
  Subject,
  Topic,
} from "@/lib/types";

interface UnifiedAdminPageClientProps {
  initialGrades: GradeWithFullHierarchy[];
  userId: string;
  userRole: "admin" | "super_admin";
}

export function UnifiedAdminPageClient({
  initialGrades,
  userId,
  userRole,
}: UnifiedAdminPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user: clerkUser } = useUser();
  const [grades, setGrades] = useState<GradeWithFullHierarchy[]>(initialGrades);

  // Tab state
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");

  // Sync grades when initialGrades changes (after revalidation)
  useEffect(() => {
    setGrades(initialGrades);
  }, [initialGrades]);

  // Expansion states
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState("");

  // Resource viewer state
  const [selectedResource, setSelectedResource] = useState<ResourceWithRelations | null>(null);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [openResourceInEditMode, setOpenResourceInEditMode] = useState(false);

  // Dialog states
  const [isCreateGradeOpen, setIsCreateGradeOpen] = useState(false);
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

  // Track unlocked resources for public tab
  const [unlockedResources, setUnlockedResources] = useState<Set<string>>(new Set());

  // Handle viewResource query param from file tree dropdown
  useEffect(() => {
    const viewResourceId = searchParams.get("viewResource");
    if (viewResourceId && grades.length > 0) {
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
  }, [searchParams, grades]);

  // Separate content by owner role and owner ID
  // My Content: only content owned by the current user (admin's own content)
  const myGrades = useMemo(() => 
    grades.filter((g) => g.ownerRole === "admin" && g.ownerId === userId),
    [grades, userId]
  );
  
  // Public Content: content owned by super_admin
  const publicGrades = useMemo(() => 
    grades.filter((g) => g.ownerRole === "super_admin"),
    [grades]
  );

  // Stats
  const myStats = useMemo(() => {
    const subjects = myGrades.flatMap((g) => g.subjects);
    const topics = subjects.flatMap((s) => s.topics);
    const resources = topics.flatMap((t) => t.resources);
    return {
      grades: myGrades.length,
      subjects: subjects.length,
      topics: topics.length,
      resources: resources.length,
    };
  }, [myGrades]);

  const publicStats = useMemo(() => {
    const subjects = publicGrades.flatMap((g) => g.subjects);
    const topics = subjects.flatMap((s) => s.topics);
    const resources = topics.flatMap((t) => t.resources);
    return {
      grades: publicGrades.length,
      subjects: subjects.length,
      topics: topics.length,
      resources: resources.length,
    };
  }, [publicGrades]);

  // Get all subjects and topics for forms (only from my content)
  const allSubjects = useMemo(() => myGrades.flatMap((g) => g.subjects), [myGrades]);
  const allTopics = useMemo(() => allSubjects.flatMap((s) => s.topics), [allSubjects]);

  // Get all subjects and topics for the current tab's expand/collapse functionality
  const currentTabGrades = activeTab === "my" ? myGrades : publicGrades;
  const currentTabSubjects = useMemo(() => 
    currentTabGrades.flatMap((g) => g.subjects), 
    [currentTabGrades]
  );
  const currentTabTopics = useMemo(() => 
    currentTabSubjects.flatMap((s) => s.topics), 
    [currentTabSubjects]
  );

  // Filter grades based on search and active tab
  const filteredMyGrades = useMemo(() => {
    if (!searchQuery) return myGrades;
    const query = searchQuery.toLowerCase();
    return myGrades.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects.some(s => 
        s.name.toLowerCase().includes(query) ||
        s.topics.some(t => t.title.toLowerCase().includes(query))
      )
    );
  }, [myGrades, searchQuery]);

  const filteredPublicGrades = useMemo(() => {
    if (!searchQuery) return publicGrades;
    const query = searchQuery.toLowerCase();
    return publicGrades.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects.some(s => 
        s.name.toLowerCase().includes(query) ||
        s.topics.some(t => t.title.toLowerCase().includes(query))
      )
    );
  }, [publicGrades, searchQuery]);

  // Expansion handlers
  const toggleGrade = (gradeId: string) => {
    const newExpanded = new Set(expandedGrades);
    if (newExpanded.has(gradeId)) {
      newExpanded.delete(gradeId);
    } else {
      newExpanded.add(gradeId);
    }
    setExpandedGrades(newExpanded);
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
    setExpandedGrades(new Set(currentTabGrades.map((g) => g.id)));
    setExpandedSubjects(new Set(currentTabSubjects.map((s) => s.id)));
    setExpandedTopics(new Set(currentTabTopics.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedGrades(new Set());
    setExpandedSubjects(new Set());
    setExpandedTopics(new Set());
  };

  // Helper to get item name from ID
  const getItemName = (id: string, type: string): string => {
    switch (type) {
      case "grade": {
        const grade = grades.find(g => g.id === id);
        return grade?.title || "Unknown Grade";
      }
      case "subject": {
        const subjects = grades.flatMap(g => g.subjects);
        const subject = subjects.find(s => s.id === id);
        return subject?.name || "Unknown Subject";
      }
      case "topic": {
        const subjects = grades.flatMap(g => g.subjects);
        const topics = subjects.flatMap(s => s.topics);
        const topic = topics.find(t => t.id === id);
        return topic?.title || "Unknown Topic";
      }
      case "resource": {
        const subjects = grades.flatMap(g => g.subjects);
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

  const handleDeleteGrade = async (gradeId: string) => {
    openDeleteDialog(gradeId, "grade", async () => {
      await deleteGradeWithSession(gradeId);
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

  // Edit handlers for grades, subjects, topics
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
          grade: grades.find((g) => g.subjects.some((sub) => sub.id === s.id)) || {
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
          grades, subjects, topics, and resources.
        </p>
      </div>

      {/* Stats Cards - Clickable to switch tabs */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === "my" && "ring-2 ring-blue-500 ring-offset-2"
          )}
          onClick={() => setActiveTab("my")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              My Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myStats.grades}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {myStats.subjects} subjects, {myStats.resources} resources
            </p>
            <p className="text-xs text-blue-600 mt-1">
              {activeTab === "my" ? "Currently viewing" : "Click to view"}
            </p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            activeTab === "public" && "ring-2 ring-purple-500 ring-offset-2"
          )}
          onClick={() => setActiveTab("public")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              Public Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{publicStats.grades}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {publicStats.subjects} subjects, {publicStats.resources} resources
            </p>
            <p className="text-xs text-purple-600 mt-1">
              {activeTab === "public" ? "Currently viewing" : "Click to view"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manage Regulars Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-blue-900">Manage Regular Users</p>
                <p className="text-sm text-blue-700">Add and manage regular users for your institution</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-blue-300 hover:bg-blue-100"
              onClick={() => router.push("/admin/regulars")}
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Regulars
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for My Content and Public Content */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my" | "public")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="my" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            My Content
            <Badge variant="secondary" className="ml-1">{myStats.grades}</Badge>
          </TabsTrigger>
          <TabsTrigger value="public" className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-500" />
            Public Content
            <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-800">{publicStats.grades}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4 mt-6">
          {/* Quick Actions & Search - Only show in My Content tab */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Dialog open={isCreateGradeOpen} onOpenChange={setIsCreateGradeOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 sm:h-10 gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span>Add Grade</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Grade</DialogTitle>
                  </DialogHeader>
                  <CreateGradeForm onSuccess={() => setIsCreateGradeOpen(false)} />
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5" disabled={grades.length === 0}>
                    <Plus className="h-4 w-4" />
                    <span>Add Subject</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Subject</DialogTitle>
                  </DialogHeader>
                  <CreateSubjectForm grades={grades} onSuccess={() => setIsCreateSubjectOpen(false)} />
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateTopicOpen} onOpenChange={setIsCreateTopicOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5" disabled={allSubjects.length === 0}>
                    <Plus className="h-4 w-4" />
                    <span>Add Topic</span>
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
                  <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5" disabled={allTopics.length === 0}>
                    <Plus className="h-4 w-4" />
                    <span>Add Resource</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>Create New Resource</DialogTitle>
                  </DialogHeader>
                  <CreateResourceForm subjects={allSubjects} topics={allTopics} onSuccess={() => setIsCreateResourceOpen(false)} />
                </DialogContent>
              </Dialog>
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
          {/* My Content Tree */}
          {filteredMyGrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No content yet</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Get started by creating your first grade"}
                </p>
                {!searchQuery && (
                  <Button className="mt-4" onClick={() => setIsCreateGradeOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Grade
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredMyGrades.map((grade: GradeWithFullHierarchy) => (
            <Card key={grade.id} className="overflow-hidden">
              {/* Grade Header */}
              <div 
                className="flex items-center justify-between p-4 bg-muted/50 cursor-pointer hover:bg-muted"
                onClick={() => toggleGrade(grade.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedGrades.has(grade.id) ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: grade.color }}
                  >
                    {grade.gradeNumber}
                  </div>
                  <div>
                    <span className="font-semibold text-lg">{grade.title}</span>
                    <Badge variant="secondary" className="ml-2">{grade.level}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({grade.subjects.length} subjects)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Subject
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Add Subject to {grade.title}</DialogTitle>
                      </DialogHeader>
                      <CreateSubjectForm grades={[grade]} onSuccess={() => {}} />
                    </DialogContent>
                  </Dialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog({ id: grade.id, type: "grade", data: grade })}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Grade
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteGrade(grade.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Grade
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Subjects */}
              {expandedGrades.has(grade.id) && (
                <div className="border-t">
                  {grade.subjects.length === 0 ? (
                    <div className="p-4 pl-12 text-sm text-muted-foreground">
                      No subjects yet. Add your first subject.
                    </div>
                  ) : (
                    grade.subjects.map((subject) => (
                      <div key={subject.id}>
                        {/* Subject Header */}
                        <div 
                          className="flex items-center justify-between p-3 pl-8 border-b cursor-pointer hover:bg-muted/30"
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
                              ({subject.topics.length} topics)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
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
                                    className="flex items-center justify-between p-3 pl-12 cursor-pointer hover:bg-muted/20"
                                    onClick={() => toggleTopic(topic.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      {expandedTopics.has(topic.id) ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <FileText className="h-4 w-4 text-blue-500" />
                                      <span className="font-medium">{topic.title}</span>
                                      <span className="text-sm text-muted-foreground">
                                        ({topic.resources?.length || 0} resources)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
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
                                      <div className="pl-16">
                                        {!topic.resources || topic.resources.length === 0 ? (
                                          <div className="p-2 text-sm text-muted-foreground">
                                            No resources yet.
                                          </div>
                                        ) : (
                                          topic.resources.map((resource) => (
                                          <div 
                                            key={resource.id}
                                            className="flex items-center justify-between p-2 hover:bg-muted/20 rounded"
                                          >
                                            <div className="flex items-center gap-3">
                                              {resource.isLocked ? (
                                                <Lock className="h-4 w-4 text-yellow-600" />
                                              ) : (
                                                <Unlock className="h-4 w-4 text-green-600" />
                                              )}
                                              <span className="text-sm">{resource.title}</span>
                                              <span className="text-xs text-muted-foreground capitalize">
                                                ({resource.type})
                                              </span>
                                              {resource.isLocked && (
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

        <TabsContent value="public" className="space-y-4 mt-6">
          {/* Search - Only show search in Public Content tab */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
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

          {/* Public Content Notice */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-medium text-purple-800">Public Platform Content</p>
              <p className="text-sm text-purple-700">
                This content is curated by platform administrators and is available to all users. These resources are read-only and form the foundation of the learning curriculum.
              </p>
            </div>
          </div>

          {/* Public Content Tree */}
          {filteredPublicGrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No public content available yet</p>
                <p className="text-sm text-muted-foreground">
                  Public content will appear here when platform administrators add resources
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredPublicGrades.map((grade: GradeWithFullHierarchy) => (
              <Card key={grade.id} className="overflow-hidden border-purple-200">
                {/* Grade Header */}
                <div 
                  className="flex items-center justify-between p-4 bg-purple-50/50 cursor-pointer hover:bg-purple-50"
                  onClick={() => toggleGrade(grade.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedGrades.has(grade.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: grade.color }}
                    >
                      {grade.gradeNumber}
                    </div>
                    <div>
                      <span className="font-semibold text-lg">{grade.title}</span>
                      <Badge variant="outline" className="ml-2 bg-purple-100 text-purple-800 border-purple-300">
                        Public
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ({grade.subjects.length} subjects)
                    </span>
                  </div>
                </div>

                {/* Subjects */}
                {expandedGrades.has(grade.id) && (
                  <div className="border-t">
                    {grade.subjects.length === 0 ? (
                      <div className="p-4 pl-12 text-sm text-muted-foreground">
                        No subjects available.
                      </div>
                    ) : (
                      grade.subjects.map((subject: SubjectWithTopics) => (
                        <div key={subject.id}>
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
                                ({subject.topics.length} topics)
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
                                      className="flex items-center justify-between p-3 pl-12 cursor-pointer hover:bg-purple-50/20"
                                      onClick={() => toggleTopic(topic.id)}
                                    >
                                      <div className="flex items-center gap-3">
                                        {expandedTopics.has(topic.id) ? (
                                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <FolderOpen className="h-4 w-4 text-purple-500" />
                                        <span className="font-medium">{topic.title}</span>
                                        <span className="text-sm text-muted-foreground">
                                          ({topic.resources?.length || 0} resources)
                                        </span>
                                      </div>
                                    </div>

                                      {/* Resources */}
                                      {expandedTopics.has(topic.id) && (
                                        <div className="pl-16">
                                          {!topic.resources || topic.resources.length === 0 ? (
                                            <div className="p-2 text-sm text-muted-foreground">
                                              No resources available.
                                            </div>
                                          ) : (
                                            topic.resources.map((resource: Resource) => {
                                              const isUnlocked = !resource.isLocked || unlockedResources.has(resource.id);
                                              return (
                                                <div 
                                                  key={resource.id}
                                                  className="flex items-center justify-between p-2 hover:bg-purple-50/10 rounded"
                                                >
                                                  <div className="flex items-center gap-3">
                                                    {resource.isLocked ? (
                                                      <Lock className="h-4 w-4 text-yellow-600" />
                                                    ) : (
                                                      <Unlock className="h-4 w-4 text-green-600" />
                                                    )}
                                                    <span className="text-sm">{resource.title}</span>
                                                    <span className="text-xs text-muted-foreground capitalize">
                                                      ({resource.type})
                                                    </span>
                                                    {resource.isLocked && (
                                                      <span className="text-xs text-yellow-600 font-medium flex items-center gap-1">
                                                        <CreditCard className="h-3 w-3" />
                                                        Ksh {resource.unlockFee}
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
                                                          size="sm"
                                                          className="h-7 text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                                        >
                                                          <Lock className="h-3 w-3 mr-1" />
                                                          Unlock
                                                        </Button>
                                                      }
                                                      onUnlockSuccess={() => {
                                                        setUnlockedResources(prev => new Set([...prev, resource.id]));
                                                      }}
                                                    />
                                                  ) : (
                                                    <Button 
                                                      variant="ghost" 
                                                      size="sm"
                                                      onClick={() => handleViewResource(resource)}
                                                    >
                                                      <Eye className="h-4 w-4" />
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
          {itemToEdit?.type === "grade" && (
            <EditGradeForm 
              grade={itemToEdit.data as Grade} 
              onSuccess={handleEditSuccess}
            />
          )}
          {itemToEdit?.type === "subject" && (
            <EditSubjectForm 
              subject={itemToEdit.data as Subject}
              grades={grades}
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
                subjects={allSubjects.map(s => ({ id: s.id, name: s.name, grade: { id: s.gradeId, title: "Grade" } }))}
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
