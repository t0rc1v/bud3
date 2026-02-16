"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface UnlockedResourcesContextType {
  unlockedResources: Set<string>;
  addUnlockedResource: (resourceId: string) => void;
  isResourceUnlocked: (resourceId: string) => boolean;
  refreshUnlockedResources: () => Promise<void>;
}

const UnlockedResourcesContext = createContext<UnlockedResourcesContextType | undefined>(undefined);

export function UnlockedResourcesProvider({ children }: { children: ReactNode }) {
  const [unlockedResources, setUnlockedResources] = useState<Set<string>>(new Set());

  const addUnlockedResource = useCallback((resourceId: string) => {
    setUnlockedResources(prev => {
      if (prev.has(resourceId)) return prev;
      return new Set([...prev, resourceId]);
    });
  }, []);

  const isResourceUnlocked = useCallback((resourceId: string) => {
    return unlockedResources.has(resourceId);
  }, [unlockedResources]);

  const refreshUnlockedResources = useCallback(async () => {
    try {
      const response = await fetch("/api/content/hierarchy-with-unlock-status");
      if (response.ok) {
        const data = await response.json();
        const unlockedIds = new Set<string>();
        
        // Extract unlocked resource IDs from the response
        data.levels?.forEach((level: { subjects?: { topics?: { resources?: { id: string; isUnlocked?: boolean }[] }[] }[] }) => {
          level.subjects?.forEach(subject => {
            subject.topics?.forEach(topic => {
              topic.resources?.forEach(resource => {
                if (resource.isUnlocked) {
                  unlockedIds.add(resource.id);
                }
              });
            });
          });
        });
        
        setUnlockedResources(unlockedIds);
      }
    } catch (error) {
      console.error("Failed to refresh unlocked resources:", error);
    }
  }, []);

  return (
    <UnlockedResourcesContext.Provider
      value={{
        unlockedResources,
        addUnlockedResource,
        isResourceUnlocked,
        refreshUnlockedResources,
      }}
    >
      {children}
    </UnlockedResourcesContext.Provider>
  );
}

export function useUnlockedResources() {
  const context = useContext(UnlockedResourcesContext);
  if (context === undefined) {
    throw new Error("useUnlockedResources must be used within a UnlockedResourcesProvider");
  }
  return context;
}
