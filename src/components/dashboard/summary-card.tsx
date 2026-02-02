import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface SummaryCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  variant?: "default" | "success" | "warning" | "muted"
}

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "h-4 w-4",
            variant === "success" && "text-green-500",
            variant === "warning" && "text-yellow-500",
            variant === "muted" && "text-muted-foreground",
            variant === "default" && "text-primary"
          )}
        />
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold",
            variant === "success" && "text-green-600",
            variant === "warning" && "text-yellow-600"
          )}
        >
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
