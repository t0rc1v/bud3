"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
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
  const [grades, setGrades] = useState<GradeWithFullHierarchy[]>(initialGrades);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set()
  );
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [selectedGrade, setSelectedGrade] =
    useState<GradeWithFullHierarchy | null>(null);

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
    <div className="flex flex-col gap-6">
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
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Grade
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New Grade</DialogTitle>
              </DialogHeader>
              <CreateGradeForm />
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={expandAll}>
            <ChevronDownSquare className="h-4 w-4 mr-2" />
            Expand All
          </Button>
          <Button variant="outline" onClick={collapseAll}>
            <ChevronRightSquare className="h-4 w-4 mr-2" />
            Collapse All
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

      {/* Content Tree */}
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
                <Dialog>
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
                    <CreateGradeForm />
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
  onAddBreadcrumb,
  grades,
  allSubjects,
  allTopics,
}: GradeCardProps) {
  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: grade.color }}
              >
                {grade.gradeNumber}
              </div>
              <div>
                <CardTitle className="text-lg">{grade.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {grade.subjects.length} subjects
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{grade.level}</Badge>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-3 w-3 mr-1" />
                    Add Subject
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add Subject to {grade.title}</DialogTitle>
                  </DialogHeader>
                  <CreateSubjectForm grades={[grade]} />
                </DialogContent>
              </Dialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
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
          <CardContent className="pt-0">
            {grade.subjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2" />
                <p>No subjects yet</p>
                <Dialog>
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
                    <CreateSubjectForm grades={[grade]} />
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div className="space-y-3 ml-4 border-l-2 border-muted pl-4">
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
  grade,
  allSubjects,
  allTopics,
}: SubjectItemProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
        <div className="flex items-center gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Folder className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <span className="text-xl">{subject.icon}</span>
          <div>
            <p className="font-medium">{subject.name}</p>
            <p className="text-sm text-muted-foreground">
              {subject.topics.length} topics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Add Topic
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  Add Topic to {grade.title} &gt; {subject.name}
                </DialogTitle>
              </DialogHeader>
              <CreateTopicForm subjects={[subject]} />
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
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
            <Dialog>
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
                <CreateTopicForm subjects={[subject]} />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-2 ml-8 mt-2 border-l-2 border-muted pl-4">
            {subject.topics.map((topic) => (
              <TopicItem
                key={topic.id}
                topic={topic}
                isExpanded={expandedTopics.has(topic.id)}
                onToggle={() => onToggleTopic(topic.id)}
                onDelete={() => onDeleteTopic(topic.id)}
                onDeleteResource={onDeleteResource}
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
  grade,
  subject,
  allTopics,
}: TopicItemProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-center justify-between p-2 rounded-lg bg-background hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">{topic.title}</p>
            <p className="text-xs text-muted-foreground">
              {topic.resources.length} resources
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Plus className="h-3 w-3 mr-1" />
                Add Resource
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
              />
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
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
            <Dialog>
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
                <CreateResourceForm subjects={[subject]} topics={[topic]} />
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-1 ml-8 mt-1">
            {topic.resources.map((resource) => (
              <ResourceItem
                key={resource.id}
                resource={resource}
                onDelete={() => onDeleteResource(resource.id)}
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
}

function ResourceItem({ resource, onDelete }: ResourceItemProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors text-sm">
      <div className="flex items-center gap-3">
        <Library className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">{resource.title}</p>
          <p className="text-xs text-muted-foreground">{resource.type}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => window.open(resource.url, "_blank")}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
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
