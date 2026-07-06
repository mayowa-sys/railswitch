import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isTestPlan(name: string) {
  return name.startsWith("[deleted]") || name.startsWith("Test ") || name === "Cascade Plan"
}

export function isTestCustomer(email: string, name?: string) {
  if (!email) return false
  if (email.startsWith("[deleted]")) return true
  if (email.startsWith("test_") || email.includes("_test@") || email.includes("testing@")) return true
  if (email.includes("@playground.dev")) return true
  if (name?.startsWith("[deleted]")) return true
  const knownTest = ["livetest@email.com", "judge@demo.com", "decline@email.com",
    "demo@video.test", "final@demo.test", "testing@email.com"]
  if (knownTest.includes(email)) return true
  return false
}
