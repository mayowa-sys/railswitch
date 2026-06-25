import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus:border-zinc-400 dark:focus:border-zinc-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-zinc-50 dark:disabled:bg-zinc-800/80 disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
