import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface ContentTabCardProps {
  icon: LucideIcon;
  label: string;
  levelCount: number;
  subjectCount: number;
  resourceCount: number;
  isActive: boolean;
  onClick: () => void;
}

/**
 * Clickable stats card used in admin/super-admin dashboards to switch between content tabs.
 * Displays level/subject/resource counts and highlights when the tab is active.
 */
export function ContentTabCard({
  icon: Icon,
  label,
  levelCount,
  subjectCount,
  resourceCount,
  isActive,
  onClick,
}: ContentTabCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isActive && "ring-2 ring-primary ring-offset-2"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{levelCount}</div>
        <p className="text-xs text-muted-foreground mt-1">
          {subjectCount} subjects, {resourceCount} resources
        </p>
        <p className="text-xs text-foreground mt-1">
          {isActive ? "Currently viewing" : "Click to view"}
        </p>
      </CardContent>
    </Card>
  );
}
