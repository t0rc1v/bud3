"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Folder,
  MoreVertical,
  ExternalLink,
  ChevronDownSquare,
  ChevronRightSquare,
  Eye,
} from "lucide-react";
import { ResourceViewer, ResourceViewerSkeleton } from "./resource-viewer";
import { getResourceById } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  deleteGrade,
  deleteSubject,
  deleteTopic,
  deleteResource,
} from "@/lib/actions/admin";
import type {
  GradeWithFullHierarchy,
  SubjectWithTopics,
  TopicWithResources,
  Resource,
  ResourceWithRelations,
  Grade,
} from "@/lib/types";

interface UnifiedAdminPageClientProps {
  initialGrades: GradeWithFullHierarchy[];
}

interface BreadcrumbItem {
  type: "grade" | "subject" | "topic" | "resource";
  id: string;
  name: string;
}

export function UnifiedAdminPageClient({
  initialGrades,
}: UnifiedAdminPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [grades, setGrades] = useState<GradeWithFullHierarchy[]>(initialGrades);

  // Sync grades when initialGrades changes (after revalidation)
  useEffect(() => {
    setGrades(initialGrades);
  }, [initialGrades]);

  // Handle viewResource query param from file tree dropdown
  useEffect(() => {
    const viewResourceId = searchParams.get("viewResource");
    if (viewResourceId && grades.length > 0) {
      // Find and load the resource
      const loadResource = async () => {
        setIsLoadingResource(true);
        try {
          const resource = await getResourceById(viewResourceId);
          if (resource) {
            setSelectedResource(resource);
            // Build breadcrumbs
            const newBreadcrumbs: BreadcrumbItem[] = [];
            for (const grade of grades) {
              for (const subject of grade.subjects) {
                for (const topic of subject.topics) {
                  if (topic.resources.some(r => r.id === viewResourceId)) {
                    newBreadcrumbs.push({ type: "grade", id: grade.id, name: grade.title });
                    newBreadcrumbs.push({ type: "subject", id: subject.id, name: subject.name });
                    newBreadcrumbs.push({ type: "topic", id: topic.id, name: topic.title });
                    newBreadcrumbs.push({ type: "resource", id: resource.id, name: resource.title });
                    setBreadcrumbs(newBreadcrumbs);
                    return;
                  }
                }
              }
            }
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

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set()
  );
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [selectedGrade, setSelectedGrade] =
    useState<GradeWithFullHierarchy | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceWithRelations | null>(null);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [openResourceInEditMode, setOpenResourceInEditMode] = useState(false);

  // Dialog states
  const [isCreateGradeOpen, setIsCreateGradeOpen] = useState(false);
  const [isFirstGradeOpen, setIsFirstGradeOpen] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const totalSubjects = grades.reduce(
      (acc, grade) => acc + grade.subjects.length,
      0
    );
    const totalTopics = grades.reduce(
      (acc, grade) =>
        acc +
        grade.subjects.reduce(
          (subAcc, subject) => subAcc + subject.topics.length,
          0
        ),
      0
    );
    const totalResources = grades.reduce(
      (acc, grade) =>
        acc +
        grade.subjects.reduce(
          (subAcc, subject) =>
            subAcc +
            subject.topics.reduce(
              (topicAcc, topic) => topicAcc + topic.resources.length,
              0
            ),
          0
        ),
      0
    );
    return {
      grades: grades.length,
      subjects: totalSubjects,
      topics: totalTopics,
      resources: totalResources,
    };
  }, [grades]);

  // Filter grades based on search
  const filteredGrades = useMemo(() => {
    if (!searchQuery) return grades;

    const query = searchQuery.toLowerCase();
    return grades.filter((grade) => {
      const gradeMatch = grade.title.toLowerCase().includes(query);
      const subjectMatch = grade.subjects.some(
        (subject) =>
          subject.name.toLowerCase().includes(query) ||
          subject.topics.some(
            (topic) =>
              topic.title.toLowerCase().includes(query) ||
              topic.resources.some((resource) =>
                resource.title.toLowerCase().includes(query)
              )
          )
      );
      return gradeMatch || subjectMatch;
    });
  }, [grades, searchQuery]);

  // Toggle expansion functions
  const toggleGrade = (gradeId: string) => {
    setExpandedGrades((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(gradeId)) {
        newSet.delete(gradeId);
      } else {
        newSet.add(gradeId);
      }
      return newSet;
    });
  };

  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subjectId)) {
        newSet.delete(subjectId);
      } else {
        newSet.add(subjectId);
      }
      return newSet;
    });
  };

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  // Expand/Collapse all
  const expandAll = () => {
    setExpandedGrades(new Set(grades.map((g) => g.id)));
    setExpandedSubjects(
      new Set(
        grades.flatMap((g) => g.subjects.map((s) => s.id))
      )
    );
    setExpandedTopics(
      new Set(
        grades.flatMap((g) =>
          g.subjects.flatMap((s) => s.topics.map((t) => t.id))
        )
      )
    );
  };

  const collapseAll = () => {
    setExpandedGrades(new Set());
    setExpandedSubjects(new Set());
    setExpandedTopics(new Set());
  };

  // Delete handlers
  const handleDeleteGrade = async (gradeId: string) => {
    if (confirm("Are you sure you want to delete this grade?")) {
      await deleteGrade(gradeId);
      router.refresh();
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (confirm("Are you sure you want to delete this subject?")) {
      await deleteSubject(subjectId);
      router.refresh();
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (confirm("Are you sure you want to delete this topic?")) {
      await deleteTopic(topicId);
      router.refresh();
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (confirm("Are you sure you want to delete this resource?")) {
      await deleteResource(resourceId);
      router.refresh();
    }
  };

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
    await handleViewResource(resource, true);
  };

  const handleBackFromViewer = () => {
    setSelectedResource(null);
    setOpenResourceInEditMode(false);
  };

  // Get all subjects and topics for forms
  const allSubjects = useMemo(
    () => grades.flatMap((g) => g.subjects),
    [grades]
  );
  const allTopics = useMemo(
    () => allSubjects.flatMap((s) => s.topics),
    [allSubjects]
  );

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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Grades</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.grades}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Subjects
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.subjects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Topics</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.topics}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Resources
            </CardTitle>
            <Library className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resources}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Search */}
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
            placeholder="Search grades, subjects, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className="cursor-pointer hover:text-foreground"
            onClick={() => {
              setBreadcrumbs([]);
              setSelectedGrade(null);
            }}
          >
            All Grades
          </span>
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.id} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4" />
              <span
                className="cursor-pointer hover:text-foreground"
                onClick={() => {
                  setBreadcrumbs(breadcrumbs.slice(0, index + 1));
                }}
              >
                {crumb.name}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Resource Viewer */}
      {isLoadingResource ? (
        <ResourceViewerSkeleton />
      ) : selectedResource ? (
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
      ) : (
        /* Content Tree */
        <div className="space-y-4">
          {filteredGrades.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No grades found</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Get started by creating your first grade"}
              </p>
              {!searchQuery && (
                <Dialog open={isFirstGradeOpen} onOpenChange={setIsFirstGradeOpen}>
                  <DialogTrigger asChild>
                    <Button className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Grade
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Create New Grade</DialogTitle>
                    </DialogHeader>
                    <CreateGradeForm onSuccess={() => setIsFirstGradeOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredGrades.map((grade) => (
            <GradeCard
              key={grade.id}
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
              onEditResource={handleEditResource}
              onAddBreadcrumb={(item) =>
                setBreadcrumbs([...breadcrumbs, item])
              }
              grades={grades}
              allSubjects={allSubjects}
              allTopics={allTopics}
            />
          ))
        )}
      </div>
      )}
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
  onEditResource: (resource: Resource) => void;
  onAddBreadcrumb: (item: BreadcrumbItem) => void;
  grades: GradeWithFullHierarchy[];
  allSubjects: SubjectWithTopics[];
  allTopics: TopicWithResources[];
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
  onEditResource,
  onAddBreadcrumb,
  grades,
  allSubjects,
  allTopics,
}: GradeCardProps) {
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isFirstSubjectOpen, setIsFirstSubjectOpen] = useState(false);

  return (
    <Card className="overflow-hidden w-full">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="pb-4 px-3 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto shrink-0">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0"
                style={{ backgroundColor: grade.color }}
              >
                {grade.gradeNumber}
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg truncate">{grade.title}</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {grade.subjects.length} subjects
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <Badge variant="secondary" className="text-xs shrink-0">{grade.level}</Badge>
              <Dialog open={isAddSubjectOpen} onOpenChange={setIsAddSubjectOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs px-2 sm:px-3 shrink-0">
                    <Plus className="h-3 w-3 mr-0 sm:mr-1" />
                    <span className="hidden sm:inline">Add Subject</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Subject to {grade.title}</DialogTitle>
                  </DialogHeader>
                  <CreateSubjectForm grades={[grade]} onSuccess={() => setIsAddSubjectOpen(false)} />
                </DialogContent>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="shrink-0 px-2">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Grade
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Grade
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 px-3 sm:px-6">
            {grade.subjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2" />
                <p>No subjects yet</p>
                <Dialog open={isFirstSubjectOpen} onOpenChange={setIsFirstSubjectOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-2">
                      <Plus className="h-3 w-3 mr-1" />
                      Add First Subject
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add Subject to {grade.title}</DialogTitle>
                    </DialogHeader>
                    <CreateSubjectForm grades={[grade]} onSuccess={() => setIsFirstSubjectOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="space-y-3 ml-2 sm:ml-4 border-l-2 border-muted pl-2 sm:pl-4">
                {grade.subjects.map((subject) => (
                  <SubjectItem
                    key={subject.id}
                    subject={subject}
                    isExpanded={expandedSubjects.has(subject.id)}
                    expandedTopics={expandedTopics}
                    onToggle={() => onToggleSubject(subject.id)}
                    onToggleTopic={onToggleTopic}
                    onDelete={() => onDeleteSubject(subject.id)}
                    onDeleteTopic={onDeleteTopic}
                    onDeleteResource={onDeleteResource}
                    onViewResource={onViewResource}
                    onEditResource={onEditResource}
                    grade={grade}
                    allSubjects={allSubjects}
                    allTopics={allTopics}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Subject Item Component
interface SubjectItemProps {
  subject: SubjectWithTopics;
  isExpanded: boolean;
  expandedTopics: Set<string>;
  onToggle: () => void;
  onToggleTopic: (topicId: string) => void;
  onDelete: () => void;
  onDeleteTopic: (topicId: string) => void;
  onDeleteResource: (resourceId: string) => void;
  onViewResource: (resource: Resource) => void;
  onEditResource: (resource: Resource) => void;
  grade: GradeWithFullHierarchy;
  allSubjects: SubjectWithTopics[];
  allTopics: TopicWithResources[];
}

function SubjectItem({
  subject,
  isExpanded,
  expandedTopics,
  onToggle,
  onToggleTopic,
  onDelete,
  onDeleteTopic,
  onDeleteResource,
  onViewResource,
  onEditResource,
  grade,
  allSubjects,
  allTopics,
}: SubjectItemProps) {
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [isFirstTopicOpen, setIsFirstTopicOpen] = useState(false);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto shrink-0">
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Folder className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <span className="text-lg sm:text-xl shrink-0">{subject.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm sm:text-base truncate">{subject.name}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {subject.topics.length} topics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Dialog open={isAddTopicOpen} onOpenChange={setIsAddTopicOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs px-2 sm:px-3">
                <Plus className="h-3 w-3 mr-0 sm:mr-1" />
                <span className="hidden sm:inline">Add Topic</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  Add Topic to {grade.title} &gt; {subject.name}
                </DialogTitle>
              </DialogHeader>
              <CreateTopicForm subjects={[subject]} onSuccess={() => setIsAddTopicOpen(false)} />
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="h-4 w-4 mr-2" />
                Edit Subject
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Subject
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CollapsibleContent>
        {subject.topics.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <FileText className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">No topics yet</p>
            <Dialog open={isFirstTopicOpen} onOpenChange={setIsFirstTopicOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="mt-2">
                  <Plus className="h-3 w-3 mr-1" />
                  Add First Topic
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    Add Topic to {grade.title} &gt; {subject.name}
                  </DialogTitle>
                </DialogHeader>
                <CreateTopicForm subjects={[subject]} onSuccess={() => setIsFirstTopicOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-2 ml-4 sm:ml-8 mt-2 border-l-2 border-muted pl-2 sm:pl-4">
            {subject.topics.map((topic) => (
              <TopicItem
                key={topic.id}
                topic={topic}
                isExpanded={expandedTopics.has(topic.id)}
                onToggle={() => onToggleTopic(topic.id)}
                onDelete={() => onDeleteTopic(topic.id)}
                onDeleteResource={onDeleteResource}
                onViewResource={onViewResource}
                onEditResource={onEditResource}
                grade={grade}
                subject={subject}
                allTopics={allTopics}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Topic Item Component
interface TopicItemProps {
  topic: TopicWithResources;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onDeleteResource: (resourceId: string) => void;
  onViewResource: (resource: Resource) => void;
  onEditResource: (resource: Resource) => void;
  grade: GradeWithFullHierarchy;
  subject: SubjectWithTopics;
  allTopics: TopicWithResources[];
}

function TopicItem({
  topic,
  isExpanded,
  onToggle,
  onDelete,
  onDeleteResource,
  onViewResource,
  onEditResource,
  grade,
  subject,
  allTopics,
}: TopicItemProps) {
  const [isAddResourceOpen, setIsAddResourceOpen] = useState(false);
  const [isFirstResourceOpen, setIsFirstResourceOpen] = useState(false);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-center justify-between p-2 rounded-lg bg-background hover:bg-muted/50 transition-colors gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-xs sm:text-sm truncate">{topic.title}</p>
            <p className="text-xs text-muted-foreground">
              {topic.resources.length} resources
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Dialog open={isAddResourceOpen} onOpenChange={setIsAddResourceOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs px-2 sm:px-3">
                <Plus className="h-3 w-3 mr-0 sm:mr-1" />
                <span className="hidden sm:inline">Add Resource</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  Add Resource to {grade.title} &gt; {subject.name} &gt;{" "}
                  {topic.title}
                </DialogTitle>
              </DialogHeader>
              <CreateResourceForm
                subjects={[subject]}
                topics={[topic]}
                onSuccess={() => setIsAddResourceOpen(false)}
              />
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="h-4 w-4 mr-2" />
                Edit Topic
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Topic
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <CollapsibleContent>
        {topic.resources.length === 0 ? (
          <div className="text-center py-3 text-muted-foreground">
            <Library className="h-5 w-5 mx-auto mb-1" />
            <p className="text-sm">No resources yet</p>
            <Dialog open={isFirstResourceOpen} onOpenChange={setIsFirstResourceOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="mt-2">
                  <Plus className="h-3 w-3 mr-1" />
                  Add First Resource
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    Add Resource to {grade.title} &gt; {subject.name} &gt;{" "}
                    {topic.title}
                  </DialogTitle>
                </DialogHeader>
                <CreateResourceForm subjects={[subject]} topics={[topic]} onSuccess={() => setIsFirstResourceOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-1 ml-4 sm:ml-8 mt-1">
            {topic.resources.map((resource) => (
              <ResourceItem
                key={resource.id}
                resource={resource}
                onDelete={() => onDeleteResource(resource.id)}
                onView={() => onViewResource(resource)}
                onEdit={() => onEditResource(resource)}
              />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Resource Item Component
interface ResourceItemProps {
  resource: Resource;
  onDelete: () => void;
  onView: (resource: Resource) => void;
  onEdit: (resource: Resource) => void;
}

function ResourceItem({ resource, onDelete, onView, onEdit }: ResourceItemProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors text-xs sm:text-sm gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Library className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{resource.title}</p>
          <p className="text-xs text-muted-foreground">{resource.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 sm:h-7 sm:w-7 p-0"
          onClick={() => onView(resource)}
        >
          <Eye className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 sm:h-7 sm:w-7 p-0"
          onClick={() => window.open(resource.url, "_blank")}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 sm:h-7 sm:w-7 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(resource)}>
              <Eye className="h-4 w-4 mr-2" />
              View Resource
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(resource)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Resource
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Resource
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
