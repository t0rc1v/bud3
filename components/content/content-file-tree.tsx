"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  GraduationCap,
  BookOpen,
  ChevronUp,
  Loader2,
  AlertCircle,
  Lock,
  Unlock,
  MoreVertical,
  Eye,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EditGradeForm } from "@/components/admin/edit-grade-form";
import { EditSubjectForm } from "@/components/admin/edit-subject-form";
import { EditTopicForm } from "@/components/admin/edit-topic-form";
import { EditResourceForm } from "@/components/admin/edit-resource-form";
import { CreateSubjectForm } from "@/components/admin/create-subject-form";
import { CreateTopicForm } from "@/components/admin/create-topic-form";
import { CreateResourceForm } from "@/components/admin/create-resource-form";
import { deleteGradeWithSession, deleteSubjectWithSession, deleteTopicWithSession, deleteResource } from "@/lib/actions/admin";
import type { GradeWithSubjects, SubjectWithTopics, TopicWithResources } from "@/lib/types";
import type { Grade, Subject, Topic, Resource, ResourceWithRelations } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type TreeItemType = "grade" | "subject" | "topic" | "resource";

export interface ResourceData {
  id: string;
  title: string;
  type: string;
  url: string;
  description?: string;
  unlockFee: number;
  isUnlocked: boolean;
  ownerId?: string;
}

interface TopicData {
  id: string;
  title: string;
  resources: ResourceData[];
  ownerId?: string;
}

interface SubjectData {
  id: string;
  name: string;
  topics: TopicData[];
  ownerId?: string;
}

interface GradeData {
  id: string;
  title: string;
  subjects: SubjectData[];
  ownerId?: string;
}

export interface TreeItemData {
  id: string;
  name: string;
  type: TreeItemType;
  data: GradeData | SubjectData | TopicData | ResourceData;
  children?: TreeItemData[];
  childCount?: number;
  isUnlocked?: boolean;
  unlockFee?: number;
  ownerId?: string;
}

interface TreeNodeProps {
  item: TreeItemData;
  level: number;
  expandedItems: Set<string>;
  selectedItem: string | null;
  onToggle: (id: string) => void;
  onSelect: (item: TreeItemData) => void;
  onViewResource?: (item: TreeItemData) => void;
  onAddResourceToChat?: (item: TreeItemData) => void;
  currentUserId?: string;
  onDelete?: (item: TreeItemData) => void;
  onEdit?: (item: TreeItemData) => void;
}

const getItemIcon = (type: TreeItemType, isUnlocked?: boolean) => {
  switch (type) {
    case "grade":
      return <GraduationCap className="h-4 w-4 text-blue-500" />;
    case "subject":
      return <BookOpen className="h-4 w-4 text-green-500" />;
    case "topic":
      return <Folder className="h-4 w-4 text-amber-500" />;
    case "resource":
      return isUnlocked ? (
        <Unlock className="h-4 w-4 text-green-500" />
      ) : (
        <Lock className="h-4 w-4 text-yellow-500" />
      );
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
  onViewResource,
  onAddResourceToChat,
  currentUserId,
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
  const isOwner = currentUserId && item.ownerId === currentUserId;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(item.id);
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

  const handleViewResource = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === "resource" && item.isUnlocked) {
      // Navigate with viewResource query param to open resource in main content
      const params = new URLSearchParams(searchParams.toString());
      params.set("viewResource", item.id);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
    onViewResource?.(item);
  };

  const getAddButton = () => {
    // Only show add buttons for owners
    if (!isOwner) return null;

    if (item.type === "grade") {
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
            <CreateSubjectForm
              grades={[{ ...(item.data as GradeData), subjects: [] } as unknown as GradeWithSubjects]}
              onSuccess={() => window.location.reload()}
            />
          </DialogContent>
        </Dialog>
      );
    }

    if (item.type === "subject") {
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
              subjects={[{ ...(item.data as SubjectData), topics: [], grade: { id: "", title: "" } } as unknown as SubjectWithTopics]}
              onSuccess={() => window.location.reload()}
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
              subjects={[]}
              topics={[{ ...(item.data as TopicData), resources: [], subject: { id: "", name: "" } } as unknown as TopicWithResources]}
              onSuccess={() => window.location.reload()}
            />
          </DialogContent>
        </Dialog>
      );
    }

    return null;
  };

  const getQuickActionsDropdown = () => {
    // Show dropdown for unlocked resources or for owners
    const showDropdown = (item.type === "resource" && item.isUnlocked) || isOwner;
    if (!showDropdown) {
      return null;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.type === "resource" && item.isUnlocked && (
            <>
              <DropdownMenuItem onClick={handleViewResource}>
                <Eye className="h-4 w-4 mr-2" />
                View Resource
              </DropdownMenuItem>
              {onAddResourceToChat && (
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
            </>
          )}
          {/* Management actions - only for owners */}
          {isOwner && (
            <>
              {/* Separator between resource actions and edit/delete */}
              {item.type === "resource" && item.isUnlocked && (
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
    );
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
          {getItemIcon(item.type, item.isUnlocked)}
          <span className="text-sm truncate">{item.name}</span>
          {item.type === "resource" && (
            <span className={cn(
              "text-xs ml-1",
              item.isUnlocked ? "text-green-600" : "text-yellow-600"
            )}>
              {item.isUnlocked ? "Unlocked" : `Ksh ${item.unlockFee}`}
            </span>
          )}
          {!isExpanded && item.childCount && item.childCount > 0 && (
            <span className="text-xs text-muted-foreground ml-1">
              ({item.childCount})
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {getAddButton()}
          {getQuickActionsDropdown()}
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
              onViewResource={onViewResource}
              onAddResourceToChat={onAddResourceToChat}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ContentFileTreeProps {
  onItemSelect?: (item: TreeItemData) => void;
  className?: string;
  userRole: "admin" | "regular";
  isOpen?: boolean;
  onViewResource?: (item: TreeItemData) => void;
  onAddResourceToChat?: (item: TreeItemData) => void;
  userId?: string;
}

export function ContentFileTree({ 
  onItemSelect, 
  className, 
  userRole, 
  isOpen = true,
  onViewResource,
  onAddResourceToChat,
  userId,
}: ContentFileTreeProps) {
  const [treeData, setTreeData] = useState<TreeItemData[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TreeItemData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<TreeItemData | null>(null);

  const buildTreeData = useCallback(
    (grades: GradeData[]): TreeItemData[] => {
      return grades.map((grade) => {
        const subjectTreeItems: TreeItemData[] = grade.subjects.map((subject) => {
          const topicTreeItems: TreeItemData[] = subject.topics.map((topic) => {
            const resourceTreeItems: TreeItemData[] = topic.resources?.map(
              (resource) => ({
                id: resource.id,
                name: resource.title,
                type: "resource",
                data: resource,
                isUnlocked: resource.isUnlocked,
                unlockFee: resource.unlockFee,
                ownerId: resource.ownerId,
              })
            ) || [];

            return {
              id: topic.id,
              name: topic.title,
              type: "topic",
              data: topic,
              children: resourceTreeItems,
              childCount: resourceTreeItems.length,
              ownerId: topic.ownerId,
            };
          });

          return {
            id: subject.id,
            name: subject.name,
            type: "subject",
            data: subject,
            children: topicTreeItems,
            childCount: topicTreeItems.length,
            ownerId: subject.ownerId,
          };
        });

        return {
          id: grade.id,
          name: grade.title,
          type: "grade",
          data: grade,
          children: subjectTreeItems,
          childCount: subjectTreeItems.length,
          ownerId: grade.ownerId,
        };
      });
    },
    []
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/content/hierarchy-with-unlock-status");
      if (!response.ok) {
        throw new Error("Failed to fetch content");
      }

      const data = await response.json();
      const tree = buildTreeData(data.grades);
      setTreeData(tree);
    } catch (err) {
      setError("Failed to load data");
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [buildTreeData]);

  useEffect(() => {
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

  const handleSelect = useCallback(
    (item: TreeItemData) => {
      setSelectedItem(item.id);
      if (onItemSelect) {
        onItemSelect(item);
      }
    },
    [onItemSelect]
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
        <div className="flex items-center justify-between py-2">
          <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
          <div className="flex gap-1">
            <div className="h-6 w-6 bg-muted rounded animate-pulse"></div>
            <div className="h-6 w-6 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2 p-2">
            <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
            <div className="h-4 w-4 bg-muted rounded-full animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-32 animate-pulse"></div>
          </div>
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

      {/* Legend */}
      <div className="px-3 py-2 border-b text-xs text-muted-foreground flex gap-3">
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3 text-yellow-500" /> Locked
        </span>
        <span className="flex items-center gap-1">
          <Unlock className="h-3 w-3 text-green-500" /> Unlocked
        </span>
      </div>

      {/* Tree Content */}
      <ScrollArea className="flex-1">
        <div className="p-2" role="tree">
          {treeData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No grades found</p>
              <p className="text-xs mt-1">Content will appear here when available</p>
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
                onViewResource={onViewResource}
                onAddResourceToChat={onAddResourceToChat}
                currentUserId={userId}
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
              grade={itemToEdit.data as unknown as Grade} 
              onSuccess={handleEditSuccess}
            />
          )}
          {itemToEdit?.type === "subject" && (
            <EditSubjectForm 
              subject={itemToEdit.data as unknown as Subject}
              grades={[]}
              onSuccess={handleEditSuccess}
            />
          )}
          {itemToEdit?.type === "topic" && (
            <EditTopicForm 
              topic={itemToEdit.data as unknown as Topic}
              subjects={[]}
              onSuccess={handleEditSuccess}
            />
          )}
          {itemToEdit?.type === "resource" && (
            <EditResourceForm 
              resource={itemToEdit.data as unknown as ResourceWithRelations}
              subjects={[]}
              topics={[]}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
