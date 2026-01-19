import { createClient } from "@/shared/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/features/auth/actions/logout";
import { LogOut, User as UserIcon } from "lucide-react";

/**
 * Dashboard Layout
 * 
 * Protected layout for authenticated users
 */
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Get authenticated user
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // This should never happen due to middleware, but double-check
    if (!user) {
        redirect("/login");
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🌾</span>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                SUGAR-OP
                            </h1>
                        </div>

                        {/* User Menu */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <UserIcon className="w-4 h-4" />
                                <span>{user.email}</span>
                            </div>

                            {/* Logout Button */}
                            <form action={logout}>
                                <button
                                    type="submit"
                                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation */}
            <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex gap-6 h-12 items-center">
                        <a
                            href="/dashboard"
                            className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        >
                            Dashboard
                        </a>
                        <a
                            href="/upload"
                            className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        >
                            Upload Receipt
                        </a>
                        <a
                            href="/receipts"
                            className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                        >
                            Receipts
                        </a>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
