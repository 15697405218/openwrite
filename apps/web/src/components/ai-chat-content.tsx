import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Bot, Send, Settings, User } from "lucide-react"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { WriteApproval } from "@/components/write-approval"
import { useLocale } from "@/i18n/locale"
import { getActiveChapterSnapshot, subscribeActiveChapter } from "@/lib/active-chapter"
import { getActiveEditor } from "@/lib/active-editor"
import { ApiError, aiApi, type StoredChatMessage } from "@/lib/api"
import { applyChapterEdits } from "@/lib/chapter-edits"
import { cn } from "@/lib/utils"

interface Message {
  content: string
  id: string
  role: "user" | "assistant"
  timestamp: Date
}

interface AIChatContentProps {
  onInsertText?: (text: string) => void
  projectId?: string
}

const MAX_CHAPTER_TEXT = 100_000
const MAX_CHAPTER_HTML = 1_000_000

function toMessage(message: StoredChatMessage): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.createdAt),
  }
}

export function AIChatContent({ onInsertText, projectId }: AIChatContentProps) {
  const { messages: m } = useLocale()
  const queryClient = useQueryClient()
  const chatKey = ["project-chat", projectId] as const
  const historyQuery = useQuery({
    queryKey: chatKey,
    queryFn: async () => await aiApi.history(projectId ?? ""),
    enabled: Boolean(projectId),
  })
  const messages = (historyQuery.data?.messages ?? []).map(toMessage)
  const pendingWrites = historyQuery.data?.pending ?? []
  const writePreface = historyQuery.data?.preface ?? ""
  const [input, setInput] = useState("")
  const [needsProvider, setNeedsProvider] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [directChapterId, setDirectChapterId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resumeStarted = useRef(false)
  const activeChapter = useSyncExternalStore(
    subscribeActiveChapter,
    getActiveChapterSnapshot,
    getActiveChapterSnapshot
  )
  const here = activeChapter.projectId === projectId ? activeChapter : null
  const currentChapterId = here?.focusKind === "chapter" ? here.focusId : null
  const focusKind = here?.focusKind ?? "none"
  const focusId = here?.focusId ?? undefined
  const allowDirect = directChapterId !== null && directChapterId === currentChapterId

  const refreshOpenDocuments = () => {
    if (!projectId) {
      return
    }
    queryClient.invalidateQueries({ queryKey: ["outline", projectId] })
    queryClient.invalidateQueries({ queryKey: ["notes", projectId] })
    queryClient.invalidateQueries({ queryKey: ["characters", projectId] })
    queryClient.invalidateQueries({ queryKey: ["locations", projectId] })
    queryClient.invalidateQueries({ queryKey: ["lore", projectId] })
    queryClient.invalidateQueries({ queryKey: ["plot", projectId] })
  }

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  const chatMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!projectId) {
        throw new Error(m.ai.somethingWrong)
      }
      const editor = getActiveEditor()
      const chapterContent =
        currentChapterId && editor ? editor.getText().slice(0, MAX_CHAPTER_TEXT) : undefined
      const html = currentChapterId && editor ? editor.getHTML() : ""
      const chapterHtml = html.length > 0 && html.length <= MAX_CHAPTER_HTML ? html : undefined
      return await aiApi.chat({
        allowCurrentChapter: allowDirect,
        content,
        projectId,
        focus: focusKind,
        focusId,
        chapterId: currentChapterId ?? undefined,
        chapterContent,
        chapterHtml,
      })
    },
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: chatKey })
      const previous = queryClient.getQueryData<{
        messages: StoredChatMessage[]
        pending?: { id: string }[]
        preface?: string
      }>(chatKey)
      queryClient.setQueryData(chatKey, {
        messages: [
          ...(previous?.messages ?? []),
          {
            id: "pending",
            role: "user" as const,
            content,
            createdAt: new Date().toISOString(),
          },
        ],
        pending: previous?.pending ?? [],
        preface: previous?.preface ?? "",
      })
      return { previous }
    },
    onSuccess: (response) => {
      queryClient.setQueryData(chatKey, {
        messages: response.messages,
        pending: response.pending ?? [],
        preface: response.preface ?? "",
      })
      applyChapterEdits(response.edits ?? [])
      refreshOpenDocuments()
    },
    onError: (error, _content, context) => {
      if (context?.previous) {
        queryClient.setQueryData(chatKey, context.previous)
      }
      if (error instanceof ApiError && error.edits.length > 0) {
        applyChapterEdits(error.edits)
      }
      if (error instanceof ApiError && error.code === "no_provider") {
        setNeedsProvider(true)
        return
      }
      setErrorText(error instanceof Error ? error.message : m.ai.somethingWrong)
    },
  })

  const decideMutation = useMutation({
    mutationFn: async (decision: {
      allowCurrentChapter: boolean
      decisions: { approved: boolean; id: string }[]
    }) => {
      if (!projectId) {
        throw new Error(m.ai.somethingWrong)
      }
      const editor = getActiveEditor()
      const html = currentChapterId && editor ? editor.getHTML() : ""
      const chapterHtml = html.length > 0 && html.length <= MAX_CHAPTER_HTML ? html : undefined
      return await aiApi.decide({
        allowCurrentChapter: decision.allowCurrentChapter,
        chapterHtml,
        chapterId: currentChapterId ?? undefined,
        decisions: decision.decisions,
        focus: focusKind,
        focusId,
        projectId,
      })
    },
    onSuccess: (response) => {
      queryClient.setQueryData(chatKey, {
        messages: response.messages,
        pending: response.pending ?? [],
        preface: response.preface ?? "",
      })
      applyChapterEdits(response.edits ?? [])
      refreshOpenDocuments()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.edits.length > 0) {
        applyChapterEdits(error.edits)
      }
      queryClient.invalidateQueries({ queryKey: chatKey })
      if (error instanceof ApiError && error.code === "no_provider") {
        setNeedsProvider(true)
        return
      }
      setErrorText(error instanceof Error ? error.message : m.ai.somethingWrong)
    },
  })

  const continueMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        throw new Error(m.ai.somethingWrong)
      }
      const editor = getActiveEditor()
      const html = currentChapterId && editor ? editor.getHTML() : ""
      const chapterHtml = html.length > 0 && html.length <= MAX_CHAPTER_HTML ? html : undefined
      return await aiApi.continueCut({
        allowCurrentChapter: allowDirect,
        chapterHtml,
        chapterId: currentChapterId ?? undefined,
        focus: focusKind,
        focusId,
        projectId,
      })
    },
    onSuccess: (response) => {
      queryClient.setQueryData(chatKey, {
        continuation: false,
        messages: response.messages,
        pending: response.pending ?? [],
        preface: response.preface ?? "",
      })
      applyChapterEdits(response.edits ?? [])
      refreshOpenDocuments()
    },
    onError: (error) => {
      resumeStarted.current = false
      if (error instanceof ApiError && error.edits.length > 0) {
        applyChapterEdits(error.edits)
      }
      queryClient.invalidateQueries({ queryKey: chatKey })
      setErrorText(error instanceof Error ? error.message : m.ai.somethingWrong)
    },
  })

  useEffect(() => {
    if (!historyQuery.data?.continuation) {
      resumeStarted.current = false
      return
    }
    if (!projectId || resumeStarted.current || continueMutation.isPending) {
      return
    }
    resumeStarted.current = true
    continueMutation.mutate()
  }, [continueMutation, historyQuery.data?.continuation, projectId])

  const isTyping = chatMutation.isPending || decideMutation.isPending || continueMutation.isPending
  const continuing = historyQuery.data?.continuation === true
  const paused = pendingWrites.length > 0 || continuing

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isTyping || paused) {
      return
    }

    const content = input.trim()
    setInput("")
    setErrorText(null)
    chatMutation.mutate(content)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  const handleInsertToEditor = (text: string) => {
    onInsertText?.(text)
  }

  if (needsProvider) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 w-fit rounded-full bg-muted p-3">
          <Settings className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mb-2 font-semibold text-sm">{m.ai.connectTitle}</h3>
        <p className="mb-4 text-muted-foreground text-sm">{m.ai.connectBody}</p>
        <Button asChild size="sm">
          <Link to="/dashboard/ai">{m.ai.setupProvider}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {historyQuery.isSuccess && messages.length === 0 && pendingWrites.length === 0 && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 w-fit rounded-full bg-muted p-3">
                <Bot className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mb-4 text-muted-foreground text-sm">{m.ai.assistantHello}</p>
              <div className="space-y-2">
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {m.ai.tryAsking}
                </p>
                <div className="flex flex-wrap gap-2">
                  {m.ai.suggestions.map((suggestion) => (
                    <Badge
                      className="cursor-pointer py-1 text-xs hover:bg-secondary/80"
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      variant="secondary"
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
              key={message.id}
            >
              {message.role === "assistant" && (
                <Avatar className="mt-1 h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div
                className={cn(
                  "max-w-[240px] rounded-lg px-3 py-2 text-sm",
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.role === "assistant" && (
                  <div className="mt-2 border-border/50 border-t pt-2">
                    <Button
                      className="h-6 p-1 text-xs"
                      onClick={() => handleInsertToEditor(message.content)}
                      size="sm"
                      variant="ghost"
                    >
                      Insert into editor
                    </Button>
                  </div>
                )}
              </div>

              {message.role === "user" && (
                <Avatar className="mt-1 h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-secondary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          <WriteApproval
            allowDirect={allowDirect}
            busy={isTyping}
            currentChapterId={currentChapterId}
            onDecide={(decisions, allowCurrentChapter) => {
              setErrorText(null)
              decideMutation.mutate({ allowCurrentChapter, decisions })
            }}
            onRemember={() => {
              if (currentChapterId) {
                setDirectChapterId(currentChapterId)
              }
            }}
            pending={pendingWrites}
            preface={writePreface}
          />

          {isTyping && (
            <div className="flex justify-start gap-3">
              <Avatar className="mt-1 h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                <div className="flex gap-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <Separator />

      <div className="p-4">
        {errorText && <p className="mb-2 text-destructive text-xs">{errorText}</p>}
        {pendingWrites.length > 0 && (
          <p className="mb-2 text-muted-foreground text-xs">{m.ai.writePendingSend}</p>
        )}
        {continuing && (
          <p className="mb-2 text-muted-foreground text-xs">{m.ai.continuingCutoff}</p>
        )}
        {currentChapterId && (
          <div className="mb-2 flex items-center gap-2">
            <Switch
              checked={allowDirect}
              id="direct-write"
              onCheckedChange={(checked) => {
                setDirectChapterId(checked ? currentChapterId : null)
              }}
            />
            <Label className="font-normal text-muted-foreground text-xs" htmlFor="direct-write">
              {m.ai.writeDirect}
            </Label>
          </div>
        )}
        <form className="flex gap-2" onSubmit={handleSubmit}>
          <Input
            className="flex-1"
            disabled={isTyping}
            onChange={(e) => setInput(e.target.value)}
            placeholder={m.ai.ask}
            ref={inputRef}
            value={input}
          />
          <Button
            className="px-3"
            disabled={!input.trim() || isTyping || paused}
            size="sm"
            type="submit"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
