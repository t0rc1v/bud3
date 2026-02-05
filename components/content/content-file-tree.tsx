"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
} from "lucide-react";
import {
  getGrades,
  getSubjects,
  getTopics,
  getResources,
} from "@/lib/actions/teacher";
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
} from "@/lib/types";

type TreeItemType = "grade" | "subject" | "topic" | "resource";

interface TreeItemData {
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
}) => {
  const isExpanded = expandedItems.has(item.id);
  const isSelected = selectedItem === item.id;
  const hasChildren = (item.children?.length ?? 0) > 0 || (item.childCount ?? 0) > 0;

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
  userRole: "teacher" | "learner";
}

export function ContentFileTree({ onItemSelect, className, userRole }: ContentFileTreeProps) {
  const [treeData, setTreeData] = useState<TreeItemData[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        getGrades(),
        getSubjects(),
        getTopics(),
        getResources(),
      ]);

      const validSubjects = subjectsData;
      const validTopics = topicsData;

      const tree = buildTreeData(gradesData, validSubjects as unknown as SubjectWithTopics[], validTopics as unknown as TopicWithResources[], resourcesData);
      setTreeData(tree);
    } catch (err) {
      setError("Failed to load data");
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [buildTreeData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
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
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium">Content Tree</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={expandAll}
            title="Expand All"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
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
    </div>
  );
}
