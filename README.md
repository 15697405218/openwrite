# OpenWrite

**Open-source, AI-powered writing platform for novelists, screenwriters, and creative writers. ✨📝**

**面向小说、剧本和创意写作的开源 AI 写作平台。✨📝**

OpenWrite helps you plan, organize, and write long-form fiction — with an AI assistant that runs on **your own API keys**. No subscription, no markup on tokens, no lock-in. Your manuscript lives in your database (or ours, or one you self-host).

OpenWrite 用来规划、整理和写作长篇故事。AI 助手使用**你自己的 API 密钥**。没有订阅，不在 token 上加价，也不把你锁在某一家服务里。文稿存在你的数据库里，也可以用我们托管的，或者自己部署。

**Try it / 在线试用：** [openwrite.iliareingold.com](https://openwrite.iliareingold.com)

![One sentence becomes a connected story map: a premise node expands into acts, acts into chapters, and a chapter is promoted straight into the manuscript](.github/story-map-demo.gif)

*One sentence in → a connected story map out. Expand any node with AI, then promote chapters straight into your manuscript.*

*一句话进去，一张连起来的故事地图出来。用 AI 展开任意节点，再把章节直接放进文稿。*

## What works today / 现在能用的

- 🗺️ **Story map (node-based AI generation)** — describe your story in one sentence, then expand it level by level: premise → acts → chapters → scenes, each generated as connected nodes on a visual canvas with auto-layout. Chapter nodes promote directly into your manuscript
  - 🗺️ **故事地图（按节点生成）** — 用一句话描述故事，再逐层展开：前提 → 幕 → 章 → 场。每一层都是画布上相连的节点，并会自动排版。章节节点可以直接加入文稿
- ✍️ **Rich text editor with auto-save** — a distraction-light Tiptap editor that persists your manuscript as you type, with live length counts and per-project progress tracking. Chinese, Japanese, and Korean characters count one by one; a run of Latin letters or digits counts as one word. Press Alt+/ for an inline continuation
  - ✍️ **自动保存的富文本编辑器** — 基于 Tiptap，边写边保存，实时显示字数，并按项目跟踪进度。汉字、日文和韩文逐字计数，连续的英文或数字算一个词。按 Alt+/ 可以在光标处续写
- 📖 **Volumes and chapters** — the manuscript is organized as volumes, then chapters. Create, rename, and reorder them, with safe concurrent-edit detection. A chapter can link the characters, locations, and plot threads it uses. Starting the next chapter can summarize the one you just finished. Notes stay on the project
  - 📖 **卷和章** — 文稿按卷、再按章组织。可以新建、重命名和调整顺序，并检测别处的并发修改。一章可以绑上它用到的角色、地点和情节线。新建下一章时可以为刚写完的一章生成摘要。笔记留在项目上
- 🤖 **AI writing assistant (bring your own key)** — the sidebar chat is built from the chapter you have open: recent chapters, characters, locations, lore, plot threads, and summaries. Changes to the manuscript wait for your approval; you can allow direct writes to the open chapter for the rest of that chat. The conversation runs on LangGraph with checkpoints in D1, so a crash resumes from the last finished step. A reply cut off by the token limit continues from the cutoff, and a replayed write is not appended twice. Supported providers:
  - 🤖 **AI 写作助手（自带密钥）** — 侧边栏对话按当前打开的章节组装：前几章、角色、地点、世界观、情节线和摘要。改稿会先等你确认；也可以让这次对话直接写入当前章。对话跑在 LangGraph 上，检查点存在 D1，中断后从上次走完的步骤继续。回复被 token 上限截断时从断点续写，重放不会把同一段再追加一遍。支持的服务：
  - OpenRouter (one key, hundreds of models — easiest start) / OpenRouter（一把密钥用上百种模型，最容易上手）
  - OpenAI, Anthropic, Groq, Gemini, Cohere
  - A custom OpenAI-compatible endpoint / 自定义的 OpenAI 兼容接口
  - Ollama (fully local models, fully private) / Ollama（模型完全在本机运行，数据留在本地）
- 📚 **Codex** — structured world-building: characters, locations, lore entries, and plot points, organized per project, with summaries you can generate and attach to a chapter
  - 📚 **设定集** — 按项目整理角色、地点、世界观和情节点，可以生成摘要并附到章节上
- 🌐 **Chinese and English** — the writing interface switches language
  - 🌐 **中文和英文** — 写作界面可以切换语言
- 📤 **Markdown export** — download your full manuscript as Markdown
  - 📤 **Markdown 导出** — 把整部文稿下载为 Markdown
- 🗂️ **Projects** — novels, trilogies, series, short story collections, screenplays; genre, status, and target word count tracking
  - 🗂️ **项目** — 小说、三部曲、系列、短篇集、剧本；可记录类型、状态和目标字数
- 🔐 **Auth & workspaces** — email/password accounts with personal workspaces; API keys are encrypted at rest (AES-GCM)
  - 🔐 **账号与工作区** — 邮箱密码登录，每人有自己的工作区；API 密钥以 AES-GCM 加密保存

## In progress / 正在做的

| Feature 功能 | Status 状态 |
| --- | --- |
| Streaming AI responses / 流式 AI 回复 | Planned next / 下一步 |
| Character auto-linking in story-map expansion / 展开故事地图时自动关联角色 | Planned next / 下一步 |
| Manuscript export (DOCX / EPUB) / 文稿导出（DOCX / EPUB） | Planned / 计划中 |
| Real-time collaboration / 实时协作 | Designed, not built / 已设计，尚未实现 |

Found a bug or want to influence what gets built? [Open an issue](https://github.com/ilrein/openwrite/issues).

发现了问题，或者想影响接下来做什么？请 [提交 issue](https://github.com/ilrein/openwrite/issues)。

## Why OpenWrite / 为什么用 OpenWrite

- **Your keys, your costs.** Tools like Sudowrite resell AI tokens at a markup. OpenWrite talks to providers directly with your key — you pay provider rates, or nothing at all with local Ollama models.
  - **密钥是你的，费用也是你的。** 有些工具会把 AI token 加价转售。OpenWrite 用你的密钥直接连接服务商：按服务商原价付费，或者用本机 Ollama，完全不花钱。
- **Your words, your data.** AGPL-3.0 licensed and self-hostable on Cloudflare's free tier. No training on your manuscript, no vendor holding your novel hostage.
  - **文字是你的，数据也是你的。** 采用 AGPL-3.0，可以在 Cloudflare 免费额度上自己部署。文稿不会被拿去训练，也不会被一家服务扣住。
- **Built for fiction.** Characters, lore, and plot structure are first-class concepts, not folders of notes.
  - **为虚构写作而做。** 角色、世界观和情节结构是一等概念，不只是一堆笔记文件夹。

## Tech stack / 技术栈

TypeScript end to end: React 19 + TanStack Router + TailwindCSS/shadcn-ui on the front, Hono on Cloudflare Workers with D1 (SQLite) + Drizzle ORM on the back, Better Auth for authentication. Bun workspaces with [mprocs](https://github.com/pvolok/mprocs) for dev orchestration and Vitest for tests.

前后端都是 TypeScript：前端是 React 19 + TanStack Router + TailwindCSS/shadcn-ui，后端是运行在 Cloudflare Workers 上的 Hono，数据库是 D1（SQLite）+ Drizzle ORM，认证用 Better Auth。开发用 Bun workspaces，由 [mprocs](https://github.com/pvolok/mprocs) 编排进程，测试用 Vitest。

## Getting started / 开始使用

```bash
bun install
```

### Database setup / 数据库

This project uses Cloudflare D1 (SQLite) with Drizzle ORM. Local development runs against a local D1 instance managed by `wrangler dev`.

项目使用 Cloudflare D1（SQLite）和 Drizzle ORM。本地开发连的是 `wrangler dev` 管理的本地 D1。

1. Copy the example environment file and fill in the values (any random strings work locally):

   复制示例环境文件并填上值（本地用任意随机字符串即可）：

```bash
cp apps/server/.dev.vars.example apps/server/.dev.vars
```

`apps/server/.dev.vars` needs `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGIN`, and `ENCRYPTION_KEY` (a base64-encoded 32-byte key, e.g. `openssl rand -base64 32`).

`apps/server/.dev.vars` 需要 `BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`CORS_ORIGIN` 和 `ENCRYPTION_KEY`（base64 编码的 32 字节密钥，例如 `openssl rand -base64 32`）。

2. Apply the schema / 应用数据库结构：

```bash
bun db:push
```

### Run it / 运行

```bash
bun dev
```

Open [http://localhost:3001](http://localhost:3001) for the web app. The API runs at [http://localhost:3000](http://localhost:3000).

在 [http://localhost:3001](http://localhost:3001) 打开网页。API 在 [http://localhost:3000](http://localhost:3000)。

## Self-hosting / 自己部署

OpenWrite deploys as a single Cloudflare Worker (API + static frontend) backed by a D1 database — comfortably within Cloudflare's free tier for personal use:

OpenWrite 部署为一个 Cloudflare Worker（API 和静态前端），背后是 D1 数据库。个人使用通常落在 Cloudflare 免费额度内：

```bash
wrangler d1 create your-database        # then update apps/server/wrangler.jsonc
wrangler secret put BETTER_AUTH_SECRET  # plus BETTER_AUTH_URL, CORS_ORIGIN, ENCRYPTION_KEY
bun run deploy
```

`wrangler d1 create` 之后更新 `apps/server/wrangler.jsonc`。密钥除了 `BETTER_AUTH_SECRET`，还要设置 `BETTER_AUTH_URL`、`CORS_ORIGIN` 和 `ENCRYPTION_KEY`。

## Project structure / 目录结构

```
openwrite/
├── apps/
│   ├── web/         # Frontend (React + TanStack Router) / 前端
│   ├── server/      # Hono REST API on Cloudflare Workers / 后端 API
│   └── docs/        # VitePress documentation / 文档
```

## Available scripts / 常用命令

- `bun dev` — start web + server in an mprocs TUI (db-studio and docs available as extra panes)
  - 在 mprocs 界面里同时启动网页和 API（还可以打开数据库界面和文档）
- `bun build` — build all applications / 构建全部应用
- `bun dev:web` / `bun dev:server` — start a single app / 只启动其中一个
- `bun test` — run the Vitest suites (web + server) / 运行网页和 API 的测试
- `bun quality` — type checking + linting (run before committing) / 类型检查和代码检查（提交前运行）
- `bun db:push` — push schema changes to the database / 把结构变更写进数据库
- `bun db:studio` — open the Drizzle Studio database UI / 打开 Drizzle Studio
- `bun run deploy` — build and deploy to Cloudflare / 构建并部署到 Cloudflare

## Contributing / 参与贡献

Issues and PRs are welcome — the roadmap above is a good place to start, and the codebase is small enough to learn in an afternoon. Run `bun quality` before submitting.

欢迎提 issue 和 PR。可以从上面的计划开始看，代码量一个下午能读完。提交前请运行 `bun quality`。

## License / 许可

[AGPL-3.0](LICENSE.md)
