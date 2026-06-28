"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider",
        className
      )}
      {...props}
    />
  )
}

export { Label }
