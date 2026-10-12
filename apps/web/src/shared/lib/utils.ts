import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: readonly ClassValue[]): string => twMerge(clsx(inputs));

export { cn };
