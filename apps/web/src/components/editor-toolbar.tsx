import type { Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Pilcrow,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import { fill, useLocale } from "@/i18n/locale"

interface EditorToolbarProps {
  editor: Editor
}

const HIGHLIGHT_COLORS = [
  { name: "yellow", value: "#fef08a" },
  { name: "green", value: "#bbf7d0" },
  { name: "blue", value: "#bfdbfe" },
  { name: "pink", value: "#fbcfe8" },
  { name: "purple", value: "#e9d5ff" },
] as const

const HEADINGS = [
  { level: 1, icon: Heading1 },
  { level: 2, icon: Heading2 },
  { level: 3, icon: Heading3 },
] as const

function ToolbarSeparator() {
  return <Separator className="mx-1 h-6 shrink-0" orientation="vertical" />
}

function HeadingMenu({ editor }: EditorToolbarProps) {
  const { messages: m } = useLocale()
  const active = HEADINGS.find((h) => editor.isActive("heading", { level: h.level }))
  const ActiveIcon = active?.icon ?? Pilcrow

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-8 w-8 p-0" size="sm" title={m.editor.textStyle} variant="ghost">
          <ActiveIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()}>
          <Pilcrow className="mr-2 h-4 w-4" /> {m.editor.paragraph}
        </DropdownMenuItem>
        {HEADINGS.map(({ level, icon: Icon }) => (
          <DropdownMenuItem
            key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <Icon className="mr-2 h-4 w-4" /> {fill(m.editor.heading, { level })}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function HighlightMenu({ editor }: EditorToolbarProps) {
  const { messages: m } = useLocale()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Toggle
          className="h-8 w-8 p-0"
          pressed={editor.isActive("highlight")}
          size="sm"
          title={m.editor.highlight}
        >
          <Highlighter className="h-4 w-4" />
        </Toggle>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {HIGHLIGHT_COLORS.map((color) => (
          <DropdownMenuItem
            key={color.value}
            onClick={() => editor.chain().focus().toggleHighlight({ color: color.value }).run()}
          >
            <span
              className="mr-2 inline-block h-4 w-4 rounded-sm border"
              style={{ backgroundColor: color.value }}
            />
            {m.canvas.colors[color.name]}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => editor.chain().focus().unsetHighlight().run()}>
          <span className="mr-2 inline-block h-4 w-4 rounded-sm border bg-background" />
          {m.common.none}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function LinkControl({ editor }: EditorToolbarProps) {
  const { messages: m } = useLocale()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")

  const isActive = editor.isActive("link")

  const handleToggle = () => {
    if (isActive) {
      editor.chain().focus().unsetLink().run()
      return
    }
    setUrl(editor.getAttributes("link").href ?? "")
    setOpen(true)
  }

  const applyLink = () => {
    const trimmed = url.trim()
    if (trimmed) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run()
    }
    setOpen(false)
    setUrl("")
  }

  return (
    <>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={handleToggle}
        pressed={isActive}
        size="sm"
        title={isActive ? m.editor.removeLink : m.editor.addLink}
      >
        <LinkIcon className="h-4 w-4" />
      </Toggle>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m.editor.addLink}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-url">{m.editor.url}</Label>
            <Input
              id="link-url"
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  applyLink()
                }
              }}
              placeholder={m.editor.linkPlaceholder}
              value={url}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="ghost">
              {m.common.cancel}
            </Button>
            <Button disabled={!url.trim()} onClick={applyLink} type="button">
              {m.editor.addLink}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const { messages: m } = useLocale()
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b bg-background px-2 py-1.5 [&>button]:shrink-0"
      data-testid="editor-toolbar"
    >
      <Button
        className="h-8 w-8 p-0"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        size="sm"
        title={m.editor.undo}
        type="button"
        variant="ghost"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        className="h-8 w-8 p-0"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        size="sm"
        title={m.editor.redo}
        type="button"
        variant="ghost"
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <ToolbarSeparator />

      <HeadingMenu editor={editor} />

      <ToolbarSeparator />

      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        pressed={editor.isActive("bold")}
        size="sm"
        title={m.editor.bold}
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        pressed={editor.isActive("italic")}
        size="sm"
        title={m.editor.italic}
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        pressed={editor.isActive("underline")}
        size="sm"
        title={m.editor.underline}
      >
        <Underline className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        pressed={editor.isActive("strike")}
        size="sm"
        title={m.editor.strike}
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleCode().run()}
        pressed={editor.isActive("code")}
        size="sm"
        title={m.editor.inlineCode}
      >
        <Code className="h-4 w-4" />
      </Toggle>
      <HighlightMenu editor={editor} />

      <ToolbarSeparator />

      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().setTextAlign("left").run()}
        pressed={editor.isActive({ textAlign: "left" })}
        size="sm"
        title={m.editor.alignLeft}
      >
        <AlignLeft className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().setTextAlign("center").run()}
        pressed={editor.isActive({ textAlign: "center" })}
        size="sm"
        title={m.editor.alignCenter}
      >
        <AlignCenter className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().setTextAlign("right").run()}
        pressed={editor.isActive({ textAlign: "right" })}
        size="sm"
        title={m.editor.alignRight}
      >
        <AlignRight className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().setTextAlign("justify").run()}
        pressed={editor.isActive({ textAlign: "justify" })}
        size="sm"
        title={m.editor.justify}
      >
        <AlignJustify className="h-4 w-4" />
      </Toggle>

      <ToolbarSeparator />

      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        pressed={editor.isActive("bulletList")}
        size="sm"
        title={m.editor.bullet}
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        pressed={editor.isActive("orderedList")}
        size="sm"
        title={m.editor.numbered}
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleTaskList().run()}
        pressed={editor.isActive("taskList")}
        size="sm"
        title={m.editor.task}
      >
        <ListTodo className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
        pressed={editor.isActive("blockquote")}
        size="sm"
        title={m.editor.quote}
      >
        <Quote className="h-4 w-4" />
      </Toggle>
      <Toggle
        className="h-8 w-8 p-0"
        onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
        pressed={editor.isActive("codeBlock")}
        size="sm"
        title={m.editor.codeBlock}
      >
        <SquareCode className="h-4 w-4" />
      </Toggle>

      <ToolbarSeparator />

      <LinkControl editor={editor} />
    </div>
  )
}
