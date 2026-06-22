"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FadeInProps {
    children: ReactNode;
    className?: string;
    /** Delay in ms — useful for staggering siblings. */
    delay?: number;
    /** Override the intersection threshold. */
    threshold?: number;
}

export function FadeIn({
                           children,
                           className,
                           delay = 0,
                           threshold = 0.15,
                       }: FadeInProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        // Honor reduced motion — just show it.
        const reduced =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) {
            setVisible(true);
            return;
        }

        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    obs.disconnect();
                }
            },
            { threshold, rootMargin: "0px 0px -60px 0px" }
        );
        obs.observe(node);
        return () => obs.disconnect();
    }, [threshold]);

    return (
        <div
            ref={ref}
            style={{ transitionDelay: `${delay}ms` }}
            className={cn(
                "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
                visible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-3",
                className
            )}
        >
            {children}
        </div>
    );
}