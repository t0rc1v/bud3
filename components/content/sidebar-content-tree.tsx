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
import { CreateGradeForm } from "@/components/admin/create-grade-form";
import { CreateSubjectForm } from "@/components/admin/create-subject-form";
import { CreateTopicForm } from "@/components/admin/create-topic-form";
import { CreateResourceForm } from "@/components/admin/create-resource-form";
import { EditGradeForm } from "@/components/admin/edit-grade-form";
import { EditSubjectForm } from "@/components/admin/edit-subject-form";
import { EditTopicForm } from "@/components/admin/edit-topic-form";
import {
  deleteGradeWithSession,
  deleteSubjectWithSession,
  deleteTopicWithSession,
  deleteResource,
  getResourceById,
} from "@/lib/actions/admin";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ContentTab = "my" | "institution" | "public" | "super" | "admin" | "regular";
type UserRole = "regular" | "admin" | "super_admin";

interface SidebarContentTreeProps {
  initialGrades: GradeWithFullHierarchy[];
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
  initialGrades,
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
  const [grades, setGrades] = useState<GradeWithFullHierarchy[]>(initialGrades);

  // Determine available tabs based on user role if not provided
  const tabs = useMemo(() => {
    if (availableTabs) return availableTabs;
    
    switch (userRole) {
      case "super_admin":
        return ["super", "admin", "regular"] as ContentTab[];
      case "admin":
        return ["my", "public"] as ContentTab[];
      case "regular":
        return adminIds.length > 0 
          ? ["my", "institution", "public"] as ContentTab[]
          : ["my", "public"] as ContentTab[];
      default:
        return ["my"] as ContentTab[];
    }
  }, [availableTabs, userRole, adminIds]);

  // Determine default tab
  const initialTab = defaultTab || tabs[0];
  const [activeTab, setActiveTab] = useState<ContentTab>(initialTab);

  // Sync grades when initialGrades changes
  useEffect(() => {
    setGrades(initialGrades);
  }, [initialGrades]);

  // Expansion states
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Dialog states
  const [isCreateGradeOpen, setIsCreateGradeOpen] = useState(false);
  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCallback, setDeleteCallback] = useState<(() => Promise<void>) | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<{ id: string; type: string; data: unknown } | null>(null);

  // Separate content by owner role
  const myGrades = useMemo(() => 
    grades.filter((g) => g.ownerId === userId),
    [grades, userId]
  );

  const institutionGrades = useMemo(() => 
    grades.filter((g) => g.ownerRole === "admin" && adminIds.includes(g.ownerId || "")),
    [grades, adminIds]
  );

  const publicGrades = useMemo(() => 
    grades.filter((g) => g.ownerRole === "super_admin"),
    [grades]
  );

  const adminGrades = useMemo(() => 
    grades.filter((g) => g.ownerRole === "admin"),
    [grades]
  );

  const regularGrades = useMemo(() => 
    grades.filter((g) => g.ownerRole === "regular"),
    [grades]
  );

  // Get current tab grades
  const currentTabGrades = useMemo(() => {
    switch (activeTab) {
      case "my": return myGrades;
      case "institution": return institutionGrades;
      case "public": return publicGrades;
      case "super": return publicGrades;
      case "admin": return adminGrades;
      case "regular": return regularGrades;
      default: return myGrades;
    }
  }, [activeTab, myGrades, institutionGrades, publicGrades, adminGrades, regularGrades]);

  // Filter grades based on search
  const filteredGrades = useMemo(() => {
    if (!searchQuery) return currentTabGrades;
    const query = searchQuery.toLowerCase();
    return currentTabGrades.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.subjects.some(s => 
        s.name.toLowerCase().includes(query) ||
        s.topics.some(t => t.title.toLowerCase().includes(query))
      )
    );
  }, [currentTabGrades, searchQuery]);

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
    const allSubjects = currentTabGrades.flatMap((g) => g.subjects);
    const allTopics = allSubjects.flatMap((s) => s.topics);
    setExpandedGrades(new Set(currentTabGrades.map((g) => g.id)));
    setExpandedSubjects(new Set(allSubjects.map((s) => s.id)));
    setExpandedTopics(new Set(allTopics.map((t) => t.id)));
  };

  const collapseAll = () => {
    setExpandedGrades(new Set());
    setExpandedSubjects(new Set());
    setExpandedTopics(new Set());
  };

  // Helper to get item name
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
  const allSubjects = useMemo(() => currentTabGrades.flatMap((g) => g.subjects), [currentTabGrades]);
  const allTopics = useMemo(() => allSubjects.flatMap((s) => s.topics), [allSubjects]);

  // Get tab icon
  const getTabIcon = (tab: ContentTab) => {
    switch (tab) {
      case "my": return <User className="h-3 w-3" />;
      case "institution": return <Building2 className="h-3 w-3" />;
      case "public":
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
      case "institution": return "Institution";
      case "public": return "Public";
      case "super": return "Public";
      case "admin": return "Admin";
      case "regular": return "Regular";
      default: return tab;
    }
  };

  // Get tab color
  const getTabColor = (tab: ContentTab) => {
    switch (tab) {
      case "my": return "text-blue-600";
      case "institution": return "text-green-600";
      case "public":
      case "super": return "text-purple-600";
      case "admin": return "text-blue-600";
      case "regular": return "text-green-600";
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
            <Dialog open={isCreateGradeOpen} onOpenChange={setIsCreateGradeOpen}>
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
                    <p>Add Grade</p>
                  </TooltipContent>
                </Tooltip>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create New Grade</DialogTitle>
                </DialogHeader>
                <CreateGradeForm onSuccess={() => { setIsCreateGradeOpen(false); router.refresh(); }} />
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
            {filteredGrades.length === 0 ? (
              <div className="text-center py-4 px-2">
                <FolderOpen className="h-6 w-6 mx-auto mb-1 text-muted-foreground opacity-50" />
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? "No results" : "No content"}
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredGrades.map((grade) => (
                  <GradeNode
                    key={grade.id}
                    grade={grade}
                    isExpanded={expandedGrades.has(grade.id)}
                    expandedSubjects={expandedSubjects}
                    expandedTopics={expandedTopics}
                    onToggle={() => toggleGrade(grade.id)}
                    onToggleSubject={toggleSubject}
                    onToggleTopic={toggleTopic}
                    onViewResource={handleViewResource}
                    onAddToChat={handleAddToChat}
                    onDeleteGrade={enableCrud ? handleDeleteGrade : undefined}
                    onDeleteSubject={enableCrud ? handleDeleteSubject : undefined}
                    onDeleteTopic={enableCrud ? handleDeleteTopic : undefined}
                    onDeleteResource={enableCrud ? handleDeleteResource : undefined}
                    onEditGrade={enableCrud ? (g) => openEditDialog({ id: g.id, type: "grade", data: g }) : undefined}
                    onEditSubject={enableCrud ? (s) => openEditDialog({ id: s.id, type: "subject", data: s }) : undefined}
                    onEditTopic={enableCrud ? (t) => openEditDialog({ id: t.id, type: "topic", data: t }) : undefined}
                    userId={userId}
                    activeTab={activeTab}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground border-t bg-muted/20">
          <span>{filteredGrades.length} items</span>
          <span>{expandedGrades.size + expandedSubjects.size + expandedTopics.size} expanded</span>
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
                grades={currentTabGrades}
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

        {/* Create Dialogs */}
        <Dialog open={isCreateSubjectOpen} onOpenChange={setIsCreateSubjectOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Subject</DialogTitle>
            </DialogHeader>
            <CreateSubjectForm 
              grades={currentTabGrades} 
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

// Grade Node Component
interface GradeNodeProps {
  grade: GradeWithFullHierarchy;
  isExpanded: boolean;
  expandedSubjects: Set<string>;
  expandedTopics: Set<string>;
  onToggle: () => void;
  onToggleSubject: (id: string) => void;
  onToggleTopic: (id: string) => void;
  onViewResource: (resource: Resource) => void;
  onAddToChat: (resource: Resource) => void;
  onDeleteGrade?: (id: string) => void;
  onDeleteSubject?: (id: string) => void;
  onDeleteTopic?: (id: string) => void;
  onDeleteResource?: (id: string) => void;
  onEditGrade?: (grade: GradeWithFullHierarchy) => void;
  onEditSubject?: (subject: SubjectWithTopics) => void;
  onEditTopic?: (topic: TopicWithResources) => void;
  userId: string;
  activeTab: ContentTab;
}

function GradeNode({
  grade,
  isExpanded,
  expandedSubjects,
  expandedTopics,
  onToggle,
  onToggleSubject,
  onToggleTopic,
  onViewResource,
  onAddToChat,
  onDeleteGrade,
  onDeleteSubject,
  onDeleteTopic,
  onDeleteResource,
  onEditGrade,
  onEditSubject,
  onEditTopic,
  userId,
  activeTab,
}: GradeNodeProps) {
  const isOwner = grade.ownerId === userId;
  const canManage = onDeleteGrade && isOwner && activeTab === "my";
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
          style={{ backgroundColor: grade.color }}
        >
          {grade.gradeNumber}
        </div>
        
        <span 
          className="text-xs font-medium flex-1 truncate"
          onClick={onToggle}
        >
          {grade.title}
        </span>
        
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {grade.subjects.length}
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
                  <DialogTitle>Add Subject to {grade.title}</DialogTitle>
                </DialogHeader>
                <CreateSubjectForm
                  grades={[grade]}
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
                <DropdownMenuItem onClick={() => onEditGrade?.(grade)}>
                  <Edit className="h-3 w-3 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDeleteGrade?.(grade.id)}
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
          {grade.subjects.map((subject) => (
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
              userId={userId}
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
  userId: string;
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
  userId,
  activeTab,
}: SubjectNodeProps) {
  const isOwner = subject.ownerId === userId;
  const canManage = onDeleteSubject && isOwner && activeTab === "my";
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
        
        <BookOpen className="h-3 w-3 text-green-500 flex-shrink-0" />
        
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
              userId={userId}
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
  userId: string;
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
  userId,
  activeTab,
}: TopicNodeProps) {
  const isOwner = topic.ownerId === userId;
  const canManage = onDeleteTopic && isOwner && activeTab === "my";
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
        
        <FolderOpen className="h-3 w-3 text-amber-500 flex-shrink-0" />
        
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
              userId={userId}
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
  resource: Resource;
  onView: () => void;
  onAddToChat: () => void;
  onDelete?: (id: string) => void;
  userId: string;
  activeTab: ContentTab;
}

function ResourceNode({
  resource,
  onView,
  onAddToChat,
  onDelete,
  userId,
  activeTab,
}: ResourceNodeProps) {
  const isOwner = resource.ownerId === userId;
  const canDelete = onDelete && isOwner && activeTab === "my";
  const [isUnlocked, setIsUnlocked] = useState(!resource.isLocked);

  const handleUnlockSuccess = () => {
    setIsUnlocked(true);
  };

  return (
    <div className="flex items-center gap-1 py-0.5 px-1 rounded-sm hover:bg-accent group">
      {resource.isLocked ? (
        <Lock className="h-3 w-3 text-yellow-500 flex-shrink-0" />
      ) : (
        <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
      )}
      
      <span 
        className="text-[11px] flex-1 truncate cursor-pointer"
        onClick={isUnlocked ? onView : undefined}
      >
        {resource.title}
      </span>
      
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
              className="h-4 w-4 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
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
