import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLocale } from "@/i18n/locale"

export function ModeToggle() {
  const { setTheme } = useTheme()
  const { messages: m } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">{m.theme.toggle}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>{m.theme.light}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>{m.theme.dark}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>{m.theme.system}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
