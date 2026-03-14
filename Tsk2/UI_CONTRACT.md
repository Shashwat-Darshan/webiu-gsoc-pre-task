# UI Contract — GitHub Repository Intelligence Analyzer
# For use with external AI tools (v0.dev, Cursor, Bolt, etc.)

## Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Recharts (for score visualizations)

## Environment Variable
```
NEXT_PUBLIC_API_URL=http://localhost:8000   # FastAPI backend
```

---

## Pages

### `/` — Home / Analysis Input Page

**Purpose**: User enters GitHub repo URLs and triggers analysis.

**Layout**:
```
┌──────────────────────────────────────────────────┐
│  🔍 GitHub Repo Intelligence Analyzer             │
│     Analyze activity, complexity & difficulty     │
├──────────────────────────────────────────────────┤
│                                                  │
│  GitHub Token (optional)  [________________]     │
│  ℹ️ Increases rate limit from 60 to 5000 req/hr  │
│                                                  │
│  Repositories to analyze:                        │
│  [ https://github.com/owner/repo         ] [−]   │
│  [ https://github.com/owner/repo2        ] [−]   │
│  [+ Add repository]                              │
│                                                  │
│            [ Analyze Repositories ]              │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Behavior**:
- "Add repository" appends a new text input
- Inputs validate URL format on blur (`https://github.com/{owner}/{repo}`)
- Invalid URLs show red border + "Must be a valid GitHub repository URL"
- "Analyze" button disabled until at least one valid URL is entered
- On submit: POST to `$NEXT_PUBLIC_API_URL/analyze` with `{ repos: string[], github_token?: string }`
- During loading: show spinner + "Analyzing {n} repositories…" message
- On success: navigate to `/results` (or render results below on same page)
- On API error: show toast notification with error message

---

### `/results` (or inline section below input) — Analysis Results

**Purpose**: Display scored reports for each analyzed repository.

**Layout — Summary cards grid**:
```
┌──────────────────────────────────────────────────┐
│  Analysis Complete — 5 repositories analyzed      │
│  Timestamp: 2026-03-12 10:00 UTC                 │
│                                                  │
│  [Filter: All ▾] [Sort: Activity ▾]              │
├──────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐  │
│  │ nestjs/nest        │  │ c2siorg/Webiu      │  │
│  │ ⭐ 68,200  🍴 7,700│  │ ⭐ 120   🍴 45    │  │
│  │                    │  │                    │  │
│  │ Activity    94 ██▓ │  │ Activity    61 ██░ │  │
│  │ Complexity  81 ██░ │  │ Complexity  47 █░░ │  │
│  │                    │  │                    │  │
│  │ [Advanced]         │  │ [Intermediate]     │  │
│  │ TypeScript         │  │ TypeScript         │  │
│  │                    │  │                    │  │
│  │ [View Details →]   │  │ [View Details →]   │  │
│  └────────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**Difficulty badge colors**:
- Beginner → green (`bg-green-100 text-green-800`)
- Intermediate → yellow (`bg-yellow-100 text-yellow-800`)
- Advanced → red (`bg-red-100 text-red-800`)
- Unknown → gray

**Score bar colors**:
- 0–33 → red
- 34–66 → yellow
- 67–100 → green

---

### `/results/{owner}/{repo}` — Repository Detail Page

**Layout**:
```
┌──────────────────────────────────────────────────┐
│ ← Back to results                                │
│                                                  │
│  nestjs/nest                      [Advanced]     │
│  github.com/nestjs/nest                         │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────┐  ┌─────────────────┐       │
│  │ Activity Score  │  │ Complexity Score │       │
│  │      94         │  │       81         │       │
│  │  [radial gauge] │  │  [radial gauge]  │       │
│  └─────────────────┘  └─────────────────┘       │
│                                                  │
│  ── Stats ──────────────────────────────────    │
│  ⭐ Stars: 68,200      🍴 Forks: 7,700          │
│  🐛 Open Issues: 144   👥 Contributors: 450     │
│  📦 Releases (1yr): 18  🔤 Languages: 2         │
│  📅 Last Commit: 1 day ago                      │
│  📝 Commits (90d): 312  ✅ Closed Issues (90d): 87 │
│  📁 Files: 2,840        🗂️ Max depth: 7          │
│                                                  │
│  ── Language Breakdown ─────────────────────    │
│  [Horizontal stacked bar chart]                 │
│  TypeScript 97.2%  •  JavaScript 2.8%           │
│                                                  │
│  ── Analysis Notes ─────────────────────────    │
│  ✓ Very high commit frequency                   │
│  ✓ Large contributor base (450)                 │
│  ✓ Multiple releases this year                  │
│  ⚠ Deep folder structure                        │
│                                                  │
│  ── Raw JSON ───────────────────────────────    │
│  [Collapsible code block]                       │
└──────────────────────────────────────────────────┘
```

---

## TypeScript Types

```typescript
// types/analyzer.ts

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced' | 'Unknown';
export type DataQuality = 'complete' | 'partial' | 'unavailable';

export interface RepoAnalysis {
  repo: string;                    // "owner/name"
  url: string;
  stars: number;
  forks: number;
  open_issues: number;
  primary_language: string | null;
  languages: Record<string, number>;  // { "TypeScript": 97.2, ... }
  contributors_count: number;
  commits_last_90d: number;
  closed_issues_last_90d: number;
  releases_last_year: number;
  days_since_last_commit: number;
  file_count: number;
  folder_depth: number;
  has_dependency_file: boolean;
  language_count: number;
  activity_score: number | null;
  complexity_score: number | null;
  difficulty: Difficulty;
  notes: string[];
  data_quality: DataQuality;
  error?: string;
}

export interface AnalysisResponse {
  analyzed_at: string;             // ISO 8601
  total: number;
  results: RepoAnalysis[];
}

export interface AnalyzeRequest {
  repos: string[];
  github_token?: string;
}
```

---

## API Calls (Next.js)

```typescript
// lib/api.ts

export async function analyzeRepos(
  repos: string[],
  githubToken?: string
): Promise<AnalysisResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repos, github_token: githubToken }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }

  return res.json() as Promise<AnalysisResponse>;
}
```

---

## Components to build

| Component | File | Props |
|-----------|------|-------|
| `RepoInputForm` | `components/RepoInputForm.tsx` | `onSubmit(repos, token)` |
| `RepoCard` | `components/RepoCard.tsx` | `analysis: RepoAnalysis` |
| `ScoreBar` | `components/ScoreBar.tsx` | `label, score: number, max=100` |
| `ScoreGauge` | `components/ScoreGauge.tsx` | `score: number, label: string` (Recharts RadialBarChart) |
| `DifficultyBadge` | `components/DifficultyBadge.tsx` | `difficulty: Difficulty` |
| `LanguageBar` | `components/LanguageBar.tsx` | `languages: Record<string, number>` |
| `AnalysisNotes` | `components/AnalysisNotes.tsx` | `notes: string[]` |
| `ErrorCard` | `components/ErrorCard.tsx` | `repo: string, error: string` |
| `LoadingState` | `components/LoadingState.tsx` | `count: number` |

---

## Prompt for external AI (copy-paste into v0.dev / Cursor)

```
Build a Next.js 14 App Router application with Tailwind CSS and shadcn/ui.

The app is a "GitHub Repository Intelligence Analyzer" UI. It has three pages:

1. Home page (/): A form where users can paste 1 or more GitHub repository URLs 
   (one per input, with add/remove buttons) and optionally a GitHub token. 
   Submits a POST to NEXT_PUBLIC_API_URL/analyze.

2. Results page: Renders a grid of RepoCard components — one per analyzed repo.
   Each card shows repo name, stars, forks, activity score (colored bar), 
   complexity score (colored bar), and a color-coded difficulty badge 
   (Beginner=green, Intermediate=yellow, Advanced=red).
   Cards are clickable to navigate to the detail page.

3. Detail page (/results/[owner]/[repo]): Shows all stats in a two-column layout.
   Includes: radial score gauges (Recharts RadialBarChart), language breakdown 
   (horizontal stacked bar), analysis notes list, and a collapsible raw JSON block.

TypeScript types are in types/analyzer.ts — use them for all props and API calls.
API call logic is in lib/api.ts.

Use these TypeScript types:
[paste the types block from above]

Color scheme: dark background (#0f172a), accent blue (#3b82f6). 
Make it look professional and data-dense, like a developer tool dashboard.
Mobile responsive. No authentication required.
```
