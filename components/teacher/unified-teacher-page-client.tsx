"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Folder,
  Users,
  Eye,
  ExternalLink,
  ChevronDownSquare,
  ChevronRightSquare,
  ArrowLeft,
  Trash2,
  MoreVertical,
  Edit,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateResourceForm } from "@/components/admin/create-resource-form";
import { CreateTopicForm } from "@/components/admin/create-topic-form";
import { ResourceViewer, ResourceViewerSkeleton } from "@/components/admin/resource-viewer";
import { getResourceById } from "@/lib/actions/teacher";
import { addMyLearner, removeMyLearner, getMyLearners } from "@/lib/actions/teacher";
import type {
  GradeWithFullHierarchy,
  SubjectWithTopics,
  TopicWithResources,
  Resource,
} from "@/lib/types";
import { MyLearnerWithDetails } from "@/lib/actions/teacher";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
interface UnifiedTeacherPageClientProps {
  initialGrades: GradeWithFullHierarchy[];
  teacherId: string;
  myLearners: MyLearnerWithDetails[];
}
interface BreadcrumbItem {
  type: "grade" | "subject" | "topic" | "resource";
  id: string;
  name: string;
}
export function UnifiedTeacherPageClient({
  initialGrades,
  teacherId,
  myLearners: initialMyLearners,
}: UnifiedTeacherPageClientProps) {
  const router = useRouter();
  const [grades, setGrades] = useState<GradeWithFullHierarchy[]>(initialGrades);

  // Sync grades when initialGrades changes (after revalidation)
  useEffect(() => {
    setGrades(initialGrades);
  }, [initialGrades]);

  const [myLearnersList, setMyLearnersList] = useState<MyLearnerWithDetails[]>(initialMyLearners);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [selectedResource, setSelectedResource] = useState<ReturnType<typeof getResourceById> extends Promise<infer T> ? T : never>(null);
  const [isLoadingResource, setIsLoadingResource] = useState(false);
  const [openResourceInEditMode, setOpenResourceInEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState("content");
  const [isAddingLearner, setIsAddingLearner] = useState(false);
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
      learners: myLearnersList.length,
    };
  }, [grades, myLearnersList]);
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
  const handleViewResource = async (resource: Resource) => {
    setIsLoadingResource(true);
    try {
      const fullResource = await getResourceById(resource.id);
      if (fullResource) {
        setSelectedResource(fullResource);
      }
    } finally {
      setIsLoadingResource(false);
    }
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
  // My Learners handlers
  const handleAddLearner = async (email: string, gradeId: string) => {
    setIsAddingLearner(true);
    try {
      await addMyLearner(teacherId, email, gradeId);
      // Refresh my learners
      const updatedLearners = await getMyLearners(teacherId);
      setMyLearnersList(updatedLearners);
    } finally {
      setIsAddingLearner(false);
    }
  };
  const handleRemoveLearner = async (learnerId: string) => {
    if (confirm("Are you sure you want to remove this learner?")) {
      await removeMyLearner(teacherId, learnerId);
      const updatedLearners = await getMyLearners(teacherId);
      setMyLearnersList(updatedLearners);
    }
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
          Teacher Dashboard
        </h2>
        <p className="text-muted-foreground">
          View educational content and manage your learners
        </p>
      </div>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Grades</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.grades}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.subjects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Topics</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.topics}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resources</CardTitle>
            <Library className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resources}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Learners</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.learners}</div>
          </CardContent>
        </Card>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="learners">My Learners</TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="space-y-6">
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
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
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
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
                      : "Content will appear here when available"}
                  </p>
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
                  onViewResource={handleViewResource}
                  allSubjects={allSubjects}
                  allTopics={allTopics}
                />
              ))
            )}
          </div>
        </TabsContent>
        <TabsContent value="learners" className="space-y-6">
          <AddLearnerForm 
            grades={grades} 
            onAdd={handleAddLearner} 
            isLoading={isAddingLearner}
          />
          
          <LearnersList 
            learners={myLearnersList} 
            onRemove={handleRemoveLearner}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
// Add Learner Form Component
interface AddLearnerFormProps {
  grades: GradeWithFullHierarchy[];
  onAdd: (email: string, gradeId: string) => void;
  isLoading: boolean;
}
function AddLearnerForm({ grades, onAdd, isLoading }: AddLearnerFormProps) {
  const [email, setEmail] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("");
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !selectedGrade) {
      setError("Please fill in all fields");
      return;
    }
    onAdd(email, selectedGrade);
    setEmail("");
    setSelectedGrade("");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add New Learner</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="learnerEmail">Learner Email</Label>
            <Input
              id="learnerEmail"
              type="email"
              placeholder="learner@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade">Grade</Label>
            <Select value={selectedGrade} onValueChange={setSelectedGrade}>
              <SelectTrigger>
                <SelectValue placeholder="Select a grade" />
              </SelectTrigger>
              <SelectContent>
                {grades.map((grade) => (
                  <SelectItem key={grade.id} value={grade.id}>
                    {grade.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Adding..." : "Add Learner"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
// Learners List Component
interface LearnersListProps {
  learners: MyLearnerWithDetails[];
  onRemove: (learnerId: string) => void;
}
function LearnersList({ learners, onRemove }: LearnersListProps) {
  if (learners.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No learners yet</p>
          <p className="text-sm text-muted-foreground">
            Add learners using the form above to start tracking their progress
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">My Learners ({learners.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {learners.map((learner) => (
            <div
              key={learner.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{learner.learnerEmail}</p>
                  <p className="text-sm text-muted-foreground">
                    Grade: {learner.grade?.title || "Unknown"}
                  </p>
                  {learner.learner && (
                    <p className="text-xs text-muted-foreground">
                      Joined: {new Date(learner.learner.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Learner</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove {learner.learnerEmail} from your learners list?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onRemove(learner.learnerId)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
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
  onViewResource: (resource: Resource) => void;
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
  onViewResource,
  allSubjects,
  allTopics,
}: GradeCardProps) {
  return (
    <Card className="overflow-hidden w-full">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CardHeader className="pb-4 px-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
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
            <Badge variant="secondary" className="shrink-0 text-xs">
              {grade.level}
            </Badge>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 px-3 sm:px-6">
            {grade.subjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2" />
                <p>No subjects yet</p>
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
                    onViewResource={onViewResource}
                    grade={grade}
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
  onViewResource: (resource: Resource) => void;
  grade: GradeWithFullHierarchy;
  allTopics: TopicWithResources[];
}
function SubjectItem({
  subject,
  isExpanded,
  expandedTopics,
  onToggle,
  onToggleTopic,
  onViewResource,
  grade,
  allTopics,
}: SubjectItemProps) {
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
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="shrink-0 text-xs sm:text-sm px-2 sm:px-3">
              <Plus className="h-3 w-3 mr-0 sm:mr-1" />
              <span className="hidden sm:inline">Add Topic</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Topic to {grade.title} &gt; {subject.name}</DialogTitle>
            </DialogHeader>
            <CreateTopicForm subjects={[subject]} />
          </DialogContent>
        </Dialog>
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
                  <DialogTitle>Add Topic to {grade.title} &gt; {subject.name}</DialogTitle>
                </DialogHeader>
                <CreateTopicForm subjects={[subject]} />
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
                onViewResource={onViewResource}
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
  onViewResource: (resource: Resource) => void;
  grade: GradeWithFullHierarchy;
  subject: SubjectWithTopics;
  allTopics: TopicWithResources[];
}
function TopicItem({
  topic,
  isExpanded,
  onToggle,
  onViewResource,
  grade,
  subject,
  allTopics,
}: TopicItemProps) {
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
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="shrink-0 text-xs px-2 sm:px-3">
              <Plus className="h-3 w-3 mr-0 sm:mr-1" />
              <span className="hidden sm:inline">Add Resource</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                Add Resource to {grade.title} &gt; {subject.name} &gt; {topic.title}
              </DialogTitle>
            </DialogHeader>
            <CreateResourceForm
              subjects={[subject]}
              topics={[topic]}
            />
          </DialogContent>
        </Dialog>
      </div>
      <CollapsibleContent>
        {topic.resources.length === 0 ? (
          <div className="text-center py-3 text-muted-foreground">
            <Library className="h-5 w-5 mx-auto mb-1" />
            <p className="text-sm">No resources yet</p>
          </div>
        ) : (
          <div className="space-y-1 ml-4 sm:ml-8 mt-1">
            {topic.resources.map((resource) => (
              <div
                key={resource.id}
                className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors text-xs sm:text-sm gap-2"
              >
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
                    onClick={() => onViewResource(resource)}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}