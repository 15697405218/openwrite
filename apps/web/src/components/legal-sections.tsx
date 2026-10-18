import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { LegalSection } from "@/i18n/legal-copy"

const prose = "prose prose-neutral dark:prose-invert max-w-none"

function LegalBlock({ block }: { block: LegalSection["blocks"][number] }) {
  if (block.kind === "h3") {
    return <h3>{block.text}</h3>
  }
  if (block.kind === "ul") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  if (block.kind === "link") {
    return (
      <p>
        {block.link.before}
        <a
          className="text-primary hover:underline"
          href={block.link.href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {block.link.label}
        </a>
        {block.link.after}
      </p>
    )
  }
  return <p>{block.text}</p>
}

export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
          </CardHeader>
          <CardContent className={prose}>
            {section.blocks.map((block) => (
              <LegalBlock
                block={block}
                key={block.kind === "ul" ? block.items.join("|") : JSON.stringify(block)}
              />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
