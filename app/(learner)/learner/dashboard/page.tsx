"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Lock, 
  Unlock, 
  Coins, 
  Loader2,
  CreditCard,
  MessageSquare,
  Library,
  Eye,
  FileText,
  Video,
  Headphones,
  Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreditModal } from "@/components/credits/credit-modal";
import { ResourceUnlockModal } from "@/components/credits/resource-unlock-modal";
import { ReadOnlyResourceViewer, ReadOnlyResourceViewerSkeleton } from "@/components/shared/read-only-resource-viewer";

interface LockedResource {
  id: string;
  title: string;
  type: string;
  description?: string;
  unlockFee: number;
  isUnlocked: boolean;
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

const ResourceTypeIcons = {
  notes: FileText,
  video: Video,
  audio: Headphones,
  image: ImageIcon,
};

export default function LearnerDashboard() {
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [viewingResource, setViewingResource] = useState<LockedResource | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load credit balance
      const balanceResponse = await fetch("/api/credits/balance");
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        if (balanceData.success) {
          setBalance(balanceData.balance);
        }
      }

      // Load grades with unlock status
      const gradesResponse = await fetch("/api/learner/grades-with-unlock-status");
      if (gradesResponse.ok) {
        const gradesData = await gradesResponse.json();
        setGrades(gradesData.grades || []);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockSuccess = async () => {
    // Refresh balance and data after successful unlock
    await loadData();
  };

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
          <h2 className="text-2xl font-bold text-gray-900">Welcome, Learner!</h2>
          <p className="text-gray-600">
            Access your courses, unlock content, and continue your learning journey.
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
            <CardTitle className="text-sm font-medium">AI Responses</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{balance}</div>
            <p className="text-xs text-muted-foreground">responses available</p>
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
        <>
          {/* Content Browser with Locking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Library className="h-5 w-5" />
                Available Content
              </CardTitle>
              <CardDescription className="space-y-2">
                <p>Browse and unlock content to view and add to your AI chat.</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                    <Lock className="h-3 w-3" />
                    Locked resources require unlock payment
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded">
                    <Unlock className="h-3 w-3" />
                    Unlocked resources can be viewed and used in AI chat
                  </span>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {grades.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Library className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No content available yet</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {grades.map((grade) => (
                    <div key={grade.id} className="border rounded-lg p-3 sm:p-4">
                      <h3 className="font-semibold text-base sm:text-lg mb-2 sm:mb-3">{grade.title}</h3>
                      <div className="space-y-2 sm:space-y-3">
                        {grade.subjects.map((subject) => (
                          <div key={subject.id} className="ml-2 sm:ml-4">
                            <h4 className="font-medium text-sm text-muted-foreground mb-1 sm:mb-2">
                              {subject.name}
                            </h4>
                            <div className="space-y-2 sm:space-y-3">
                              {subject.topics.map((topic) => (
                                <div key={topic.id} className="ml-2 sm:ml-4">
                                  <h5 className="text-xs sm:text-sm font-medium mb-1 sm:mb-2 text-muted-foreground">{topic.title}</h5>
                                  <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                    {topic.resources.map((resource) => (
                                      <ResourceCard
                                        key={resource.id}
                                        resource={resource}
                                        subjectName={subject.name}
                                        topicTitle={topic.title}
                                        onView={handleViewResource}
                                        onUnlockSuccess={handleUnlockSuccess}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Buy Credits Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Need More Credits?</CardTitle>
              <CreditCard className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Purchase credits to unlock content and access AI features
              </p>
              <CreditModal trigger={
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Buy Credits
                </Button>
              } />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// Resource Card Component
function ResourceCard({
  resource,
  subjectName,
  topicTitle,
  onView,
  onUnlockSuccess,
}: {
  resource: LockedResource;
  subjectName: string;
  topicTitle: string;
  onView: (resource: LockedResource, subjectName?: string, topicTitle?: string) => void;
  onUnlockSuccess: () => void;
}) {
  return (
    <div
      className={cn(
        "p-3 sm:p-4 rounded-lg border flex items-center justify-between gap-2 sm:gap-3 min-h-[60px] touch-manipulation",
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
            onClick={() => onView(resource, subjectName, topicTitle)}
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
  );
}


