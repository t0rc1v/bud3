"use client"
import { UserButton } from "@clerk/nextjs"
import { useTheme } from "next-themes"

const darkAppearance = {
  variables: {
    colorBackground: "oklch(0.17 0.02 45)",
    colorText: "oklch(0.91 0.018 65)",
    colorTextSecondary: "oklch(0.60 0.035 55)",
    colorPrimary: "oklch(0.66 0.12 48)",
    colorNeutral: "oklch(0.91 0.018 65)",
    colorInputBackground: "oklch(0.22 0.025 45)",
    colorInputText: "oklch(0.91 0.018 65)",
  },
}

export function UserButtonWrapper() {
  const { resolvedTheme } = useTheme()
  return (
    <UserButton appearance={resolvedTheme === "dark" ? darkAppearance : undefined} />
  )
}
