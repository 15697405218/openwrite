import type { Locale } from "@/i18n/locale"

interface LinkPart {
  after: string
  before: string
  href: string
  label: string
}

type Block =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "link"; link: LinkPart }

export interface LegalSection {
  blocks: Block[]
  title: string
}

const github = "https://github.com/ilrein/openwrite"
const issues = "https://github.com/ilrein/openwrite/issues"

const termsEn: LegalSection[] = [
  {
    title: "Introduction",
    blocks: [
      {
        kind: "p",
        text: 'Welcome to OpenWrite. These Terms of Service ("Terms") govern your use of the OpenWrite platform ("Service") operated by the OpenWrite project ("us," "we," or "our").',
      },
      {
        kind: "p",
        text: "By accessing or using our Service, you agree to be bound by these Terms. If you disagree with any part of these terms, then you may not access the Service.",
      },
    ],
  },
  {
    title: "Acceptance of Terms",
    blocks: [
      {
        kind: "p",
        text: "By creating an account or using OpenWrite, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.",
      },
      {
        kind: "p",
        text: "You must be at least 13 years old to use this Service. If you are under 18, you represent that you have your parent's or guardian's permission to use the Service.",
      },
    ],
  },
  {
    title: "Description of Service",
    blocks: [
      { kind: "p", text: "OpenWrite is an AI-powered writing platform that provides:" },
      {
        kind: "ul",
        items: [
          "Rich text editing capabilities with real-time collaboration",
          "AI-assisted writing suggestions and improvements",
          "Document storage and synchronization",
          "Export and sharing features",
          "Writing analytics and insights",
        ],
      },
      {
        kind: "p",
        text: 'The Service is provided on an "as is" basis and may be modified, updated, or discontinued at any time without prior notice.',
      },
    ],
  },
  {
    title: "User Accounts",
    blocks: [
      {
        kind: "p",
        text: "To access certain features of the Service, you must create an account. You are responsible for:",
      },
      {
        kind: "ul",
        items: [
          "Maintaining the confidentiality of your account credentials",
          "All activities that occur under your account",
          "Providing accurate and up-to-date information",
          "Notifying us immediately of any unauthorized use",
        ],
      },
      {
        kind: "p",
        text: "We reserve the right to terminate accounts that violate these Terms or remain inactive for extended periods.",
      },
    ],
  },
  {
    title: "Acceptable Use Policy",
    blocks: [
      { kind: "p", text: "You agree not to use the Service to:" },
      {
        kind: "ul",
        items: [
          "Violate any applicable laws or regulations",
          "Infringe on intellectual property rights",
          "Upload harmful, offensive, or inappropriate content",
          "Attempt to gain unauthorized access to our systems",
          "Distribute malware or engage in malicious activities",
          "Spam, harass, or abuse other users",
          "Use the Service for commercial purposes without permission",
        ],
      },
      {
        kind: "p",
        text: "We reserve the right to remove content and suspend accounts that violate this policy.",
      },
    ],
  },
  {
    title: "Content Ownership and License",
    blocks: [
      { kind: "h3", text: "Your Content" },
      {
        kind: "p",
        text: "You retain ownership of all content you create using OpenWrite. By using the Service, you grant us a limited license to store, process, and display your content solely for the purpose of providing the Service.",
      },
      { kind: "h3", text: "Our Content" },
      {
        kind: "p",
        text: "The OpenWrite platform, including its design, features, and underlying technology, is owned by the OpenWrite project and protected by copyright and other intellectual property laws.",
      },
      { kind: "h3", text: "Open Source License" },
      {
        kind: "link",
        link: {
          before:
            "OpenWrite is released under the AGPL-3.0 license. The source code is available at ",
          href: github,
          label: "github.com/ilrein/openwrite",
          after: ".",
        },
      },
    ],
  },
  {
    title: "AI Features and Data Processing",
    blocks: [
      {
        kind: "p",
        text: "OpenWrite uses artificial intelligence to provide writing assistance and suggestions. By using these features, you understand that:",
      },
      {
        kind: "ul",
        items: [
          "AI suggestions are generated automatically and may not always be accurate",
          "You are responsible for reviewing and validating all AI-generated content",
          "Your content may be processed to provide AI assistance features",
          "We do not guarantee the accuracy or quality of AI suggestions",
        ],
      },
      {
        kind: "p",
        text: "All AI processing is performed securely and in accordance with our Privacy Policy.",
      },
    ],
  },
  {
    title: "Service Availability",
    blocks: [
      {
        kind: "p",
        text: "We strive to maintain high availability of the Service, but we cannot guarantee uninterrupted access. The Service may be temporarily unavailable due to:",
      },
      {
        kind: "ul",
        items: [
          "Scheduled maintenance and updates",
          "Technical difficulties or system failures",
          "Third-party service interruptions",
          "Force majeure events",
        ],
      },
      {
        kind: "p",
        text: "We will make reasonable efforts to provide notice of planned downtime when possible.",
      },
    ],
  },
  {
    title: "Disclaimer of Warranties",
    blocks: [
      {
        kind: "p",
        text: 'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
      },
      {
        kind: "p",
        text: "We do not warrant that the Service will be error-free, secure, or continuously available.",
      },
    ],
  },
  {
    title: "Limitation of Liability",
    blocks: [
      {
        kind: "p",
        text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF DATA, PROFITS, OR BUSINESS INTERRUPTION.",
      },
      {
        kind: "p",
        text: "Our total liability to you for all claims related to the Service shall not exceed the amount you paid us in the twelve months preceding the claim.",
      },
    ],
  },
  {
    title: "Termination",
    blocks: [
      {
        kind: "p",
        text: "You may terminate your account at any time by contacting us or using the account deletion feature. Upon termination:",
      },
      {
        kind: "ul",
        items: [
          "Your access to the Service will be immediately revoked",
          "Your content may be deleted from our servers",
          "We may retain certain information as required by law",
        ],
      },
      {
        kind: "p",
        text: "We may terminate or suspend your account if you violate these Terms or for any other reason at our sole discretion.",
      },
    ],
  },
  {
    title: "Governing Law and Disputes",
    blocks: [
      {
        kind: "p",
        text: "These Terms shall be governed by and construed in accordance with the laws of the jurisdiction where the OpenWrite project is based, without regard to conflict of law principles.",
      },
      {
        kind: "p",
        text: "Any disputes arising from these Terms or your use of the Service should first be addressed through our GitHub issues or direct communication. We encourage good faith efforts to resolve disputes amicably.",
      },
    ],
  },
  {
    title: "Changes to These Terms",
    blocks: [
      {
        kind: "p",
        text: 'We may update these Terms from time to time. We will notify users of any significant changes by posting the new Terms on this page and updating the "Last updated" date.',
      },
      {
        kind: "p",
        text: "Your continued use of the Service after any changes indicates your acceptance of the updated Terms. If you do not agree to the changes, you should discontinue using the Service.",
      },
    ],
  },
  {
    title: "Contact Us",
    blocks: [
      {
        kind: "p",
        text: "If you have any questions about these Terms of Service, please contact us:",
      },
      {
        kind: "link",
        link: {
          before: "GitHub Issues: ",
          href: issues,
          label: "github.com/ilrein/openwrite/issues",
          after: "",
        },
      },
      { kind: "p", text: "Email: Available through our GitHub profile" },
      {
        kind: "p",
        text: "As an open-source project, we welcome community feedback and contributions to improve these Terms and the OpenWrite platform.",
      },
    ],
  },
]

const termsZh: LegalSection[] = [
  {
    title: "引言",
    blocks: [
      {
        kind: "p",
        text: "欢迎使用 OpenWrite。本服务条款（下称“条款”）约束你对 OpenWrite 项目（下称“我们”）运营的 OpenWrite 平台（下称“服务”）的使用。",
      },
      {
        kind: "p",
        text: "访问或使用本服务，即表示你同意受这些条款约束。若你不同意其中任何部分，请不要使用本服务。",
      },
    ],
  },
  {
    title: "接受条款",
    blocks: [
      {
        kind: "p",
        text: "创建账号或使用 OpenWrite，即表示你已阅读、理解并同意受本条款和隐私政策约束。",
      },
      {
        kind: "p",
        text: "使用本服务须年满 13 周岁。若你未满 18 周岁，即表示你已获得父母或监护人的许可。",
      },
    ],
  },
  {
    title: "服务说明",
    blocks: [
      { kind: "p", text: "OpenWrite 是一个由 AI 辅助的写作平台，提供：" },
      {
        kind: "ul",
        items: [
          "支持实时协作的富文本编辑",
          "AI 写作建议与改写",
          "文稿存储与同步",
          "导出与分享",
          "写作统计与洞察",
        ],
      },
      {
        kind: "p",
        text: "服务按“现状”提供，我们可能随时修改、更新或停止服务，无需事先通知。",
      },
    ],
  },
  {
    title: "用户账号",
    blocks: [
      { kind: "p", text: "使用部分功能需要创建账号。你需要负责：" },
      {
        kind: "ul",
        items: [
          "保管账号凭证，不向他人泄露",
          "账号下发生的全部活动",
          "提供准确、最新的信息",
          "发现未经授权的使用后立即通知我们",
        ],
      },
      {
        kind: "p",
        text: "对于违反本条款或长期不活跃的账号，我们保留终止的权利。",
      },
    ],
  },
  {
    title: "可接受使用",
    blocks: [
      { kind: "p", text: "你同意不将本服务用于：" },
      {
        kind: "ul",
        items: [
          "违反适用法律或法规",
          "侵犯知识产权",
          "上传有害、冒犯或不当内容",
          "试图未经授权访问我们的系统",
          "传播恶意软件或从事恶意活动",
          "向其他用户发送垃圾信息、骚扰或辱骂",
          "未经许可将服务用于商业目的",
        ],
      },
      { kind: "p", text: "我们保留删除违规内容并暂停相关账号的权利。" },
    ],
  },
  {
    title: "内容所有权与许可",
    blocks: [
      { kind: "h3", text: "你的内容" },
      {
        kind: "p",
        text: "你用 OpenWrite 创作的内容仍归你所有。使用服务即表示你授予我们有限许可，仅为提供服务而存储、处理和展示这些内容。",
      },
      { kind: "h3", text: "我们的内容" },
      {
        kind: "p",
        text: "OpenWrite 平台，包括其设计、功能和底层技术，归 OpenWrite 项目所有，受著作权和其他知识产权法保护。",
      },
      { kind: "h3", text: "开源许可" },
      {
        kind: "link",
        link: {
          before: "OpenWrite 以 AGPL-3.0 许可发布。源代码见 ",
          href: github,
          label: "github.com/ilrein/openwrite",
          after: "。",
        },
      },
    ],
  },
  {
    title: "AI 功能与数据处理",
    blocks: [
      {
        kind: "p",
        text: "OpenWrite 使用人工智能提供写作辅助和建议。使用这些功能即表示你理解：",
      },
      {
        kind: "ul",
        items: [
          "AI 建议由系统自动生成，不一定准确",
          "你需要自行审阅并确认所有 AI 生成的内容",
          "为提供 AI 辅助，你的内容可能会被处理",
          "我们不保证 AI 建议的准确性或质量",
        ],
      },
      { kind: "p", text: "所有 AI 处理都会按隐私政策安全进行。" },
    ],
  },
  {
    title: "服务可用性",
    blocks: [
      {
        kind: "p",
        text: "我们会尽量保持服务可用，但不能保证不中断。服务可能因以下原因暂时不可用：",
      },
      {
        kind: "ul",
        items: ["计划中的维护和更新", "技术故障或系统失败", "第三方服务中断", "不可抗力"],
      },
      { kind: "p", text: "在可行时，我们会尽量提前通知计划中的停机。" },
    ],
  },
  {
    title: "免责声明",
    blocks: [
      {
        kind: "p",
        text: "服务按“现状”和“可用”提供，不作任何明示或默示保证，包括但不限于适销性、特定用途适用性和不侵权。",
      },
      { kind: "p", text: "我们不保证服务没有错误、绝对安全或持续可用。" },
    ],
  },
  {
    title: "责任限制",
    blocks: [
      {
        kind: "p",
        text: "在法律允许的最大范围内，我们不对任何间接、附带、特殊、后果性或惩罚性损害负责，包括但不限于数据丢失、利润损失或业务中断。",
      },
      {
        kind: "p",
        text: "就与服务相关的全部索赔，我们对你的总责任不超过索赔前十二个月内你向我们支付的金额。",
      },
    ],
  },
  {
    title: "终止",
    blocks: [
      {
        kind: "p",
        text: "你可以随时联系我们，或使用账号删除功能终止账号。终止后：",
      },
      {
        kind: "ul",
        items: [
          "你将立即无法继续使用服务",
          "你的内容可能会从服务器上删除",
          "法律要求保留的信息，我们可能会继续保留",
        ],
      },
      {
        kind: "p",
        text: "若你违反本条款，或基于我们自行判断的其他原因，我们可能终止或暂停你的账号。",
      },
    ],
  },
  {
    title: "适用法律与争议",
    blocks: [
      {
        kind: "p",
        text: "本条款受 OpenWrite 项目所在司法辖区的法律管辖并依其解释，不适用法律冲突原则。",
      },
      {
        kind: "p",
        text: "因本条款或使用服务产生的争议，应先通过 GitHub Issues 或直接沟通处理。我们鼓励以善意方式协商解决。",
      },
    ],
  },
  {
    title: "条款变更",
    blocks: [
      {
        kind: "p",
        text: "我们可能不时更新本条款。重大变更会发布在本页，并更新“最后更新”日期。",
      },
      {
        kind: "p",
        text: "变更后你继续使用服务，即表示接受更新后的条款。若不同意，请停止使用服务。",
      },
    ],
  },
  {
    title: "联系我们",
    blocks: [
      { kind: "p", text: "对本服务条款有疑问，请通过以下方式联系我们：" },
      {
        kind: "link",
        link: {
          before: "GitHub Issues：",
          href: issues,
          label: "github.com/ilrein/openwrite/issues",
          after: "",
        },
      },
      { kind: "p", text: "邮箱：可通过我们的 GitHub 主页获取" },
      {
        kind: "p",
        text: "作为开源项目，我们欢迎社区反馈和贡献，以改进这些条款和 OpenWrite 平台。",
      },
    ],
  },
]

const privacyEn: LegalSection[] = [
  {
    title: "Introduction",
    blocks: [
      {
        kind: "p",
        text: 'OpenWrite ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered writing platform.',
      },
    ],
  },
  {
    title: "Information We Collect",
    blocks: [
      { kind: "h3", text: "Personal Information" },
      {
        kind: "ul",
        items: [
          "Email address (for account creation and authentication)",
          "Name (optional, for personalization)",
          "Writing content and documents you create",
        ],
      },
      { kind: "h3", text: "Automatically Collected Information" },
      {
        kind: "ul",
        items: [
          "Usage data and analytics",
          "Device and browser information",
          "IP address and location data",
          "Cookies and similar tracking technologies",
        ],
      },
    ],
  },
  {
    title: "How We Use Your Information",
    blocks: [
      { kind: "p", text: "We use the information we collect to:" },
      {
        kind: "ul",
        items: [
          "Provide and maintain our writing platform",
          "Authenticate your account and ensure security",
          "Save and sync your writing content across devices",
          "Improve our AI assistance features",
          "Analyze usage patterns to enhance user experience",
          "Communicate with you about updates and features",
        ],
      },
    ],
  },
  {
    title: "Data Storage and Security",
    blocks: [
      {
        kind: "p",
        text: "Your data is stored securely using industry-standard encryption. We use Cloudflare D1 for data storage, which provides enterprise-grade security and compliance. Your writing content is encrypted both in transit and at rest.",
      },
      {
        kind: "p",
        text: "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.",
      },
    ],
  },
  {
    title: "Data Sharing and Disclosure",
    blocks: [
      {
        kind: "p",
        text: "We do not sell, trade, or otherwise transfer your personal information to third parties, except:",
      },
      {
        kind: "ul",
        items: [
          "With your explicit consent",
          "To comply with legal obligations",
          "To protect our rights and safety",
          "In connection with a business transfer or merger",
        ],
      },
      {
        kind: "p",
        text: "We may use anonymized and aggregated data for research and analytics purposes that cannot be used to identify individual users.",
      },
    ],
  },
  {
    title: "Your Rights",
    blocks: [
      { kind: "p", text: "You have the right to:" },
      {
        kind: "ul",
        items: [
          "Access your personal data",
          "Correct inaccurate information",
          "Delete your account and associated data",
          "Export your writing content",
          "Opt out of marketing communications",
          "Withdraw consent where applicable",
        ],
      },
      {
        kind: "p",
        text: 'To exercise these rights, please contact us using the information provided in the "Contact Us" section below.',
      },
    ],
  },
  {
    title: "Cookies and Tracking Technologies",
    blocks: [
      {
        kind: "p",
        text: "We use cookies and similar technologies to enhance your experience, remember your preferences, and analyze usage patterns. You can control cookie preferences through your browser settings.",
      },
      {
        kind: "p",
        text: "Essential cookies are necessary for the platform to function properly and cannot be disabled. Optional cookies help us improve our services and can be disabled at any time.",
      },
    ],
  },
  {
    title: "Open Source Commitment",
    blocks: [
      {
        kind: "p",
        text: "OpenWrite is an open-source project licensed under AGPL-3.0. Our source code is publicly available on GitHub, allowing for transparency and community review of our privacy and security practices.",
      },
      {
        kind: "link",
        link: {
          before:
            "You can review our data handling practices, security implementations, and privacy measures by examining our source code at ",
          href: github,
          label: "github.com/ilrein/openwrite",
          after: ".",
        },
      },
    ],
  },
  {
    title: "Changes to This Privacy Policy",
    blocks: [
      {
        kind: "p",
        text: 'We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new Privacy Policy on this page and updating the "Last updated" date.',
      },
      {
        kind: "p",
        text: "Your continued use of OpenWrite after any changes indicates your acceptance of the updated Privacy Policy.",
      },
    ],
  },
  {
    title: "Contact Us",
    blocks: [
      {
        kind: "p",
        text: "If you have any questions about this Privacy Policy or our privacy practices, please contact us:",
      },
      {
        kind: "link",
        link: {
          before: "GitHub Issues: ",
          href: issues,
          label: "github.com/ilrein/openwrite/issues",
          after: "",
        },
      },
      { kind: "p", text: "Email: Available through our GitHub profile" },
    ],
  },
]

const privacyZh: LegalSection[] = [
  {
    title: "引言",
    blocks: [
      {
        kind: "p",
        text: "OpenWrite（下称“我们”）重视你的隐私。本隐私政策说明你使用这个 AI 写作平台时，我们如何收集、使用、披露和保护你的信息。",
      },
    ],
  },
  {
    title: "我们收集的信息",
    blocks: [
      { kind: "h3", text: "个人信息" },
      {
        kind: "ul",
        items: ["邮箱地址（用于创建账号和登录）", "姓名（可选，用于个性化）", "你创作的文字和文稿"],
      },
      { kind: "h3", text: "自动收集的信息" },
      {
        kind: "ul",
        items: ["使用数据和统计", "设备和浏览器信息", "IP 地址和位置数据", "Cookie 及类似技术"],
      },
    ],
  },
  {
    title: "我们如何使用信息",
    blocks: [
      { kind: "p", text: "我们使用收集到的信息来：" },
      {
        kind: "ul",
        items: [
          "提供并维护写作平台",
          "验证账号并保障安全",
          "在不同设备间保存和同步你的文稿",
          "改进 AI 辅助功能",
          "分析使用情况以改善体验",
          "就更新和功能与你沟通",
        ],
      },
    ],
  },
  {
    title: "数据存储与安全",
    blocks: [
      {
        kind: "p",
        text: "你的数据使用行业标准加密存储。我们用 Cloudflare D1 保存数据。文稿在传输和存储时都会加密。",
      },
      {
        kind: "p",
        text: "我们采取适当的技术和组织措施，防止个人信息被未经授权地访问、篡改、披露或销毁。",
      },
    ],
  },
  {
    title: "数据共享与披露",
    blocks: [
      { kind: "p", text: "我们不会出售、交易或以其他方式把你的个人信息交给第三方，除非：" },
      {
        kind: "ul",
        items: [
          "获得你的明确同意",
          "为履行法律义务",
          "为保护我们的权利和安全",
          "与业务转让或合并有关",
        ],
      },
      {
        kind: "p",
        text: "我们可能使用无法识别个人的匿名汇总数据，用于研究和统计分析。",
      },
    ],
  },
  {
    title: "你的权利",
    blocks: [
      { kind: "p", text: "你有权：" },
      {
        kind: "ul",
        items: [
          "访问你的个人数据",
          "更正不准确的信息",
          "删除账号及关联数据",
          "导出你的文稿",
          "拒绝营销沟通",
          "在适用时撤回同意",
        ],
      },
      { kind: "p", text: "如需行使这些权利，请通过下方“联系我们”中的方式联系我们。" },
    ],
  },
  {
    title: "Cookie 与追踪技术",
    blocks: [
      {
        kind: "p",
        text: "我们使用 Cookie 和类似技术来改善体验、记住偏好并分析使用情况。你可以在浏览器设置里管理 Cookie。",
      },
      {
        kind: "p",
        text: "必要 Cookie 是平台正常运行所必需的，无法关闭。可选 Cookie 帮助我们改进服务，你可以随时关闭。",
      },
    ],
  },
  {
    title: "开源承诺",
    blocks: [
      {
        kind: "p",
        text: "OpenWrite 是以 AGPL-3.0 许可发布的开源项目。源代码公开在 GitHub 上，便于社区审查我们的隐私和安全做法。",
      },
      {
        kind: "link",
        link: {
          before: "你可以在源代码中查看数据处理、安全实现和隐私措施：",
          href: github,
          label: "github.com/ilrein/openwrite",
          after: "。",
        },
      },
    ],
  },
  {
    title: "隐私政策变更",
    blocks: [
      {
        kind: "p",
        text: "我们可能不时更新本隐私政策。重大变更会发布在本页，并更新“最后更新”日期。",
      },
      { kind: "p", text: "变更后你继续使用 OpenWrite，即表示接受更新后的隐私政策。" },
    ],
  },
  {
    title: "联系我们",
    blocks: [
      { kind: "p", text: "对本隐私政策或我们的隐私做法有疑问，请联系我们：" },
      {
        kind: "link",
        link: {
          before: "GitHub Issues：",
          href: issues,
          label: "github.com/ilrein/openwrite/issues",
          after: "",
        },
      },
      { kind: "p", text: "邮箱：可通过我们的 GitHub 主页获取" },
    ],
  },
]

const terms: Record<Locale, LegalSection[]> = { en: termsEn, zh: termsZh }
const privacy: Record<Locale, LegalSection[]> = { en: privacyEn, zh: privacyZh }

export const legalCopy = (locale: Locale) => ({
  privacy: privacy[locale],
  terms: terms[locale],
})
