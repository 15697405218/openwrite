import { AlertCircle, CheckCircle, Copy, ExternalLink } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { fill, useLocale } from "@/i18n/locale"

type ConnectionMethod = "ngrok" | "cloudflare" | "manual"

interface SetupStep {
  content: string
  copyable?: boolean
  title: string
}

interface OllamaSetupProps {
  loading?: boolean
  onConnect: (config: { apiUrl: string; connectionMethod: ConnectionMethod }) => void
}

export function OllamaSetup({ onConnect, loading }: OllamaSetupProps) {
  const { messages: m } = useLocale()
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>("ngrok")
  const [apiUrl, setApiUrl] = useState("")
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "success" | "error">("idle")

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(m.ollama.copied)
    } catch {
      toast.error(m.ollama.copyFailed)
    }
  }

  const testConnection = async () => {
    if (!apiUrl) {
      return
    }

    setTestingConnection(true)
    setConnectionStatus("idle")

    try {
      // Test the connection by hitting the /api/tags endpoint
      const testUrl = new URL("/api/tags", apiUrl).toString()

      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        setConnectionStatus("success")
        toast.success(m.ollama.connectionOk)
      } else {
        setConnectionStatus("error")
        toast.error(`Connection failed: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setConnectionStatus("error")
      toast.error(
        fill(m.ollama.connectionFailed, {
          message: error instanceof Error ? error.message : m.ai.unknownError,
        })
      )
    } finally {
      setTestingConnection(false)
    }
  }

  const handleConnect = () => {
    if (!apiUrl) {
      return
    }
    onConnect({ apiUrl, connectionMethod })
  }

  const setupGuides: Record<
    ConnectionMethod,
    { title: string; description: string; steps: SetupStep[] }
  > = {
    ngrok: {
      title: m.ollama.ngrokTitle,
      description: m.ollama.ngrokHint,
      steps: [
        {
          title: m.ollama.installNgrok,
          content: m.ollama.installNgrokBody,
        },
        {
          title: m.ollama.startOllama,
          content: m.ollama.startOllamaBody,
        },
        {
          title: m.ollama.createTunnel,
          content: 'ngrok http 11434 --host-header="localhost:11434"',
          copyable: true,
        },
        {
          title: m.ollama.copyUrl,
          content: m.ollama.copyNgrok,
        },
      ],
    },
    cloudflare: {
      title: m.ollama.cfTitle,
      description: m.ollama.cfHint,
      steps: [
        {
          title: m.ollama.installCf,
          content: m.ollama.installCfBody,
        },
        {
          title: m.ollama.startOllama,
          content: m.ollama.startOllamaBody,
        },
        {
          title: m.ollama.createTunnel,
          content:
            'cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"',
          copyable: true,
        },
        {
          title: m.ollama.copyUrl,
          content: m.ollama.copyCf,
        },
      ],
    },
    manual: {
      title: m.ollama.manualTitle,
      description: m.ollama.manualHint,
      steps: [
        {
          title: m.ollama.customSetup,
          content: m.ollama.customSetupBody,
        },
      ],
    },
  }

  const currentGuide = setupGuides[connectionMethod]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="font-medium text-base">{m.ollama.method}</Label>
          <p className="text-muted-foreground text-sm">{m.ollama.methodHint}</p>
          <Select
            onValueChange={(value) => setConnectionMethod(value as ConnectionMethod)}
            value={connectionMethod}
          >
            <SelectTrigger>
              <SelectValue placeholder={m.ollama.selectMethod} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ngrok">
                <div className="flex items-center gap-2">
                  {m.ollama.ngrok}
                  <Badge className="text-xs" variant="secondary">
                    {m.ai.recommended}
                  </Badge>
                </div>
              </SelectItem>
              <SelectItem value="cloudflare">{m.ollama.cloudflare}</SelectItem>
              <SelectItem value="manual">{m.ollama.manual}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {connectionMethod !== "manual" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {currentGuide.title}
              <Badge className="text-xs" variant="outline">
                {m.ollama.setupGuide}
              </Badge>
            </CardTitle>
            <p className="text-muted-foreground text-sm">{currentGuide.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentGuide.steps.map((step, index) => (
              <div className="space-y-2" key={step.title}>
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground text-xs">
                    {index + 1}
                  </div>
                  <h4 className="font-medium">{step.title}</h4>
                </div>
                <div className="ml-8 space-y-2">
                  <p className="text-muted-foreground text-sm">{step.content}</p>
                  {step.copyable && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-muted px-2 py-1 text-sm">
                        {step.content}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(step.content)}
                        size="sm"
                        variant="ghost"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiUrl">
            {connectionMethod === "manual" ? m.ollama.apiUrl : m.ollama.tunnelUrl}
          </Label>
          <div className="flex gap-2">
            <Input
              id="apiUrl"
              onChange={(e) => {
                setApiUrl(e.target.value)
                setConnectionStatus("idle")
              }}
              placeholder={
                connectionMethod === "manual"
                  ? "http://your-server:11434"
                  : "https://abc123.ngrok.app"
              }
              value={apiUrl}
            />
            <Button
              disabled={!apiUrl || testingConnection}
              onClick={testConnection}
              type="button"
              variant="outline"
            >
              {testingConnection ? m.ollama.testing : m.ollama.test}
            </Button>
          </div>
          {connectionStatus === "success" && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              {m.ollama.connectionOk}
            </div>
          )}
          {connectionStatus === "error" && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {m.ollama.failedShort}
            </div>
          )}
          <p className="text-muted-foreground text-sm">{m.ollama.tunnelHint}</p>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            disabled={!apiUrl || loading || connectionStatus === "error"}
            onClick={handleConnect}
          >
            {loading ? m.ai.connectingShort : m.ollama.connect}
          </Button>
          <Button
            onClick={() => window.open("https://ollama.com/download", "_blank", "noopener")}
            type="button"
            variant="outline"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {m.ollama.download}
          </Button>
        </div>
      </div>
    </div>
  )
}
