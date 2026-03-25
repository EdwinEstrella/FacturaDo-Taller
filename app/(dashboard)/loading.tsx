import { PageLoading } from "@/components/ui/loading"

interface DashboardLoadingProps {
  message?: string
}

export default function DashboardLoading({ message }: DashboardLoadingProps) {
  return <PageLoading message={message} />
}
