import { Navbar } from "@/components/layout/navbar"
import { Sidebar } from "@/components/layout/sidebar"
import { getCurrentUser } from "@/actions/auth-actions"

// Default export for layout
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const user = await getCurrentUser()

    return (
        <div className="h-full relative">
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-gray-900">
                <Sidebar user={user} />
            </div>
            <main className="md:pl-72">
                <Navbar user={user} />
                {children}
            </main>
        </div>
    )
}
