import { useNavigate } from "@tanstack/react-router"
import {
  BookOpenIcon,
  FileTextIcon,
  HomeIcon,
  PaletteIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { useLocale } from "@/i18n/locale"

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { messages: m } = useLocale()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((isOpen) => !isOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  return (
    <CommandDialog onOpenChange={setOpen} open={open}>
      <CommandInput placeholder={m.command.placeholder} />
      <CommandList>
        <CommandEmpty>{m.command.empty}</CommandEmpty>

        <CommandGroup heading={m.command.navigation}>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/dashboard" }))}>
            <HomeIcon />
            {m.nav.dashboard}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/dashboard/projects" }))}>
            <BookOpenIcon />
            {m.nav.projects}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/dashboard/ai" }))}>
            <PaletteIcon />
            {m.command.aiProviders}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/dashboard/settings" }))}>
            <SettingsIcon />
            {m.nav.settings}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate({ to: "/dashboard/team" }))}>
            <UsersIcon />
            {m.nav.team}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={m.command.actions}>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                // This would typically trigger a new novel creation modal
              })
            }
          >
            <PlusIcon />
            {m.command.createProject}
          </CommandItem>
          <CommandItem
            onSelect={() =>
              runCommand(() => {
                // This would typically open a search modal
              })
            }
          >
            <SearchIcon />
            {m.command.searchProjects}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={m.command.quickLinks}>
          <CommandItem onSelect={() => runCommand(() => window.open("/privacy", "_blank"))}>
            <FileTextIcon />
            {m.command.privacy}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => window.open("/terms", "_blank"))}>
            <FileTextIcon />
            {m.command.terms}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
