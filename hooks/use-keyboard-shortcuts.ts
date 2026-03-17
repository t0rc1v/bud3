"use client";

import { useEffect } from "react";

interface KeyboardShortcutsOptions {
  onToggleLeftSidebar?: () => void;
  onToggleRightSidebar?: () => void;
  onFocusSearch?: () => void;
  onClosePanel?: () => void;
}

export function useKeyboardShortcuts({
  onToggleLeftSidebar,
  onToggleRightSidebar,
  onFocusSearch,
  onClosePanel,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Escape always works (close panels)
      if (e.key === "Escape" && onClosePanel) {
        onClosePanel();
        return;
      }

      // Skip shortcuts when typing in inputs
      if (isInput) return;

      // / — focus sidebar search
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      // \ — toggle left sidebar
      if (e.key === "\\" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onToggleLeftSidebar?.();
        return;
      }

      // Ctrl+/ or Cmd+/ — toggle AI chat
      if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onToggleRightSidebar?.();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleLeftSidebar, onToggleRightSidebar, onFocusSearch, onClosePanel]);
}
