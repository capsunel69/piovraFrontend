import body00 from './articles/00-overview.md?raw';
import body01 from './articles/01-dashboard.md?raw';
import body02 from './articles/02-tasks.md?raw';
import body03 from './articles/03-meetings.md?raw';
import body04 from './articles/04-reminders.md?raw';
import body05 from './articles/05-notes.md?raw';
import body06 from './articles/06-contacts.md?raw';
import body07 from './articles/07-timer.md?raw';
import body08 from './articles/08-agents-chat.md?raw';
import body09 from './articles/09-admin.md?raw';
import body10 from './articles/10-editing-documentation.md?raw';

export interface DocArticle {
  /** Stable id for `?article=` and scroll targets */
  id: string;
  title: string;
  /** Sidebar grouping */
  section: string;
  /** Extra tokens for search (space/comma separated) */
  keywords: string;
  body: string;
}

/**
 * Single source of truth for in-app documentation.
 * Add `.md` files under `src/docs/articles/`, import with `?raw`, append here.
 */
export const DOC_ARTICLES: DocArticle[] = [
  {
    id: 'overview',
    title: 'Overview & sign-in',
    section: 'Introduction',
    keywords: 'google oauth piovra env database localStorage session cookie',
    body: body00,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    section: 'Workspace',
    keywords: 'home stats summary',
    body: body01,
  },
  {
    id: 'tasks',
    title: 'Tasks',
    section: 'Workspace',
    keywords: 'subtasks timer priority due checklist piovra.tasks',
    body: body02,
  },
  {
    id: 'meetings',
    title: 'Meetings',
    section: 'Workspace',
    keywords: 'calendar agenda participants duration piovra.meetings',
    body: body03,
  },
  {
    id: 'reminders',
    title: 'Reminders',
    section: 'Workspace',
    keywords: 'recurring daily weekly monthly convert task piovra.reminders',
    body: body04,
  },
  {
    id: 'notes',
    title: 'Notes & journals',
    section: 'Workspace',
    keywords: 'tiptap rich text tags pin search journals piovra.notes',
    body: body05,
  },
  {
    id: 'contacts',
    title: 'Contacts',
    section: 'Workspace',
    keywords: 'email gmail suggestions assistant snapshot',
    body: body06,
  },
  {
    id: 'timer',
    title: 'Timer',
    section: 'Workspace',
    keywords: 'stopwatch pause break session sticky',
    body: body07,
  },
  {
    id: 'agents-chat',
    title: 'Agents, chat & Piovra',
    section: 'AI',
    keywords: 'orchestrate definitions instances schedules cron runs reports usage sse skills gmail',
    body: body08,
  },
  {
    id: 'admin',
    title: 'Admin',
    section: 'Operations',
    keywords: 'role users operator',
    body: body09,
  },
  {
    id: 'editing-docs',
    title: 'Maintaining this documentation',
    section: 'Contributors',
    keywords: 'markdown registry search vite raw',
    body: body10,
  },
];

export function articleById(id: string | null | undefined): DocArticle | undefined {
  if (!id) return undefined;
  return DOC_ARTICLES.find((a) => a.id === id);
}

export function matchesDocSearch(article: DocArticle, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${article.title}\n${article.section}\n${article.keywords}\n${article.body}`.toLowerCase();
  const parts = q.split(/\s+/).filter(Boolean);
  return parts.every((p) => hay.includes(p));
}
