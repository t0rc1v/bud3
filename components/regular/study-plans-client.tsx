"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, CheckCircle, Clock, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface StudyPlan {
  id: string;
  title: string;
  subject: string;
  status: string;
  createdAt: string;
}

interface ActivePlan {
  id: string;
  title: string;
  totalTasks: number;
  completedTasks: number;
}

interface PlanTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/15 text-green-700 border-green-500/30",
  completed: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  paused: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
};

export function StudyPlansClient() {
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PlanTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [loggingTaskId, setLoggingTaskId] = useState<string | null>(null);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [newWeeklyHours, setNewWeeklyHours] = useState("");

  const fetchPlans = useCallback(() => {
    Promise.all([
      fetch("/api/ai/study-plans").then((r) => r.json()),
      fetch("/api/ai/study-plans/active").then((r) => r.json()),
    ])
      .then(([plansData, activeData]) => {
        if (plansData?.plans) setPlans(plansData.plans);
        if (activeData?.plan) setActivePlan(activeData.plan);
      })
      .catch(() => {
        toast.error("Failed to load study plans");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const fetchTasks = useCallback((planId: string) => {
    setIsLoadingTasks(true);
    fetch(`/api/ai/study-plans/${planId}/progress`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.tasks) setTasks(d.tasks);
      })
      .catch(() => {
        toast.error("Failed to load tasks");
      })
      .finally(() => setIsLoadingTasks(false));
  }, []);

  function handleExpandPlan(planId: string) {
    if (expandedPlanId === planId) {
      setExpandedPlanId(null);
      setTasks([]);
      return;
    }
    setExpandedPlanId(planId);
    fetchTasks(planId);
  }

  async function handleLogProgress(planId: string, taskId: string) {
    setLoggingTaskId(taskId);
    try {
      const res = await fetch(`/api/ai/study-plans/${planId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) {
        toast.error("Failed to log progress");
        return;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t))
      );
      if (activePlan && activePlan.id === planId) {
        setActivePlan((prev) =>
          prev ? { ...prev, completedTasks: prev.completedTasks + 1 } : prev
        );
      }
      toast.success("Progress logged");
    } catch {
      toast.error("Failed to log progress");
    } finally {
      setLoggingTaskId(null);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim() || !newSubject.trim()) {
      toast.error("Title and subject are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/ai/study-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          subject: newSubject.trim(),
          level: newLevel.trim() || undefined,
          weeklyHoursTarget: newWeeklyHours ? Number(newWeeklyHours) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      toast.success("Study plan created");
      setCreateOpen(false);
      setNewTitle("");
      setNewSubject("");
      setNewLevel("");
      setNewWeeklyHours("");
      setIsLoading(true);
      fetchPlans();
    } catch {
      toast.error("Failed to create study plan");
    } finally {
      setCreating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const progressPercent =
    activePlan && activePlan.totalTasks > 0
      ? Math.round((activePlan.completedTasks / activePlan.totalTasks) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Study Plans</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Plan
        </Button>
      </div>

      {activePlan && (
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">{activePlan.title}</CardTitle>
              <Badge className="bg-green-500/15 text-green-700 border-green-500/30 ml-auto">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {activePlan.completedTasks} / {activePlan.totalTasks} tasks
                </span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} />
            </div>
          </CardContent>
        </Card>
      )}

      {plans.length === 0 && !activePlan ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No study plans yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first study plan to get started.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Study Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => handleExpandPlan(plan.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.title}</CardTitle>
                  <Badge
                    className={
                      STATUS_STYLES[plan.status] ?? STATUS_STYLES.paused
                    }
                  >
                    {plan.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {plan.subject}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Created {new Date(plan.createdAt).toLocaleDateString()}
                </p>

                {expandedPlanId === plan.id && (
                  <div className="mt-4 space-y-2 border-t pt-4">
                    {isLoadingTasks ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No tasks in this plan.
                      </p>
                    ) : (
                      tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-2 rounded-md border p-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {task.completed ? (
                              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p
                                className={`text-sm truncate ${task.completed ? "line-through text-muted-foreground" : ""}`}
                              >
                                {task.title}
                              </p>
                              {task.dueDate && (
                                <p className="text-xs text-muted-foreground">
                                  Due{" "}
                                  {new Date(task.dueDate).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {!task.completed && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loggingTaskId === task.id}
                              onClick={() => handleLogProgress(plan.id, task.id)}
                            >
                              {loggingTaskId === task.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Log Progress"
                              )}
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Study Plan Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Study Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Title</label>
              <Input
                placeholder="e.g. Exam Preparation"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Subject</label>
              <Input
                placeholder="e.g. Mathematics"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Level <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                placeholder="e.g. Form 3"
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Weekly Hours Target{" "}
                <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                type="number"
                min={1}
                max={80}
                placeholder="e.g. 10"
                value={newWeeklyHours}
                onChange={(e) => setNewWeeklyHours(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Create Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
