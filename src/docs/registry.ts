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
    title: 'Welcome & account',
    section: 'Getting started',
    keywords: 'sign in google login logout profile data sync assistant email connection trouble',
    body: body00,
  },
  {
    id: 'dashboard',
    title: 'Home overview',
    section: 'Getting started',
    keywords: 'summary first screen stats shortcuts',
    body: body01,
  },
  {
    id: 'tasks',
    title: 'Tasks & checklists',
    section: 'Day to day',
    keywords: 'subtasks timer priority due checklist done delete',
    body: body02,
  },
  {
    id: 'meetings',
    title: 'Meetings',
    section: 'Day to day',
    keywords: 'calendar agenda participants duration video zoom',
    body: body03,
  },
  {
    id: 'reminders',
    title: 'Reminders',
    section: 'Day to day',
    keywords: 'recurring daily weekly monthly snooze convert task alarm',
    body: body04,
  },
  {
    id: 'notes',
    title: 'Notes',
    section: 'Day to day',
    keywords: 'journal writing tags search pin rich text',
    body: body05,
  },
  {
    id: 'contacts',
    title: 'Contacts & email',
    section: 'Day to day',
    keywords: 'people address gmail suggestions assistant mail duplicate',
    body: body06,
  },
  {
    id: 'timer',
    title: 'Focus timer',
    section: 'Day to day',
    keywords: 'stopwatch pause break session tracking',
    body: body07,
  },
  {
    id: 'agents-chat',
    title: 'Assistant & Agents',
    section: 'Automation',
    keywords: 'chat bubble schedule automatic run history usage tools google permission',
    body: body08,
  },
  {
    id: 'admin',
    title: 'Admin (operators)',
    section: 'For organisations',
    keywords: 'role users owner settings',
    body: body09,
  },
  {
    id: 'editing-docs',
    title: 'Updating these guides',
    section: 'Technical',
    keywords: 'markdown developer registry article id vite',
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
