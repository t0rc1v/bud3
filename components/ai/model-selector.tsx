"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { ModelConfig, CapabilityTier } from "@/lib/ai/models";

const TIER_STYLES: Record<CapabilityTier, string> = {
  fast:     'bg-green-500/15 text-green-700 dark:text-green-400',
  balanced: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  powerful: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
};

const STORAGE_KEY = 'ai_model_preference';

interface ModelSelectorProps {
  selectedModelId: string | null;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({ selectedModelId, onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelConfig[]>([]);

  useEffect(() => {
    fetch('/api/chat/models')
      .then(r => r.ok ? r.json() : { models: [] })
      .then(({ models: list }: { models: ModelConfig[] }) => setModels(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (models.length === 0) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    const valid = stored && models.some(m => m.id === stored) ? stored : models[0].id;
    onModelChange(valid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  if (models.length === 0) return null;

  const selected = models.find(m => m.id === selectedModelId);
  const shortName = selected ? selected.name.split(' ')[0] : 'Model';

  // Group models by provider
  const byProvider = models.reduce<Record<string, ModelConfig[]>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  const PROVIDER_LABELS: Record<string, string> = {
    openai: 'OpenAI',
    google: 'Google',
    anthropic: 'Anthropic',
  };

  function handleSelect(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    onModelChange(id);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors max-w-[7rem] truncate">
          <span className="truncate">{shortName}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
          Select Model
        </DropdownMenuLabel>
        {Object.entries(byProvider).map(([provider, list]) => (
          <div key={provider}>
            <DropdownMenuLabel className="text-xs font-semibold px-2 py-1">
              {PROVIDER_LABELS[provider] ?? provider}
            </DropdownMenuLabel>
            {list.map(m => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => handleSelect(m.id)}
                className="flex items-start gap-2 py-2 cursor-pointer"
              >
                <Check className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${m.id === selectedModelId ? 'opacity-100' : 'opacity-0'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{m.name}</span>
                    <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 shrink-0 border-0 ${TIER_STYLES[m.tier]}`}>
                      {m.tier}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.description}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
