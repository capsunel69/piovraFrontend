export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date | null;
  timeSpent: number; // in seconds
  timers: TimerSession[];
  subtasks?: Subtask[]; // Checklist items belonging to this task
  convertedFromReminder?: string; // ID of the reminder this task was converted from
  order?: number; // For manual sorting/reordering
}

export interface Meeting {
  id: string;
  title: string;
  description: string;
  date: Date;
  duration: number; // in minutes
  participants: string[];
  notes: string;
  completed: boolean;
  googleEventId?: string | null;
  googleHtmlLink?: string | null;
  googleCalendarId?: string | null;
  lastSyncedAt?: Date | null;
}

export interface CalendarStatus {
  connected: boolean;
  scopes: string[];
  calendarConnected: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
}

export interface CalendarSyncResult {
  changed: number;
  deleted: number;
  performedFullSync: boolean;
}

export interface Reminder {
  id: string;
  title: string;
  description: string;
  date: Date;
  completed: boolean;
  recurring?: 'daily' | 'weekly' | 'monthly';
  recurringConfig?: {
    type: string;
    subtype?: 'dayOfMonth' | 'relativeDay';
    dayOfWeek?: number;
    dayOfMonth?: number;
    weekNum?: number;
  };
  convertedToTask?: boolean; // Whether this reminder has been converted to a task (for non-recurring)
  convertedToTaskDates?: string[]; // Dates when recurring reminder was converted to task
  completedInstances?: Date[]; // Dates when recurring reminder was completed
}

export interface Journal {
  id: string;
  title: string;
  content: string; // HTML content
  date: Date;
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
}

export interface TimerSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  /** Piovra does not persist this; omitted when loaded from API → treat as 0. */
  breakTime?: number;
}

export interface Contact {
  id: string;
  displayName: string;
  email: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GmailCorrespondentSuggestion {
  email: string;
  name: string | null;
  lastMessageMs: string | null;
}

/* ── Work chat ───────────────────────────────────────────────────────── */

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'user' | 'admin';
}

export interface ChatChannel {
  id: string;
  name: string;
  topic: string;
  /** User id of the admin who created it. */
  createdBy: string;
  createdAt: string;
  /** Ordered list of pinned message ids. Newest first. */
  pinnedMessageIds: string[];
}

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  /** Set when fetching fails so we don't keep retrying. */
  failed?: boolean;
}

export interface ChatGifAttachment {
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  alt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorPictureUrl: string | null;
  /** Raw text the user typed. Rendered with link auto-detection. */
  text: string;
  /** Optional GIF attachment selected from the picker. */
  gif?: ChatGifAttachment;
  createdAt: string;
  editedAt?: string;
  /** Emoji → user ids who reacted with it. */
  reactions: Record<string, string[]>;
  /** Pinned at this ISO timestamp (set by admin). */
  pinnedAt?: string;
  pinnedBy?: string;
}

/** Per-channel read receipt state for the local user. */
export interface ChannelReadState {
  channelId: string;
  /** ISO timestamp of the latest message the user has seen. */
  lastReadAt: string;
}