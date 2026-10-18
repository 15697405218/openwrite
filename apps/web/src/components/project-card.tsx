import { Link } from "@tanstack/react-router"
import { BookOpen, Edit } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Project } from "@/lib/api"
import { useLocale } from "@/i18n/locale"

interface ProjectCardProps {
  onEdit?: (project: Project) => void
  project: Project
}

export function ProjectCard({ project, onEdit }: ProjectCardProps) {
  const { messages: m } = useLocale()
  const typeLabel =
    m.projects.types[project.type as keyof typeof m.projects.types] ?? project.type
  const statusLabel =
    m.projects.status[project.status as keyof typeof m.projects.status] ?? project.status
  return (
    <Card className="relative transition-shadow hover:shadow-lg">
      {onEdit && (
        <div className="absolute top-3 right-3 z-10">
          <Button
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit(project)
            }}
            size="sm"
            variant="ghost"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Link params={{ projectId: project.id }} to="/projects/$projectId/write">
        <div className="cursor-pointer">
          <CardHeader>
            <div className="flex items-start justify-between pr-8">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <Badge variant={project.status === "draft" ? "secondary" : "default"}>
                {statusLabel}
              </Badge>
            </div>
            <CardTitle className="mt-4 truncate">{project.title}</CardTitle>
            {project.description && (
              <CardDescription className="line-clamp-2">{project.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-gray-600 text-sm">
                <span className="font-medium">{m.projects.typeLabel}:</span> {typeLabel}
              </div>
              {project.genre && (
                <div className="text-gray-600 text-sm">
                  <span className="font-medium">{m.projects.genreLabel}:</span> {project.genre}
                </div>
              )}
              <div className="text-gray-600 text-sm">
                <span className="font-medium">{m.projects.progressLabel}:</span>{" "}
                {project.currentWordCount.toLocaleString()} /{" "}
                {project.targetWordCount?.toLocaleString() || "∞"} {m.common.words}
              </div>
              {project.targetWordCount && (
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{
                      width: `${Math.min((project.currentWordCount / project.targetWordCount) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </div>
      </Link>
    </Card>
  )
}
