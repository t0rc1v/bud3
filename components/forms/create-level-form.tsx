"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { createLevel } from "@/lib/actions/admin";
import { getUserByClerkId } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";


interface CreateLevelFormProps {
  onSuccess?: () => void;
}

export function CreateLevelForm({ onSuccess }: CreateLevelFormProps) {
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    levelNumber: 1,
    title: "",
    order: 1,
    color: "#3b82f6",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!clerkUser) {
        throw new Error("User not authenticated");
      }
      
      // Get user info from database
      const user = await getUserByClerkId(clerkUser.id);
      if (!user) {
        throw new Error("User not found");
      }
      
      await createLevel({
        ...formData,
        ownerId: user.id,
        ownerRole: user.role,
        visibility: "admin_and_regulars",
      });
      router.refresh();
      setFormData({
        levelNumber: 1,
        title: "",
        order: 1,
        color: "#3b82f6",
      });
      toast.success("Level created successfully");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create level:", error);
      toast.error("Failed to create level. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="levelNumber">Level Number</Label>
        <Input
          id="levelNumber"
          type="number"
          min={1}
          value={formData.levelNumber}
          onChange={(e) =>
            setFormData({ ...formData, levelNumber: parseInt(e.target.value) || 1 })
          }
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="e.g., Level 1, Form 1, etc."
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="order">Display Order</Label>
        <Input
          id="order"
          type="number"
          min={1}
          value={formData.order}
          onChange={(e) =>
            setFormData({ ...formData, order: parseInt(e.target.value) || 1 })
          }
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">Color</Label>
        <div className="flex items-center gap-2">
          <Input
            id="color"
            type="color"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            className="w-16 h-10 p-1"
          />
          <span className="text-sm text-muted-foreground">{formData.color}</span>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Creating..." : "Create Level"}
      </Button>
    </form>
  );
}
