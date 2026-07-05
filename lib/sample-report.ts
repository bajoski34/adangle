// Real AdAngle output for ramp.com, baked in so the demo never depends on live APIs.
import type { PageBrief, GenOutput } from "./schemas";

export const SAMPLE_REPORT: {
  url: string;
  title: string;
  source: "firecrawl";
  brief: PageBrief;
  assets: GenOutput;
} = {
  "url": "https://www.ramp.com",
  "title": "Spend Management, Corporate Cards & Accounts Payable Solutions | Ramp",
  "source": "firecrawl",
  "brief": {
    "offer": "The visitor can get started with Ramp's spend management, corporate cards, and accounts payable solutions for free by providing their email.",
    "audience": "Finance professionals, controllers, CFOs, AP managers, and leaders of ambitious companies (especially those experiencing rapid growth) looking to automate and streamline corporate payments, expenses, and accounting processes with AI.",
    "primaryHook": "The page immediately promises to save both time and money by streamlining corporate financial operations (cards, expenses, bill payments, banking) with AI.",
    "painPoints": [
      "Wasting time and resources on manual financial processes (receipt chasing, manual coding, month-end close).",
      "Inefficiency and errors caused by using multiple, disconnected financial systems.",
      "Lack of real-time visibility and control over corporate spend and expenses.",
      "Burdensome administrative tasks that prevent finance teams from focusing on strategic work.",
      "Slow and cumbersome approval processes for procure-to-pay workflows."
    ],
    "proofElements": [
      "Specific volume of US corporate payments processed by Ramp.",
      "Claim of '70,000 of the world’s most ambitious companies' as customers.",
      "Statistic: customers 'growing 3.2x faster than the average American business'.",
      "Customer success stories/logos: Perplexity, Quora, 8vc, Eventbrite, Shopify, Zola, Notion, Vanta, Betterment, Mindbody & ClassPass, Eight Sleep, Studs, Boys & Girls Clubs of America, Seed Health, Poshmark, KIPP Nashville Public Schools, City of Ketchum, Sierra, Foursquare, Virgin Voyages, Pair Eyewear.",
      "Specific savings claim: '$1M+ saved on global spend' (with Vanta example).",
      "Aggregate statistics on 'AGENTS AT WORK TODAY' (e.g., receipts processed, accounting fields coded, total AI actions).",
      "Direct testimonials from finance leaders (e.g., Tyler Otto, Lauren Feeney, Neusha Sayadian, Shannon McCormick, Heather Bruzus, Tzu-San Hung, Matteo Franceschetti, Christine Mimnagh-Fleming, Carey Peek, Mayor Neil Bradshaw, Ben Whipple, Michael Litwin, Staci Robinson, Irish Rose, Andrew Clarke, Jason Penegar, Sarah Bird, Carolynn Yipp).",
      "Video testimonials/demos available."
    ],
    "cta": {
      "text": "Get started for free",
      "placement": "hero + sticky header + bottom of page"
    },
    "emotionalAngle": "aspiration",
    "angleEvidence": "'70,000 of the world's most ambitious companies' growing '3.2x faster than the average American business' — the page sells the company you could become, not the problem you have.",
    "weaknesses": [
      "The 'Get started for free' offer is vague; it's unclear what specifically is free, for how long, or if it's a freemium model vs. a limited trial, which creates friction for conversion.",
      "Excessive number of different calls-to-action (e.g., 'Get started for free', 'View Demo', 'Read the report', 'Watch Video', 'Switch in days', 'Explore Ramp Intelligence', 'Learn about Ramp Stack') creates decision paralysis and obscures the primary conversion path for a cold visitor.",
      "The page is extremely long and dense with information, product features, and proof points, risking cognitive overload and making it difficult for a new visitor to quickly grasp the core value proposition and next steps.",
      "Key differentiators like 'One platform for all of finance' and 'Switch in days, not months' are present but become buried in the extensive content, making it harder for visitors to quickly identify Ramp's competitive advantages."
    ]
  },
  "assets": {
    "googleRSA": {
      "headlines": [
        "Automate Spend with AI",
        "Cut Manual Finance Tasks",
        "Save $1M+ Annually",
        "Get Real-Time Spend Data",
        "Finance Teams, Work Smarter",
        "Ramp: One Finance Platform",
        "Trusted by 70,000+ Companies",
        "Grow 3.2X Faster with Ramp",
        "Corporate Cards & AP Free",
        "Streamline Expenses Today",
        "Switch in Days, Not Months",
        "End Receipt Chasing Now",
        "Free Spend Management",
        "CFOs Choose Ramp",
        "Get Started Free"
      ],
      "descriptions": [
        "Stop wasting time on manual work. Automate cards, AP & expenses with AI. Start free.",
        "70,000+ companies use Ramp to save time and money. Real-time control over spend.",
        "One AI-powered platform for cards, AP & expenses. Fewer errors, more efficiency.",
        "Switch in days, not months. Free your finance team for strategic work. Start free."
      ]
    },
    "meta": [
      {
        "primaryText": "Tired of manual receipt chasing & month-end chaos? Automate your corporate cards, AP, & expenses with AI-powered Ramp.",
        "headline": "Stop Manual Finance Tasks Today",
        "description": "Start Ramp for Free.",
        "angle": "Pain-led: Manual Processes"
      },
      {
        "primaryText": "Boost your company's growth 3.2x faster like 70,000 ambitious businesses. Ramp saves time & $1M+ annually.",
        "headline": "Grow Faster, Save $1M+ Annually",
        "description": "Join 70k+ Companies.",
        "angle": "Proof-led: Growth & Savings"
      },
      {
        "primaryText": "Imagine real-time spend visibility & approval in days, not months. Ramp unifies corporate cards, AP, & expenses with AI.",
        "headline": "Get Real-Time Spend Control",
        "description": "One Platform. Free.",
        "angle": "Outcome-led: Real-time Control & Speed"
      },
      {
        "primaryText": "Stop juggling disconnected finance systems. Ramp puts cards, AP & expenses on one AI platform. Get started free.",
        "headline": "Unified Finance With AI",
        "description": "Streamline Your Spend.",
        "angle": "Solution-led: AI & Unified Platform"
      },
      {
        "primaryText": "Free your finance team from admin work. AI handles receipts, coding, and approvals. Try Ramp free.",
        "headline": "Unlock Strategic Finance",
        "description": "Automate Admin. Free.",
        "angle": "Benefit-led: Strategic Focus"
      }
    ],
    "tiktokHooks": [
      "CFOs, are manual processes crushing your finance team's potential?",
      "What if your company could save $1M+ on spend and grow 3.2x faster?",
      "Hey finance pros, still chasing receipts? There's a better way.",
      "Imagine real-time spend control. No more guessing games.",
      "Stop wasting time on month-end close. Let AI handle the heavy lifting.",
      "This one change could free your finance team from admin tasks forever."
    ],
    "taboolaHeadlines": [
      "Finance Leaders: The #1 Secret to Faster Growth",
      "Company Spending Out of Control? See How AI Helps",
      "Is Your Finance Team Wasting Hours? Read This.",
      "Upgrade Corporate Cards & AP: A Free Solution",
      "70,000 Businesses Use This to Save Millions",
      "Ditch Manual Expense Reports Forever"
    ],
    "abTests": [
      {
        "hypothesis": "Clarifying the specific 'free' offer in the primary CTA will reduce friction and increase sign-ups, as visitors will understand the value proposition more clearly upfront.",
        "variantA": "Get started for free",
        "variantB": "Start your free 30-day trial (No credit card required)",
        "metric": "Conversion rate to email submission",
        "priority": "high"
      },
      {
        "hypothesis": "Reducing the number of secondary calls-to-action and prominently featuring only the primary 'Get started for free' CTA will reduce decision paralysis and guide visitors more directly to the conversion goal.",
        "variantA": "Current page with multiple CTAs (e.g., 'View Demo', 'Read the report', 'Watch Video', 'Switch in days', 'Explore Ramp Intelligence', 'Learn about Ramp Stack').",
        "variantB": "Consolidate secondary CTAs into a single 'Resources' section or move them to the footer, ensuring 'Get started for free' is the dominant and most visible CTA above the fold and at conversion points.",
        "metric": "Clicks on primary CTA, Conversion rate to email submission",
        "priority": "high"
      },
      {
        "hypothesis": "Bringing key differentiators like 'One platform for all of finance' and 'Switch in days, not months' into a more prominent position (e.g., hero section sub-headline or dedicated call-out) will quickly communicate Ramp's unique value, increasing engagement and conversion.",
        "variantA": "Current hero section with general value proposition, differentiators buried in content.",
        "variantB": "Hero section sub-headline: 'One Platform for All of Finance. Switch in days, not months.' or prominently featured bullet points directly below the main headline.",
        "metric": "Engagement rate (scroll depth, time on page), Clicks on primary CTA",
        "priority": "medium"
      },
      {
        "hypothesis": "Replacing generic ad-speak with concrete numbers and specific outcomes in the primary hook will resonate more with finance professionals, increasing their interest and willingness to explore the solution.",
        "variantA": "Current primary hook: 'save both time and money by streamlining corporate financial operations (cards, expenses, bill payments, banking) with AI.'",
        "variantB": "Primary hook: 'Cut month-end close by 50% and save $250k+ annually on corporate spend with AI-powered finance automation.' (Numbers are illustrative, to be replaced with actual customer data).",
        "metric": "Time on page, Clicks on primary CTA",
        "priority": "medium"
      }
    ],
    "lpFixes": [
      {
        "problem": "The 'Get started for free' offer is vague; it's unclear what specifically is free, for how long, or if it's a freemium model vs. a limited trial, which creates friction for conversion.",
        "fix": "Work with the product team to define a clear, enticing, and specific 'free' offer. Update all primary CTA buttons and accompanying text to explicitly state what is free (e.g., 'Start a Free 30-Day Trial', 'Get Free Corporate Cards', 'Free forever for up to 5 users'). This clarity will reduce uncertainty and boost conversions.",
        "effort": "moderate"
      },
      {
        "problem": "Excessive number of different calls-to-action (e.g., 'Get started for free', 'View Demo', 'Read the report', 'Watch Video', 'Switch in days', 'Explore Ramp Intelligence', 'Learn about Ramp Stack') creates decision paralysis and obscures the primary conversion path for a cold visitor.",
        "fix": "Conduct an audit of all CTAs. Remove or significantly de-emphasize all secondary CTAs (like 'View Demo', 'Read the report', 'Watch Video') from the main user flow and above the fold. Create a dedicated 'Resources' section or move supplementary content links to the footer to ensure the primary CTA ('Get started for free') is the clear, dominant action for new visitors.",
        "effort": "quick win"
      },
      {
        "problem": "The page is extremely long and dense with information, product features, and proof points, risking cognitive overload and making it difficult for a new visitor to quickly grasp the core value proposition and next steps.",
        "fix": "Implement an 'above the fold' simplification: Consolidate the most impactful value proposition, primary pain points addressed, and key differentiators (like 'One platform' and 'Switch in days') into a concise, easily digestible hero section. Leverage accordions or tabs for detailed feature breakdowns further down the page, allowing users to self-select what information they want to consume.",
        "effort": "significant"
      }
    ]
  }
};
