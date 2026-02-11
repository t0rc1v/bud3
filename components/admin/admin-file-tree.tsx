"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  GraduationCap,
  BookOpen,
  MoreHorizontal,
  ChevronUp,
  Loader2,
  AlertCircle,
  Eye,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getGradesForUser,
  getSubjectsForUser,
  getTopicsForUser,
  getResourcesForUser,
  createSubject,
  createTopic,
  createResource,
  deleteGradeWithSession,
  deleteSubjectWithSession,
  deleteTopicWithSession,
  deleteResource,
} from "@/lib/actions/admin";
import type { UserRole } from "@/lib/types";
import type {
  Grade,
  Subject,
  Topic,
  Resource,
  GradeWithSubjects,
  SubjectWithTopics,
  TopicWithResources,
  SubjectWithTopicsAndGrade,
  TopicWithResourcesAndSubject,
  ResourceWithRelations,
} from "@/lib/types";
import { CreateSubjectForm } from "./create-subject-form";
import { CreateTopicForm } from "./create-topic-form";
import { CreateResourceForm } from "./create-resource-form";
import { EditGradeForm } from "./edit-grade-form";
import { EditSubjectForm } from "./edit-subject-form";
import { EditTopicForm } from "./edit-topic-form";
import { EditResourceForm } from "./edit-resource-form";

export type TreeItemType = "grade" | "subject" | "topic" | "resource";

export interface TreeItemData {
  id: string;
  name: string;
  type: TreeItemType;
  data: Grade | Subject | Topic | Resource;
  children?: TreeItemData[];
  childCount?: number;
}

interface TreeNodeProps {
  item: TreeItemData;
  level: number;
  expandedItems: Set<string>;
  selectedItem: string | null;
  onToggle: (id: string) => void;
  onSelect: (item: TreeItemData) => void;
  onRefresh: () => void;
  allSubjects: SubjectWithTopicsAndGrade[];
  allTopics: TopicWithResourcesAndSubject[];
  onViewResource?: (item: TreeItemData) => void;
  onAddResourceToChat?: (item: TreeItemData) => void;
  currentUserId: string;
  currentUserRole: UserRole;
  onDelete?: (item: TreeItemData) => void;
  onEdit?: (item: TreeItemData) => void;
}

const getItemIcon = (type: TreeItemType) => {
  switch (type) {
    case "grade":
      return <GraduationCap className="h-4 w-4 text-blue-500" />;
    case "subject":
      return <BookOpen className="h-4 w-4 text-green-500" />;
    case "topic":
      return <Folder className="h-4 w-4 text-amber-500" />;
    case "resource":
      return <FileText className="h-4 w-4 text-gray-500" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const TreeNode: React.FC<TreeNodeProps> = ({
  item,
  level,
  expandedItems,
  selectedItem,
  onToggle,
  onSelect,
  onRefresh,
  allSubjects,
  allTopics,
  onViewResource,
  onAddResourceToChat,
  currentUserId,
  currentUserRole,
  onDelete,
  onEdit,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isExpanded = expandedItems.has(item.id);
  const isSelected = selectedItem === item.id;
  const hasChildren = (item.children?.length ?? 0) > 0 || (item.childCount ?? 0) > 0;

  // Check if current user owns this item (for management permissions)
  // Super-admin can manage all content regardless of ownership
  const isOwner = item.data.ownerId === currentUserId || currentUserRole === "super_admin";

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(item.id);
  };

  const handleViewResource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === "resource") {
      // Navigate with viewResource query param to open resource in main content
      const params = new URLSearchParams(searchParams.toString());
      params.set("viewResource", item.id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
    onViewResource?.(item);
  };

  const handleSelect = () => {
    onSelect(item);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect();
    } else if (e.key === "ArrowRight" && hasChildren && !isExpanded) {
      e.preventDefault();
      onToggle(item.id);
    } else if (e.key === "ArrowLeft" && isExpanded) {
      e.preventDefault();
      onToggle(item.id);
    }
  };

  const getAddButton = () => {
    // Only show add buttons for owned content (not for public/super_admin content viewed by admin)
    if (!isOwner) return null;
    
    if (item.type === "grade") {
      const gradeSubjects = allSubjects.filter(
        (s) => s.gradeId === item.id
      );
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Subject</DialogTitle>
            </DialogHeader>
            <CreateSubjectForm grades={[{ ...item.data, subjects: [] } as GradeWithSubjects]} onSuccess={onRefresh} />
          </DialogContent>
        </Dialog>
      );
    }

    if (item.type === "subject") {
      const subjectTopics = allTopics.filter(
        (t) => t.subjectId === item.id
      );
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Topic</DialogTitle>
            </DialogHeader>
            <CreateTopicForm
              subjects={[{ ...item.data, topics: [], grade: {} as Grade } as unknown as SubjectWithTopics]}
              onSuccess={onRefresh}
            />
          </DialogContent>
        </Dialog>
      );
    }

    if (item.type === "topic") {
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Resource</DialogTitle>
            </DialogHeader>
            <CreateResourceForm
              subjects={allSubjects as unknown as SubjectWithTopics[]}
              topics={[{ ...item.data, resources: [], subject: {} as Subject } as unknown as TopicWithResources]}
              onSuccess={onRefresh}
            />
          </DialogContent>
        </Dialog>
      );
    }

    return null;
  };

  const paddingLeft = level * 16;

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-accent hover:text-accent-foreground",
          isSelected && "bg-accent text-accent-foreground"
        )}
        style={{ paddingLeft: `${paddingLeft + 8}px` }}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-5 w-5 p-0 transition-transform",
            !hasChildren && "invisible"
          )}
          onClick={handleToggle}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getItemIcon(item.type)}
          <span className="text-sm truncate">{item.name}</span>
          {!isExpanded && item.childCount && item.childCount > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({item.childCount})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {getAddButton()}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Resource-specific actions for all resource items */}
              {item.type === "resource" && (
                <DropdownMenuItem onClick={handleViewResource}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Resource
                </DropdownMenuItem>
              )}
              {item.type === "resource" && onAddResourceToChat && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddResourceToChat(item);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Chat
                </DropdownMenuItem>
              )}
              {/* Management actions - only for owners */}
              {isOwner && (
                <>
                  {/* Separator between resource actions and edit/delete */}
                  {item.type === "resource" && (
                    <DropdownMenuSeparator />
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(item);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(item);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isExpanded && item.children && (
        <div role="group">
          {item.children.map((child) => (
            <TreeNode
              key={child.id}
              item={child}
              level={level + 1}
              expandedItems={expandedItems}
              selectedItem={selectedItem}
              onToggle={onToggle}
              onSelect={onSelect}
              onRefresh={onRefresh}
              allSubjects={allSubjects}
              allTopics={allTopics}
              onViewResource={onViewResource}
              onAddResourceToChat={onAddResourceToChat}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface AdminFileTreeProps {
  onItemSelect?: (item: TreeItemData) => void;
  className?: string;
  isOpen?: boolean;
  onViewResource?: (item: TreeItemData) => void;
  onAddResourceToChat?: (item: TreeItemData) => void;
  userId: string;
  userRole: UserRole;
}

export function AdminFileTree({ 
  onItemSelect, 
  className, 
  isOpen = true,
  onViewResource,
  onAddResourceToChat,
  userId,
  userRole,
}: AdminFileTreeProps) {
  const [treeData, setTreeData] = useState<TreeItemData[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<TreeItemData[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectWithTopicsAndGrade[]>([]);
  const [allTopics, setAllTopics] = useState<TopicWithResourcesAndSubject[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TreeItemData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<TreeItemData | null>(null);

  const buildTreeData = useCallback(
    (
      grades: GradeWithSubjects[],
      subjects: SubjectWithTopics[],
      topics: TopicWithResources[],
      resources: Resource[]
    ): TreeItemData[] => {
      return grades.map((grade) => {
        const gradeSubjects = subjects.filter((s) => s.gradeId === grade.id);
        const subjectTreeItems: TreeItemData[] = gradeSubjects.map((subject) => {
          const subjectTopics = topics.filter((t) => t.subjectId === subject.id);
          const topicTreeItems: TreeItemData[] = subjectTopics.map((topic) => {
            const topicResources = resources.filter(
              (r) => r.topicId === topic.id
            );
            const resourceTreeItems: TreeItemData[] = topicResources.map(
              (resource) => ({
                id: resource.id,
                name: resource.title,
                type: "resource",
                data: resource,
              })
            );

            return {
              id: topic.id,
              name: topic.title,
              type: "topic",
              data: topic,
              children: resourceTreeItems,
              childCount: resourceTreeItems.length,
            };
          });

          return {
            id: subject.id,
            name: subject.name,
            type: "subject",
            data: subject,
            children: topicTreeItems,
            childCount: topicTreeItems.length,
          };
        });

        return {
          id: grade.id,
          name: grade.title,
          type: "grade",
          data: grade,
          children: subjectTreeItems,
          childCount: subjectTreeItems.length,
        };
      });
    },
    []
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [gradesData, subjectsData, topicsData, resourcesData] = await Promise.all([
        getGradesForUser(userId, userRole),
        getSubjectsForUser(userId, userRole),
        getTopicsForUser(userId, userRole),
        getResourcesForUser(userId, userRole),
      ]);

      // All subjects and topics are valid since we're fetching all
      const validSubjects = subjectsData;
      const validTopics = topicsData;

      setAllSubjects(validSubjects as unknown as SubjectWithTopicsAndGrade[]);
      setAllTopics(validTopics as unknown as TopicWithResourcesAndSubject[]);
      setAllResources(resourcesData);

      const tree = buildTreeData(gradesData, validSubjects as unknown as SubjectWithTopics[], validTopics as unknown as TopicWithResources[], resourcesData);
      setTreeData(tree);
    } catch (err) {
      setError("Failed to load data");
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [buildTreeData, userId, userRole]);

  useEffect(() => {
    // Only load data when sidebar is open
    if (isOpen) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [fetchData, isOpen]);

  const handleToggle = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const findItemInTree = useCallback(
    (items: TreeItemData[], targetId: string): TreeItemData | null => {
      for (const item of items) {
        if (item.id === targetId) return item;
        if (item.children) {
          const found = findItemInTree(item.children, targetId);
          if (found) return found;
        }
      }
      return null;
    },
    []
  );

  const buildBreadcrumb = useCallback(
    (items: TreeItemData[], targetId: string): TreeItemData[] => {
      for (const item of items) {
        if (item.id === targetId) return [item];
        if (item.children) {
          const path = buildBreadcrumb(item.children, targetId);
          if (path.length > 0) return [item, ...path];
        }
      }
      return [];
    },
    []
  );

  const handleSelect = useCallback(
    (item: TreeItemData) => {
      setSelectedItem(item.id);
      setBreadcrumb(buildBreadcrumb(treeData, item.id));
      if (onItemSelect) {
        onItemSelect(item);
      }
    },
    [treeData, onItemSelect, buildBreadcrumb]
  );

  const handleDelete = async () => {
    if (!itemToDelete) return;

    setIsDeleting(true);
    try {
      switch (itemToDelete.type) {
        case "grade":
          await deleteGradeWithSession(itemToDelete.id);
          break;
        case "subject":
          await deleteSubjectWithSession(itemToDelete.id);
          break;
        case "topic":
          await deleteTopicWithSession(itemToDelete.id);
          break;
        case "resource":
          await deleteResource(itemToDelete.id);
          break;
      }
      await fetchData();
      if (selectedItem === itemToDelete.id) {
        setSelectedItem(null);
        setBreadcrumb([]);
      }
      setIsDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (item: TreeItemData) => {
    setItemToDelete(item);
    setIsDeleteDialogOpen(true);
  };

  const openEditDialog = (item: TreeItemData) => {
    setItemToEdit(item);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setItemToEdit(null);
    fetchData();
  };

  const expandAll = () => {
    const collectIds = (items: TreeItemData[]): string[] => {
      return items.flatMap((item) => [
        item.id,
        ...(item.children ? collectIds(item.children) : []),
      ]);
    };
    setExpandedItems(new Set(collectIds(treeData)));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  if (isLoading) {
    return (
      <div className={cn("flex flex-col h-full p-3 space-y-2", className)}>
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between py-2">
          <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
          <div className="flex gap-1">
            <div className="h-6 w-6 bg-muted rounded animate-pulse"></div>
            <div className="h-6 w-6 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
        {/* Tree items skeleton */}
        <div className="space-y-2 flex-1">
          {/* Grade 1 */}
          <div className="flex items-center gap-2 p-2">
            <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 w-4 bg-muted rounded-full animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
          </div>
          {/* Grade 1 subjects */}
          <div className="space-y-1.5 pl-6">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 bg-muted rounded w-24 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 bg-muted rounded w-28 animate-pulse"></div>
            </div>
          </div>
          {/* Grade 2 */}
          <div className="flex items-center gap-2 p-2">
            <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 w-4 bg-muted rounded-full animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-28 animate-pulse"></div>
          </div>
          {/* Grade 3 */}
          <div className="flex items-center gap-2 p-2">
            <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 w-4 bg-muted rounded-full animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-36 animate-pulse"></div>
          </div>
          {/* Grade 3 subjects */}
          <div className="space-y-1.5 pl-6">
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 bg-muted rounded w-20 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 bg-muted rounded w-24 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse"></div>
              <div className="h-3.5 bg-muted rounded w-22 animate-pulse"></div>
            </div>
          </div>
        </div>
        {/* Status bar skeleton */}
        <div className="flex items-center justify-between py-2 border-t">
          <div className="h-3 bg-muted rounded w-16 animate-pulse"></div>
          <div className="h-3 bg-muted rounded w-20 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 p-4 text-destructive",
          className
        )}
      >
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
        <Button variant="outline" size="sm" onClick={fetchData}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)} suppressHydrationWarning>
      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground border-b">
          {breadcrumb.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <ChevronRight className="h-3 w-3" />}
              <span
                className={cn(
                  index === breadcrumb.length - 1 &&
                    "text-foreground font-medium"
                )}
              >
                {item.name}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Content Tree</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-6 sm:w-6"
            onClick={expandAll}
            title="Expand All"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-6 sm:w-6"
            onClick={collapseAll}
            title="Collapse All"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tree Content */}
      <ScrollArea className="flex-1">
        <div className="p-2" role="tree">
          {treeData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No grades found</p>
              <p className="text-xs mt-1">Create a grade to get started</p>
            </div>
          ) : (
            treeData.map((item) => (
              <TreeNode
                key={item.id}
                item={item}
                level={0}
                expandedItems={expandedItems}
                selectedItem={selectedItem}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onRefresh={fetchData}
                allSubjects={allSubjects}
                allTopics={allTopics}
                onViewResource={onViewResource}
                onAddResourceToChat={onAddResourceToChat}
                currentUserId={userId}
                currentUserRole={userRole}
                onDelete={openDeleteDialog}
                onEdit={openEditDialog}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-t">
        <span>
          {treeData.length} grade{treeData.length !== 1 ? "s" : ""}
        </span>
        <span>{expandedItems.size} expanded</span>
      </div>

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
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
              grades={allSubjects as unknown as GradeWithSubjects[]}
              onSuccess={handleEditSuccess}
            />
          )}
          {itemToEdit?.type === "topic" && (
            <EditTopicForm 
              topic={itemToEdit.data as Topic}
              subjects={allSubjects as unknown as SubjectWithTopics[]}
              onSuccess={handleEditSuccess}
            />
          )}
          {itemToEdit?.type === "resource" && (
            <EditResourceForm 
              resource={itemToEdit.data as unknown as ResourceWithRelations}
              subjects={allSubjects.map(s => ({ id: s.id, name: s.name, grade: { id: s.gradeId, title: "Grade" } }))}
              topics={allTopics.map(t => ({ id: t.id, title: t.title, subjectId: t.subjectId }))}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
