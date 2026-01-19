import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes with clsx.
 * Resolves conflicts between Tailwind classes properly.
 * 
 * @example
 * cn("px-4 py-2", "px-8") // returns "py-2 px-8"
 * cn("text-red-500", condition && "text-blue-500") // conditional classes
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format currency in Thai Baht (THB).
 * 
 * @example
 * formatCurrency(1234.56) // "฿1,234.56"
 */
export function formatCurrency(amount: number | null | undefined): string {
    if (amount == null) return "฿0.00";

    return new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

/**
 * Format number with Thai locale.
 * 
 * @example
 * formatNumber(1234.56) // "1,234.56"
 * formatNumber(1234.56, 0) // "1,235"
 */
export function formatNumber(
    num: number | null | undefined,
    decimals = 2
): string {
    if (num == null) return "0";

    return new Intl.NumberFormat("th-TH", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(num);
}

/**
 * Format weight in kilograms.
 * 
 * @example
 * formatWeight(1234.56) // "1,234.56 kg"
 */
export function formatWeight(kg: number | null | undefined): string {
    if (kg == null) return "0 kg";
    return `${formatNumber(kg)} kg`;
}

/**
 * Format date to Thai locale.
 * 
 * @example
 * formatDate("2026-01-19") // "19 ม.ค. 2569"
 */
export function formatDate(
    date: string | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions
): string {
    if (!date) return "-";

    const d = typeof date === "string" ? new Date(date) : date;

    return new Intl.DateTimeFormat("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        ...options,
    }).format(d);
}

/**
 * Format relative time (e.g., "2 hours ago").
 * 
 * @example
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "1 hour ago"
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
    if (!date) return "-";

    const d = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return formatDate(d);
}
