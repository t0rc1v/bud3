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
  Search,
  FolderOpen,
  Folder,
  Users,
  Eye,
  ChevronDownSquare,
  ChevronRightSquare,
  Lock,
  Unlock,
  Coins,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditModal } from "@/components/credits/credit-modal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { ResourceUnlockModal } from "@/components/credits/resource-unlock-modal";
import { addMyLearner, removeMyLearner, getMyLearners } from "@/lib/actions/teacher";
import { ReadOnlyResourceViewer, ReadOnlyResourceViewerSkeleton } from "@/components/shared/read-only-resource-viewer";
import type {
  GradeWithFullHierarchy,
  SubjectWithTopics,
  TopicWithResources,
  Resource,
} from "@/lib/types";
import { MyLearnerWithDetails } from "@/lib/actions/teacher";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LockedResource {
  id: string;
  title: string;
  type: string;
  unlockFee: number;
  isUnlocked: boolean;
  description?: string;
  subjectName?: string;
  topicTitle?: string;
}

interface GradeData {
  id: string;
  title: string;
  subjects: {
    id: string;
    name: string;
    topics: {
      id: string;
      title: string;
      resources: LockedResource[];
    }[];
  }[];
}

interface UnifiedTeacherPageClientProps {
  initialGrades: GradeWithFullHierarchy[];
  teacherId: string;
  myLearners: MyLearnerWithDetails[];
}

export function UnifiedTeacherPageClient({
  initialGrades,
  teacherId,
  myLearners: initialMyLearners,
}: UnifiedTeacherPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [myLearnersList, setMyLearnersList] = useState<MyLearnerWithDetails[]>(initialMyLearners);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [viewingResource, setViewingResource] = useState<LockedResource | null>(null);
  const [activeTab, setActiveTab] = useState("content");
  const [isAddingLearner, setIsAddingLearner] = useState(false);
  const [balance, setBalance] = useState(0);

  // Handle viewResource query param from file tree dropdown
  useEffect(() => {
    const viewResourceId = searchParams.get("viewResource");
    if (viewResourceId && grades.length > 0) {
      // Find the resource in grades data
      for (const grade of grades) {
        for (const subject of grade.subjects) {
          for (const topic of subject.topics) {
            const resource = topic.resources.find(r => r.id === viewResourceId && r.isUnlocked);
            if (resource) {
              setViewingResource({
                ...resource,
                subjectName: subject.name,
                topicTitle: topic.title,
              });
              return;
            }
          }
        }
      }
    }
  }, [searchParams, grades]);

  // Load data with unlock status
  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load grades with unlock status (same endpoint as learners)
      const response = await fetch("/api/learner/grades-with-unlock-status");
      if (response.ok) {
        const data = await response.json();
        setGrades(data.grades || []);
      }

      // Load credit balance
      const balanceResponse = await fetch("/api/credits/balance");
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        if (balanceData.success) {
          setBalance(balanceData.balance);
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  // Handle viewing resource (only if unlocked)
  const handleViewResource = (resource: LockedResource, subjectName?: string, topicTitle?: string) => {
    if (!resource.isUnlocked) {
      // Cannot view locked resources
      return;
    }
    setViewingResource({ ...resource, subjectName, topicTitle });
  };

  const handleBackFromViewer = () => {
    setViewingResource(null);
  };

  // Handle unlock success
  const handleUnlockSuccess = async () => {
    await loadData();
  };

  // My Learners handlers
  const handleAddLearner = async (email: string, gradeId: string) => {
    setIsAddingLearner(true);
    try {
      await addMyLearner(teacherId, email, gradeId);
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

  // Calculate locked/unlocked stats
  const totalLockedResources = grades.reduce((acc, grade) => 
    acc + grade.subjects.reduce((subAcc, subject) => 
      subAcc + subject.topics.reduce((topAcc, topic) => 
        topAcc + topic.resources.filter(r => !r.isUnlocked).length, 0
      ), 0
    ), 0
  );

  const totalUnlockedResources = grades.reduce((acc, grade) => 
    acc + grade.subjects.reduce((subAcc, subject) => 
      subAcc + subject.topics.reduce((topAcc, topic) => 
        topAcc + topic.resources.filter(r => r.isUnlocked).length, 0
      ), 0
    ), 0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome, Teacher!</h2>
          <p className="text-gray-600">
            View educational content and manage your learners. Unlock content to access it.
          </p>
        </div>
        <CreditModal />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Credits</CardTitle>
            <Coins className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balance}</div>
            <p className="text-xs text-muted-foreground">credits available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Learners</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.learners}</div>
            <p className="text-xs text-muted-foreground">learners assigned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unlocked Content</CardTitle>
            <Unlock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnlockedResources}</div>
            <p className="text-xs text-muted-foreground">resources unlocked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locked Content</CardTitle>
            <Lock className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLockedResources}</div>
            <p className="text-xs text-muted-foreground">resources to unlock</p>
          </CardContent>
        </Card>
      </div>

      {/* Content or Resource Viewer */}
      {viewingResource ? (
        <ReadOnlyResourceViewer
          resourceId={viewingResource.id}
          resourceTitle={viewingResource.title}
          resourceType={viewingResource.type}
          resourceDescription={viewingResource.description}
          subjectName={viewingResource.subjectName}
          topicTitle={viewingResource.topicTitle}
          onBack={handleBackFromViewer}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="learners">My Learners</TabsTrigger>
          </TabsList>
          
          <TabsContent value="content" className="space-y-6">
            {/* Search and Actions */}
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

            {/* Content Browser with Locking */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Library className="h-5 w-5" />
                  Available Content
                </CardTitle>
                <CardDescription className="space-y-2">
                  <p>Browse and unlock content to view. Teachers must also pay to unlock resources.</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      <Lock className="h-3 w-3" />
                      Locked resources require unlock payment
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded">
                      <Unlock className="h-3 w-3" />
                      Unlocked resources can be viewed
                    </span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {grades.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No grades found</p>
                    <p className="text-sm text-muted-foreground">
                      Content will appear here when available
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredGrades.map((grade) => (
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
                        onUnlockSuccess={handleUnlockSuccess}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
      )}
    </div>
  );
}

// Grade Card Component
interface GradeCardProps {
  grade: GradeData;
  isExpanded: boolean;
  expandedSubjects: Set<string>;
  expandedTopics: Set<string>;
  onToggle: () => void;
  onToggleSubject: (subjectId: string) => void;
  onToggleTopic: (topicId: string) => void;
  onViewResource: (resource: LockedResource, subjectName?: string, topicTitle?: string) => void;
  onUnlockSuccess: () => void;
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
  onUnlockSuccess,
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
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base sm:text-lg truncate">{grade.title}</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {grade.subjects.length} subjects
                </p>
              </div>
            </div>
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
                    onUnlockSuccess={onUnlockSuccess}
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
  subject: GradeData["subjects"][0];
  isExpanded: boolean;
  expandedTopics: Set<string>;
  onToggle: () => void;
  onToggleTopic: (topicId: string) => void;
  onViewResource: (resource: LockedResource, subjectName?: string, topicTitle?: string) => void;
  onUnlockSuccess: () => void;
}

function SubjectItem({
  subject,
  isExpanded,
  expandedTopics,
  onToggle,
  onToggleTopic,
  onViewResource,
  onUnlockSuccess,
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
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm sm:text-base truncate">{subject.name}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {subject.topics.length} topics
            </p>
          </div>
        </div>
      </div>
      <CollapsibleContent>
        {subject.topics.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <FileText className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">No topics yet</p>
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
                onUnlockSuccess={onUnlockSuccess}
                subjectName={subject.name}
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
  topic: GradeData["subjects"][0]["topics"][0];
  isExpanded: boolean;
  onToggle: () => void;
  onViewResource: (resource: LockedResource, subjectName?: string, topicTitle?: string) => void;
  onUnlockSuccess: () => void;
  subjectName: string;
}

function TopicItem({
  topic,
  isExpanded,
  onToggle,
  onViewResource,
  onUnlockSuccess,
  subjectName,
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
      </div>
      <CollapsibleContent>
        {topic.resources.length === 0 ? (
          <div className="text-center py-3 text-muted-foreground">
            <Library className="h-5 w-5 mx-auto mb-1" />
            <p className="text-sm">No resources yet</p>
          </div>
        ) : (
          <div className="space-y-2 ml-2 sm:ml-8 mt-1">
            {topic.resources.map((resource) => (
              <div
                key={resource.id}
                className={cn(
                  "flex items-center justify-between p-2 sm:p-3 rounded-lg border gap-2 sm:gap-3 min-h-[52px] sm:min-h-[56px] touch-manipulation",
                  resource.isUnlocked 
                    ? "bg-green-50 border-green-200" 
                    : "bg-yellow-50 border-yellow-200"
                )}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="flex-shrink-0">
                    {resource.isUnlocked ? (
                      <Unlock className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    ) : (
                      <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm sm:text-base font-medium block truncate">{resource.title}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {resource.type}
                    </span>
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  {resource.isUnlocked ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewResource(resource, subjectName, topic.title)}
                      className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 min-w-[60px] sm:min-w-[70px]"
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
                      <span className="hidden sm:inline">View</span>
                      <span className="sm:hidden">View</span>
                    </Button>
                  ) : (
                    <ResourceUnlockModal
                      resourceId={resource.id}
                      resourceTitle={resource.title}
                      resourceType={resource.type}
                      unlockFeeKes={resource.unlockFee}
                      isUnlocked={resource.isUnlocked}
                      onUnlockSuccess={onUnlockSuccess}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Add Learner Form Component
interface AddLearnerFormProps {
  grades: GradeData[];
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
