"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  Search,
  FolderOpen,
  MoreVertical,
  Trash2,
  Eye,
  ChevronDownSquare,
  ChevronRightSquare,
  Building2,
  User,
  Shield,
  Edit,
  Lock,
  Unlock,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { deleteGradeWithSession, deleteSubjectWithSession, deleteTopicWithSession, deleteResource } from "@/lib/actions/admin";
import { ResourceUnlockModal } from "@/components/credits/resource-unlock-modal";
import type {
  GradeWithFullHierarchy,
  SubjectWithTopics,
  TopicWithResources,
  Resource,
  Grade,
  Subject,
  Topic,
} from "@/lib/types";

interface RegularDashboardClientProps {
  initialGrades: GradeWithFullHierarchy[];
  userId: string;
  adminIds: string[];
}

export function RegularDashboardClient({ initialGrades, userId, adminIds }: RegularDashboardClientProps) {
  const { user: clerkUser } = useUser();
  const router = useRouter();
  const [grades, setGrades] = useState<GradeWithFullHierarchy[]>(initialGrades);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Tab state
  const [activeTab, setActiveTab] = useState<"my" | "institution" | "public">("my");

  // Sync grades when initialGrades changes (after revalidation)
  useEffect(() => {
    setGrades(initialGrades);
  }, [initialGrades]);

  // Expansion states
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // Dialog states
  const [isCreateGradeOpen, setIsCreateGradeOpen] = useState(false);
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);

  // Delete dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCallback, setDeleteCallback] = useState<(() => Promise<void>) | null>(null);

  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<{ id: string; type: string; data: unknown } | null>(null);

  // Viewing resource
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Separate content by owner role and owner ID using useMemo
  // My Content: only content owned by the current user
  const myGrades = useMemo(() => 
    grades.filter((g) => g.ownerId === userId),
    [grades, userId]
  );

  // Admin/Institution Content: content owned by admins in adminIds
  const adminGrades = useMemo(() => 
    grades.filter((g) => g.ownerRole === "admin" && adminIds.includes(g.ownerId || "")),
    [grades, adminIds]
  );

  // Super Admin Content (public): content owned by super_admin
  const superAdminGrades = useMemo(() => 
    grades.filter((g) => g.ownerRole === "super_admin"),
    [grades]
  );

  // Derived subjects, topics, resources for each category
  const mySubjects = useMemo(() => myGrades.flatMap((g) => g.subjects), [myGrades]);
  const myTopics = useMemo(() => mySubjects.flatMap((s) => s.topics), [mySubjects]);
  const myResources = useMemo(() => myTopics.flatMap((t) => t.resources || []), [myTopics]);

  const adminSubjects = useMemo(() => adminGrades.flatMap((g) => g.subjects), [adminGrades]);
  const adminTopics = useMemo(() => adminSubjects.flatMap((s) => s.topics), [adminSubjects]);
  const adminResources = useMemo(() => adminTopics.flatMap((t) => t.resources || []), [adminTopics]);

  const superAdminSubjects = useMemo(() => superAdminGrades.flatMap((g) => g.subjects), [superAdminGrades]);
  const superAdminTopics = useMemo(() => superAdminSubjects.flatMap((s) => s.topics), [superAdminSubjects]);
  const superAdminResources = useMemo(() => superAdminTopics.flatMap((t) => t.resources || []), [superAdminTopics]);

  // Stats
  const myStats = useMemo(() => ({
    grades: myGrades.length,
    subjects: mySubjects.length,
    topics: myTopics.length,
    resources: myResources.length,
  }), [myGrades, mySubjects, myTopics, myResources]);

  const adminStats = useMemo(() => ({
    grades: adminGrades.length,
    subjects: adminSubjects.length,
    topics: adminTopics.length,
    resources: adminResources.length,
  }), [adminGrades, adminSubjects, adminTopics, adminResources]);

  // Filter grades based on search
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

  const filteredAdminGrades = useMemo(() => {
    if (!searchQuery) return adminGrades;
    const query = searchQuery.toLowerCase();
    return adminGrades.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects.some(s => 
        s.name.toLowerCase().includes(query) ||
        s.topics.some(t => t.title.toLowerCase().includes(query))
      )
    );
  }, [adminGrades, searchQuery]);

  const filteredSuperAdminGrades = useMemo(() => {
    if (!searchQuery) return superAdminGrades;
    const query = searchQuery.toLowerCase();
    return superAdminGrades.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects.some(s => 
        s.name.toLowerCase().includes(query) ||
        s.topics.some(t => t.title.toLowerCase().includes(query))
      )
    );
  }, [superAdminGrades, searchQuery]);

  // Get all subjects and topics for forms
  const allSubjects = useMemo(() => [...mySubjects, ...adminSubjects], [mySubjects, adminSubjects]);
  const allTopics = useMemo(() => [...myTopics, ...adminTopics], [myTopics, adminTopics]);
  const allGrades = useMemo(() => [...myGrades, ...adminGrades], [myGrades, adminGrades]);

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
    const allGradeIds = [...myGrades, ...adminGrades, ...superAdminGrades].map((g) => g.id);
    const allSubjectIds = [...mySubjects, ...adminSubjects, ...superAdminSubjects].map((s) => s.id);
    const allTopicIds = [...myTopics, ...adminTopics, ...superAdminTopics].map((t) => t.id);
    setExpandedGrades(new Set(allGradeIds));
    setExpandedSubjects(new Set(allSubjectIds));
    setExpandedTopics(new Set(allTopicIds));
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
        const grade = [...myGrades, ...adminGrades, ...superAdminGrades].find(g => g.id === id);
        return grade?.title || "Unknown Grade";
      }
      case "subject": {
        const subjects = [...mySubjects, ...adminSubjects, ...superAdminSubjects];
        const subject = subjects.find(s => s.id === id);
        return subject?.name || "Unknown Subject";
      }
      case "topic": {
        const topics = [...myTopics, ...adminTopics, ...superAdminTopics];
        const topic = topics.find(t => t.id === id);
        return topic?.title || "Unknown Topic";
      }
      case "resource": {
        const resources = [...myResources, ...adminResources, ...superAdminResources];
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

  // View resource
  const handleViewResource = useCallback((resource: Resource) => {
    setSelectedResource(resource);
  }, []);

  const handleBackFromViewer = () => {
    setSelectedResource(null);
  };

  // Handle success callbacks for create operations
  const handleCreateSuccess = () => {
    setIsCreateGradeOpen(false);
    setIsCreateSubjectOpen(false);
    setIsCreateTopicOpen(false);
    setIsCreateResourceOpen(false);
    router.refresh();
  };

  if (!clerkUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (selectedResource) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Button variant="ghost" onClick={handleBackFromViewer} className="mb-4">
          ← Back to Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{selectedResource.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{selectedResource.description}</p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Resource content would display here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" suppressHydrationWarning>
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">
          My Learning Dashboard
        </h2>
        <p className="text-muted-foreground">
          Manage your personal content and access resources from your institution
        </p>
      </div>

      {/* Stats Cards - Clickable to switch tabs */}
      <div className="grid gap-4 md:grid-cols-3">
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
            <div className="text-2xl font-bold">{superAdminGrades.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {superAdminSubjects.length} subjects, {superAdminResources.length} resources
            </p>
            <p className="text-xs text-purple-600 mt-1">
              {activeTab === "public" ? "Currently viewing" : "Click to view"}
            </p>
          </CardContent>
        </Card>

        {adminIds.length > 0 ? (
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              activeTab === "institution" && "ring-2 ring-green-500 ring-offset-2"
            )}
            onClick={() => setActiveTab("institution")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-green-500" />
                From Institution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminStats.grades}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {adminStats.subjects} subjects, {adminStats.resources} resources
              </p>
              <p className="text-xs text-green-600 mt-1">
                {activeTab === "institution" ? "Currently viewing" : "Click to view"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="opacity-60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Institution</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Not associated with any institution
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "my" | "institution" | "public")} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="my" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            My Content
            <Badge variant="secondary" className="ml-1">{myStats.grades}</Badge>
          </TabsTrigger>
          <TabsTrigger value="institution" className="flex items-center gap-2" disabled={adminIds.length === 0}>
            <Building2 className="h-4 w-4" />
            Institution
            {adminIds.length > 0 && <Badge variant="secondary" className="ml-1 bg-green-100 text-green-800">{adminStats.grades}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="public" className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-purple-500" />
            Public
            <Badge variant="secondary" className="ml-1 bg-purple-100 text-purple-800">{superAdminGrades.length}</Badge>
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
                  <CreateGradeForm onSuccess={handleCreateSuccess} />
                </DialogContent>
              </Dialog>
              <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 sm:h-10 gap-1.5" disabled={allGrades.length === 0}>
                    <Plus className="h-4 w-4" />
                    <span>Add Subject</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create New Subject</DialogTitle>
                  </DialogHeader>
                  <CreateSubjectForm 
                    grades={allGrades} 
                    onSuccess={handleCreateSuccess}
                  />
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
                  <CreateTopicForm 
                    subjects={allSubjects} 
                    onSuccess={handleCreateSuccess}
                  />
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
                  <CreateResourceForm 
                    subjects={allSubjects}
                    topics={allTopics}
                    onSuccess={handleCreateSuccess}
                  />
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} className="h-9 sm:h-10 gap-1.5">
                <ChevronDownSquare className="h-4 w-4" />
                <span>Expand</span>
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="h-9 sm:h-10 gap-1.5">
                <ChevronRightSquare className="h-4 w-4" />
                <span>Collapse</span>
              </Button>
              <div className="relative w-full sm:w-auto sm:min-w-[250px]">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search my content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {/* My Content Tree */}
          {filteredMyGrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No personal content yet</p>
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
            <div className="space-y-4">
              {filteredMyGrades.map((grade: GradeWithFullHierarchy) => (
                <GradeCard
                  key={`my-${grade.id}`}
                  grade={grade}
                  isExpanded={expandedGrades.has(grade.id)}
                  expandedSubjects={expandedSubjects}
                  expandedTopics={expandedTopics}
                  onToggle={() => toggleGrade(grade.id)}
                  onToggleSubject={toggleSubject}
                  onToggleTopic={toggleTopic}
                  onDelete={() => handleDeleteGrade(grade.id)}
                  onDeleteSubject={handleDeleteSubject}
                  onDeleteTopic={handleDeleteTopic}
                  onDeleteResource={handleDeleteResource}
                  onViewResource={handleViewResource}
                  onEditGrade={() => openEditDialog({ id: grade.id, type: "grade", data: grade })}
                  onEditSubject={(subject) => openEditDialog({ id: subject.id, type: "subject", data: subject })}
                  onEditTopic={(topic) => openEditDialog({ id: topic.id, type: "topic", data: topic })}
                  onAddSubjectSuccess={() => router.refresh()}
                  onAddTopicSuccess={() => router.refresh()}
                  onAddResourceSuccess={() => router.refresh()}
                  canDelete={true}
                  isAdminContent={false}
                  currentUserId={userId}
                  contentType="own"
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="institution" className="space-y-4 mt-6">
          {/* Search and controls for institution content */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} className="h-9 sm:h-10 gap-1.5">
                <ChevronDownSquare className="h-4 w-4" />
                <span>Expand</span>
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="h-9 sm:h-10 gap-1.5">
                <ChevronRightSquare className="h-4 w-4" />
                <span>Collapse</span>
              </Button>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[250px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search institution content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Read-only notice */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-800">Institution Content</p>
              <p className="text-sm text-green-700">
                This content is shared by your institution and is read-only. You can view and use these resources, but cannot modify or delete them.
              </p>
            </div>
          </div>

          {/* Institution Content Tree */}
          {filteredAdminGrades.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No institution content available</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Your institution hasn't shared any content yet"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredAdminGrades.map((grade: GradeWithFullHierarchy) => (
                <GradeCard
                  key={`admin-${grade.id}`}
                  grade={grade}
                  isExpanded={expandedGrades.has(grade.id)}
                  expandedSubjects={expandedSubjects}
                  expandedTopics={expandedTopics}
                  onToggle={() => toggleGrade(grade.id)}
                  onToggleSubject={toggleSubject}
                  onToggleTopic={toggleTopic}
                  onDelete={() => {}}
                  onDeleteSubject={() => {}}
                  onDeleteTopic={() => {}}
                  onDeleteResource={() => {}}
                  onViewResource={handleViewResource}
                  canDelete={false}
                  isAdminContent={true}
                  currentUserId={userId}
                  contentType="institution"
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="public" className="space-y-4 mt-6">
          {/* Search and controls for public content */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll} className="h-9 sm:h-10 gap-1.5">
                <ChevronDownSquare className="h-4 w-4" />
                <span>Expand</span>
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll} className="h-9 sm:h-10 gap-1.5">
                <ChevronRightSquare className="h-4 w-4" />
                <span>Collapse</span>
              </Button>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[250px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search public content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {/* Public content notice */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-medium text-purple-800">Public Platform Content</p>
              <p className="text-sm text-purple-700">
                This content is curated by the platform administrators and is available to all users. These resources form the foundation of the learning curriculum and are read-only.
              </p>
            </div>
          </div>

          {/* Public Content Tree */}
          {filteredSuperAdminGrades.length === 0 ? (
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
            <div className="space-y-4">
              {filteredSuperAdminGrades.map((grade: GradeWithFullHierarchy) => (
                <GradeCard
                  key={`super-${grade.id}`}
                  grade={grade}
                  isExpanded={expandedGrades.has(grade.id)}
                  expandedSubjects={expandedSubjects}
                  expandedTopics={expandedTopics}
                  onToggle={() => toggleGrade(grade.id)}
                  onToggleSubject={toggleSubject}
                  onToggleTopic={toggleTopic}
                  onDelete={() => {}}
                  onDeleteSubject={() => {}}
                  onDeleteTopic={() => {}}
                  onDeleteResource={() => {}}
                  onViewResource={handleViewResource}
                  canDelete={false}
                  isAdminContent={true}
                  currentUserId={userId}
                  contentType="public"
                />
              ))}
            </div>
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
        <DialogContent className="sm:max-w-[425px]">
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
              grades={allGrades}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Resource Item Component with Lock/Unlock handling
interface ResourceItemProps {
  resource: Resource;
  canDelete: boolean;
  currentUserId: string;
  onViewResource: (resource: Resource) => void;
  onDeleteResource: (resourceId: string) => void;
}

function ResourceItem({ resource, canDelete, currentUserId, onViewResource, onDeleteResource }: ResourceItemProps) {
  const [isUnlocked, setIsUnlocked] = useState(!resource.isLocked);
  const [isChecking, setIsChecking] = useState(true);

  // Check unlock status on mount
  useEffect(() => {
    const checkUnlockStatus = async () => {
      if (!resource.isLocked) {
        setIsUnlocked(true);
        setIsChecking(false);
        return;
      }

      try {
        const response = await fetch(`/api/content/unlock?resourceId=${resource.id}`);
        if (response.ok) {
          const data = await response.json();
          setIsUnlocked(data.isUnlocked);
        }
      } catch (error) {
        console.error("Failed to check unlock status:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkUnlockStatus();
  }, [resource.id, resource.isLocked]);

  const handleUnlockSuccess = () => {
    setIsUnlocked(true);
  };

  const handleView = () => {
    if (isUnlocked) {
      onViewResource(resource);
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-between p-2 hover:bg-muted/20 rounded">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{resource.title}</span>
          <span className="text-xs text-muted-foreground capitalize">
            ({resource.type})
          </span>
        </div>
        <div className="h-8 w-8 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-2 hover:bg-muted/20 rounded">
      <div className="flex items-center gap-3">
        {resource.isLocked ? (
          <Lock className="h-4 w-4 text-yellow-600" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-sm">{resource.title}</span>
        <span className="text-xs text-muted-foreground capitalize">
          ({resource.type})
        </span>
        {resource.isLocked && (
          <span className="text-xs text-yellow-600 font-medium">
            Ksh {resource.unlockFee}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
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
                className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
              >
                <CreditCard className="h-4 w-4" />
              </Button>
            }
            onUnlockSuccess={handleUnlockSuccess}
          />
        ) : (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleView}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {(canDelete && resource.ownerId === currentUserId) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDeleteResource(resource.id)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// Grade Card Component
interface GradeCardProps {
  grade: GradeWithFullHierarchy;
  isExpanded: boolean;
  expandedSubjects: Set<string>;
  expandedTopics: Set<string>;
  onToggle: () => void;
  onToggleSubject: (subjectId: string) => void;
  onToggleTopic: (topicId: string) => void;
  onDelete: () => void;
  onDeleteSubject: (subjectId: string) => void;
  onDeleteTopic: (topicId: string) => void;
  onDeleteResource: (resourceId: string) => void;
  onViewResource: (resource: Resource) => void;
  onEditGrade?: () => void;
  onEditSubject?: (subject: SubjectWithTopics) => void;
  onEditTopic?: (topic: TopicWithResources) => void;
  onAddSubjectSuccess?: () => void;
  onAddTopicSuccess?: () => void;
  onAddResourceSuccess?: () => void;
  canDelete: boolean;
  isAdminContent: boolean;
  currentUserId: string;
  contentType?: "own" | "institution" | "public";
}

function GradeCard({
  grade,
  isExpanded,
  expandedSubjects,
  expandedTopics,
  onToggle,
  onToggleSubject,
  onToggleTopic,
  onDelete,
  onDeleteSubject,
  onDeleteTopic,
  onDeleteResource,
  onViewResource,
  onEditGrade,
  onEditSubject,
  onEditTopic,
  onAddSubjectSuccess,
  onAddTopicSuccess,
  onAddResourceSuccess,
  canDelete,
  isAdminContent,
  currentUserId,
  contentType = "own",
}: GradeCardProps) {
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [addTopicForSubject, setAddTopicForSubject] = useState<string | null>(null);
  const [addResourceForTopic, setAddResourceForTopic] = useState<string | null>(null);

  // Check ownership at each level
  const canDeleteGrade = canDelete && grade.ownerId === currentUserId;

  // Determine styling based on content type
  const isPublicContent = contentType === "public";
  const isInstitutionContent = contentType === "institution";

  return (
    <Card className={cn(
      "overflow-hidden w-full",
      isPublicContent && "border-purple-200",
      isInstitutionContent && "border-green-200"
    )}>
      {/* Grade Header */}
      <div 
        className={cn(
          "flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50",
          isPublicContent && "bg-purple-50/50",
          isInstitutionContent && "bg-green-50/50"
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: grade.color }}
          />
          <div>
            <span className="font-semibold">{grade.title}</span>
            {isPublicContent && (
              <Badge variant="outline" className="ml-2 text-xs bg-purple-100 text-purple-800 border-purple-300">
                Public
              </Badge>
            )}
            {isInstitutionContent && (
              <Badge variant="outline" className="ml-2 text-xs bg-green-100 text-green-800 border-green-300">
                From Institution
              </Badge>
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            ({grade.subjects?.length || 0} subjects)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Add Subject button - only for owners */}
          {canDeleteGrade && (
            <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Subject to {grade.title}</DialogTitle>
                </DialogHeader>
                <CreateSubjectForm
                  grades={[grade]}
                  onSuccess={() => {
                    setIsAddSubjectOpen(false);
                    onAddSubjectSuccess?.();
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
          {canDeleteGrade && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditGrade}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Grade
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Grade
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Subjects */}
      {isExpanded && (
        <div className="border-t">
          {grade.subjects?.length === 0 ? (
            <div className="p-4 pl-12 text-sm text-muted-foreground">
              {canDelete ? "No subjects yet. Add your first subject." : "No subjects available from this grade."}
            </div>
          ) : (
            grade.subjects?.map((subject: SubjectWithTopics) => (
              <div key={subject.id}>
                {/* Subject Header */}
                <div 
                  className={cn(
                    "flex items-center justify-between p-3 pl-12 border-b cursor-pointer hover:bg-muted/30",
                    isPublicContent && "hover:bg-purple-50/30",
                    isInstitutionContent && "hover:bg-green-50/30"
                  )}
                  onClick={() => onToggleSubject(subject.id)}
                >
                  <div className="flex items-center gap-3">
                    {expandedSubjects.has(subject.id) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center text-sm"
                      style={{ backgroundColor: subject.color }}
                    >
                      {subject.icon}
                    </div>
                    <span className="font-medium">{subject.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({subject.topics?.length || 0} topics)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Add Topic button - only for owners */}
                    {(canDelete && subject.ownerId === currentUserId) && (
                      <Dialog open={addTopicForSubject === subject.id} onOpenChange={(open) => setAddTopicForSubject(open ? subject.id : null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                            className="gap-1"
                          >
                            <Plus className="h-4 w-4" />
                            Add Topic
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Add Topic to {subject.name}</DialogTitle>
                          </DialogHeader>
                          <CreateTopicForm
                            subjects={[subject]}
                            onSuccess={() => {
                              setAddTopicForSubject(null);
                              onAddTopicSuccess?.();
                            }}
                          />
                        </DialogContent>
                      </Dialog>
                    )}
                    {(canDelete && subject.ownerId === currentUserId) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditSubject?.(subject)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDeleteSubject(subject.id)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Topics */}
                {expandedSubjects.has(subject.id) && (
                  <div>
                    {subject.topics?.length === 0 ? (
                      <div className="p-3 pl-20 text-sm text-muted-foreground border-b">
                        No topics available.
                      </div>
                    ) : (
                      subject.topics?.map((topic: TopicWithResources) => (
                        <div key={topic.id} className="border-b last:border-b-0">
                          {/* Topic Header */}
                          <div 
                            className={cn(
                              "flex items-center justify-between p-3 pl-16 cursor-pointer hover:bg-muted/20",
                              isPublicContent && "hover:bg-purple-50/20",
                              isInstitutionContent && "hover:bg-green-50/20"
                            )}
                            onClick={() => onToggleTopic(topic.id)}
                          >
                            <div className="flex items-center gap-3">
                              {expandedTopics.has(topic.id) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <FolderOpen className="h-4 w-4 text-blue-500" />
                              <span className="font-medium">{topic.title}</span>
                              <span className="text-sm text-muted-foreground">
                                ({topic.resources?.length || 0} resources)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Add Resource button - only for owners */}
                              {(canDelete && topic.ownerId === currentUserId) && (
                                <Dialog open={addResourceForTopic === topic.id} onOpenChange={(open) => setAddResourceForTopic(open ? topic.id : null)}>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => e.stopPropagation()}
                                      className="gap-1"
                                    >
                                      <Plus className="h-4 w-4" />
                                      Add Resource
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[600px]">
                                    <DialogHeader>
                                      <DialogTitle>Add Resource to {topic.title}</DialogTitle>
                                    </DialogHeader>
                                    <CreateResourceForm
                                      subjects={[subject]}
                                      topics={[topic]}
                                      onSuccess={() => {
                                        setAddResourceForTopic(null);
                                        onAddResourceSuccess?.();
                                      }}
                                    />
                                  </DialogContent>
                                </Dialog>
                              )}
                              {(canDelete && topic.ownerId === currentUserId) && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onEditTopic?.(topic)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => onDeleteTopic(topic.id)} className="text-destructive">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </div>

                          {/* Resources */}
                          {expandedTopics.has(topic.id) && (
                            <div className="pl-20">
                              {topic.resources?.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground">
                                  No resources available.
                                </div>
                              ) : (
                                topic.resources?.map((resource: Resource) => (
                                  <ResourceItem
                                    key={resource.id}
                                    resource={resource}
                                    canDelete={canDelete}
                                    currentUserId={currentUserId}
                                    onViewResource={onViewResource}
                                    onDeleteResource={onDeleteResource}
                                  />
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
  );
}
