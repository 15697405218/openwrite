import { Bell, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useLocale } from "@/i18n/locale"

export default function DashboardHeader() {
  const { messages: m } = useLocale()

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div className="relative hidden sm:block">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-48 pl-10 sm:w-64 lg:w-96"
            placeholder={m.dashboard.search}
          />
        </div>

        {/* Mobile Search Button */}
        <div className="sm:hidden">
          <Button size="icon" variant="ghost">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <Bell className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{m.dashboard.notifications}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-4 text-center text-muted-foreground text-sm">
              {m.dashboard.noNotifications}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* UserMenu moved to sidebar footer for consistency */}
      </div>
    </header>
  )
}
