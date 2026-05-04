import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isSameDay } from 'date-fns';
import type { Task, Meeting, Reminder, TimerSession, Journal, Contact } from '../types';
import { TasksAPI, MeetingsAPI, RemindersAPI, JournalsAPI, ContactsAPI } from '../services/api';
import { useToast } from '../components/ui/Toast';

interface AppContextType {
  // Tasks
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'timeSpent' | 'timers'>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  toggleTaskCompletion: (taskId: string) => void;
  reorderTasks: (reorderedTasks: Task[]) => void;
  
  // Meetings
  meetings: Meeting[];
  addMeeting: (meeting: Omit<Meeting, 'id'>) => void;
  updateMeeting: (meetingId: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (meetingId: string) => void;
  toggleMeetingCompletion: (meetingId: string) => void;
  
  // Reminders
  reminders: Reminder[];
  addReminder: (reminder: Omit<Reminder, 'id'>) => void;
  updateReminder: (reminderId: string, updates: Partial<Reminder>) => void;
  deleteReminder: (reminderId: string) => void;
  toggleReminderCompletion: (reminderId: string) => void;
  convertReminderToTask: (reminderId: string) => void;
  
  // Journals
  journals: Journal[];
  addJournal: (journal: Omit<Journal, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateJournal: (journalId: string, updates: Partial<Journal>) => void;
  deleteJournal: (journalId: string) => void;
  searchJournals: (query: string) => Promise<Journal[]>;
  
  // Timer
  startTimer: (taskId: string, initialTime?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: (taskId: string) => void;
  activeTaskId: string | null;
  currentTimer: number; // Current timer in seconds
  isPaused: boolean;
  breakTime: number;

  // Current Date
  currentDate: Date;
  setCurrentDate: (date: Date) => void;

  // Loading states
  isLoading: boolean;
  isAddingTask: boolean;
  isDeletingTask: boolean;
  isUpdatingTask: boolean;
  isTogglingTask: boolean;
  error: string | null;

  // New properties
  canConvertReminderToTask: (reminder: Reminder) => boolean;

  // Journal PIN verification
  isJournalPinVerified: boolean;
  setJournalPinVerified: (verified: boolean) => void;

  // Background refresh — used after the agent mutates data via piovra
  // skills so the UI reflects the change without a manual reload.
  refreshTasks: () => Promise<void>;
  refreshMeetings: () => Promise<void>;
  refreshReminders: () => Promise<void>;
  refreshJournals: () => Promise<void>;

  contacts: Contact[];
  addContact: (input: { displayName: string; email: string; description?: string }) => Promise<void>;
  updateContact: (id: string, updates: Partial<Pick<Contact, 'displayName' | 'email' | 'description'>>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
  refreshContacts: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Read cached value from localStorage (synchronous; used for instant hydration)
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage`, error);
    return defaultValue;
  }
};

// Write to localStorage (always – including empty arrays so deletions persist)
const saveToLocalStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage`, error);
  }
};

// Cache keys
const CK = {
  tasks: 'tasks',
  meetings: 'meetings',
  reminders: 'reminders',
  journals: 'journals',
} as const;

// Lightweight equality check for the reminder cleanup so we only PUT when something
// actually changed (avoids spamming the API on every page load).
const sameStringSet = (a: string[] = [], b: string[] = []): boolean => {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const v of b) if (!sa.has(v)) return false;
  return true;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Hydrate synchronously from localStorage so the UI renders instantly with cached data.
  // The API refresh below silently replaces the data once the network responds.
  const cachedTasks = loadFromLocalStorage<Task[]>(CK.tasks, []);
  const cachedMeetings = loadFromLocalStorage<Meeting[]>(CK.meetings, []);
  const cachedReminders = loadFromLocalStorage<Reminder[]>(CK.reminders, []);
  const cachedJournals = loadFromLocalStorage<Journal[]>(CK.journals, []);

  const [tasks, setTasks] = useState<Task[]>(cachedTasks);
  const [meetings, setMeetings] = useState<Meeting[]>(cachedMeetings);
  const [reminders, setReminders] = useState<Reminder[]>(cachedReminders);
  const [journals, setJournals] = useState<Journal[]>(cachedJournals);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Only show the full-screen loader on the very first load (no cache yet).
  const hasCache =
    cachedTasks.length + cachedMeetings.length + cachedReminders.length + cachedJournals.length > 0;
  const [isLoading, setIsLoading] = useState(!hasCache);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [isTogglingTask, setIsTogglingTask] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timer state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [currentTimer, setCurrentTimer] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [breakTime, setBreakTime] = useState<number>(0);
  const timerIntervalRef = useRef<number | null>(null);
  const breakIntervalRef = useRef<number | null>(null);
  const timerStateRestoredRef = useRef<boolean>(false);

  // Current date state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Journal PIN verification state
  const [isJournalPinVerified, setJournalPinVerified] = useState(false);

  // Toasts
  const toast = useToast();

  // Load fresh data from the API. We render cached data immediately and
  // swap in fresh data when the network responds. Reminder cleanup runs
  // in the background and only writes back what actually changed.
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      setError(null);
      try {
        const [tasksData, meetingsData, remindersData, journalsData] = await Promise.all([
          TasksAPI.getAll(),
          MeetingsAPI.getAll(),
          RemindersAPI.getAll(),
          JournalsAPI.getAll(),
        ]);
        if (cancelled) return;

        setTasks(tasksData);
        setMeetings(meetingsData);
        setReminders(remindersData);
        setJournals(journalsData);

        // Reconcile reminder ↔ task conversion state in the background.
        // Only PUT reminders whose state actually changed.
        void reconcileReminders(remindersData, tasksData).then((fixed) => {
          if (!cancelled && fixed) setReminders(fixed);
        });

        try {
          const contactsData = await ContactsAPI.getAll();
          if (!cancelled) setContacts(contactsData);
        } catch (err) {
          console.warn('Contacts load skipped or failed', err);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        if (!cancelled && !hasCache) {
          setError('Failed to load data.');
        }
        // If we have cached data we silently keep it — no need to alarm the user.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    refresh();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-resource pull. Called after the agent runs a `capsuna.*` mutation skill
  // so the relevant page (Tasks / Meetings / Reminders) catches up live without
  // a manual refresh. Errors are swallowed (cached state is fine to keep).
  const refreshTasks = useCallback(async (): Promise<void> => {
    try {
      const fresh = await TasksAPI.getAll();
      setTasks(fresh);
    } catch (err) {
      console.warn('refreshTasks failed', err);
    }
  }, []);

  const refreshMeetings = useCallback(async (): Promise<void> => {
    try {
      const fresh = await MeetingsAPI.getAll();
      setMeetings(fresh);
    } catch (err) {
      console.warn('refreshMeetings failed', err);
    }
  }, []);

  const refreshReminders = useCallback(async (): Promise<void> => {
    try {
      const fresh = await RemindersAPI.getAll();
      setReminders(fresh);
    } catch (err) {
      console.warn('refreshReminders failed', err);
    }
  }, []);

  const refreshJournals = useCallback(async (): Promise<void> => {
    try {
      const fresh = await JournalsAPI.getAll();
      setJournals(fresh);
    } catch (err) {
      console.warn('refreshJournals failed', err);
    }
  }, []);

  const refreshContacts = useCallback(async (): Promise<void> => {
    try {
      const fresh = await ContactsAPI.getAll();
      setContacts(fresh);
    } catch (err) {
      console.warn('refreshContacts failed', err);
    }
  }, []);

  const addContact = useCallback(
    async (input: { displayName: string; email: string; description?: string }) => {
      try {
        const row = await ContactsAPI.create(input);
        setContacts((prev) =>
          [...prev, row].sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })),
        );
        toast.success('Contact saved', row.displayName);
      } catch (err) {
        console.error('Error adding contact:', err);
        setError('Failed to add contact');
        toast.error('Could not save contact');
      }
    },
    [toast],
  );

  const updateContact = useCallback(
    async (id: string, updates: Partial<Pick<Contact, 'displayName' | 'email' | 'description'>>) => {
      try {
        const row = await ContactsAPI.update(id, updates);
        setContacts((prev) =>
          prev
            .map((c) => (c.id === id ? row : c))
            .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })),
        );
      } catch (err) {
        console.error('Error updating contact:', err);
        setError('Failed to update contact');
        toast.error('Could not update contact');
      }
    },
    [toast],
  );

  const deleteContact = useCallback(
    async (id: string) => {
      try {
        await ContactsAPI.delete(id);
        setContacts((prev) => prev.filter((c) => c.id !== id));
        toast.success('Contact removed');
      } catch (err) {
        console.error('Error deleting contact:', err);
        setError('Failed to delete contact');
        toast.error('Could not remove contact');
      }
    },
    [toast],
  );

  // Reconcile reminder conversion state against actual tasks. Returns the
  // updated reminder list only if something changed; otherwise null.
  const reconcileReminders = async (
    remindersData: Reminder[],
    tasksData: Task[],
  ): Promise<Reminder[] | null> => {
    const writes: Promise<unknown>[] = [];
    let dirty = false;

    const next = remindersData.map((reminder) => {
      if (reminder.recurring) {
        const validDates = (reminder.convertedToTaskDates || []).filter((date) => {
          const convertedDate = new Date(date);
          convertedDate.setHours(0, 0, 0, 0);
          return tasksData.some(
            (task) =>
              task.convertedFromReminder === reminder.id &&
              isSameDay(new Date(task.createdAt), convertedDate),
          );
        });

        if (!sameStringSet(validDates, reminder.convertedToTaskDates || [])) {
          dirty = true;
          writes.push(
            RemindersAPI.update(reminder.id, { convertedToTaskDates: validDates }).catch((e) =>
              console.warn('reminder reconcile failed', e),
            ),
          );
          return { ...reminder, convertedToTaskDates: validDates };
        }
        return reminder;
      }

      const hasAssociatedTask = tasksData.some((t) => t.convertedFromReminder === reminder.id);
      if (hasAssociatedTask !== !!reminder.convertedToTask) {
        dirty = true;
        writes.push(
          RemindersAPI.update(reminder.id, { convertedToTask: hasAssociatedTask }).catch((e) =>
            console.warn('reminder reconcile failed', e),
          ),
        );
        return { ...reminder, convertedToTask: hasAssociatedTask };
      }
      return reminder;
    });

    if (!dirty) return null;
    void Promise.all(writes);
    return next;
  };

  // Persist every change to localStorage (including empty arrays so deletions survive reloads)
  useEffect(() => { saveToLocalStorage(CK.tasks, tasks); }, [tasks]);
  useEffect(() => { saveToLocalStorage(CK.meetings, meetings); }, [meetings]);
  useEffect(() => { saveToLocalStorage(CK.reminders, reminders); }, [reminders]);
  useEffect(() => { saveToLocalStorage(CK.journals, journals); }, [journals]);
  
  // Clean up timer interval when component unmounts
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Load timer state from localStorage AFTER tasks are loaded
  useEffect(() => {
    // Only restore timer state once, after tasks have been loaded
    if (isLoading || timerStateRestoredRef.current) return;
    
    timerStateRestoredRef.current = true;
    
    const savedTimer = localStorage.getItem('timerState');
    if (savedTimer) {
      const timerState = JSON.parse(savedTimer);
      
      // Validate that the task still exists and is not completed
      const task = tasks.find(t => t.id === timerState.taskId);
      if (!task || task.completed) {
        // Task no longer exists or is completed - clear stale timer state
        localStorage.removeItem('timerState');
        return;
      }
      
      setActiveTaskId(timerState.taskId);
      setCurrentTimer(timerState.time);
      setIsPaused(timerState.isPaused);
      setBreakTime(timerState.breakTime || 0);

      // If timer was running and not paused, restart it
      if (timerState.taskId && !timerState.isPaused) {
        startTimer(timerState.taskId, timerState.time);
      }
    }
  }, [isLoading, tasks]);

  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    if (activeTaskId || currentTimer > 0) {
      const timerState = {
        taskId: activeTaskId,
        time: currentTimer,
        isPaused,
        breakTime
      };
      localStorage.setItem('timerState', JSON.stringify(timerState));
    }
  }, [activeTaskId, currentTimer, isPaused, breakTime]);

  // Task functions
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt' | 'timeSpent' | 'timers'>) => {
    setIsAddingTask(true);
    setError(null);
    try {
      const newTask = await TasksAPI.create(task);
      setTasks(prev => [...prev, newTask]);
      toast.success('Task created', newTask.title);
    } catch (err) {
      console.error('Error adding task:', err);
      setError('Failed to add task');
      toast.error('Could not create task', 'Please try again');
    } finally {
      setIsAddingTask(false);
    }
  }, [toast]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    setIsUpdatingTask(true);
    setError(null);
    try {
      const updatedTask = await TasksAPI.update(taskId, updates);
      setTasks(prev => prev.map(task => task.id === taskId ? updatedTask : task));
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task');
      
      // Update local state even if API fails
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, ...updates } : task));
    } finally {
      setIsUpdatingTask(false);
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    setIsDeletingTask(true);
    setError(null);
    
    // Find the task first to check if it's linked to a reminder
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      setIsDeletingTask(false);
      return;
    }
    
    try {
      await TasksAPI.delete(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Task deleted', task.title);

      // If this task was converted from a reminder, update the reminder's state
      if (task.convertedFromReminder) {
        const reminder = reminders.find(r => r.id === task.convertedFromReminder);
        if (reminder) {
          if (reminder.recurring) {
            // Remove the conversion date for this task
            const taskDate = new Date(task.createdAt);
            taskDate.setHours(0, 0, 0, 0);
            const updatedDates = (reminder.convertedToTaskDates || [])
              .filter(date => !isSameDay(new Date(date), taskDate));
            
            await RemindersAPI.update(reminder.id, { convertedToTaskDates: updatedDates });
            setReminders(prev => prev.map(r => 
              r.id === reminder.id 
                ? { ...r, convertedToTaskDates: updatedDates }
                : r
            ));
          } else {
            // Reset the conversion state
            await RemindersAPI.update(reminder.id, { convertedToTask: false });
            setReminders(prev => prev.map(r => 
              r.id === reminder.id 
                ? { ...r, convertedToTask: false }
                : r
            ));
          }
        }
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task');
      toast.error('Could not delete task');

      setTasks(prev => prev.filter(t => t.id !== taskId));
    } finally {
      setIsDeletingTask(false);
    }
  }, [tasks, reminders, toast]);

  const toggleTaskCompletion = useCallback(async (taskId: string) => {
    setIsTogglingTask(true);
    setError(null);
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      setIsTogglingTask(false);
      return;
    }
    
    try {
      const updatedTask = await TasksAPI.update(taskId, { 
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : undefined
      });
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      
      // If this task was converted from a reminder, update the reminder status accordingly
      if (task.convertedFromReminder) {
        const associatedReminder = reminders.find(r => r.id === task.convertedFromReminder);
        
        if (associatedReminder) {
          if (!task.completed) {
            // Task was completed, update the reminder status
            if (associatedReminder.recurring) {
              // For recurring reminders, add the completion date
              const taskDate = new Date(task.createdAt);
              taskDate.setHours(0, 0, 0, 0);
              const updatedDates = [...(associatedReminder.convertedToTaskDates || []), taskDate.toISOString()];
              
              await RemindersAPI.update(associatedReminder.id, { 
                convertedToTaskDates: updatedDates 
              });
              setReminders(prev => prev.map(r => 
                r.id === associatedReminder.id 
                  ? { ...r, convertedToTaskDates: updatedDates }
                  : r
              ));
            } else {
              // For non-recurring reminders, mark as converted
              await RemindersAPI.update(associatedReminder.id, { convertedToTask: true });
              setReminders(prev => prev.map(r => 
                r.id === associatedReminder.id 
                  ? { ...r, convertedToTask: true }
                  : r
              ));
            }
          }
        }
      }
    } catch (err) {
      console.error('Error toggling task completion:', err);
      setError('Failed to update task');
      
      // Update local state even if API fails
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
    } finally {
      setIsTogglingTask(false);
    }
  }, [tasks, reminders]);

  const reorderTasks = useCallback(async (reorderedTasks: Task[]) => {
    // Update local state immediately for responsiveness
    setTasks(reorderedTasks);
    
    // Update order field for each task and save to API
    try {
      const updatePromises = reorderedTasks
        .filter(task => !task.completed)
        .map((task, index) => 
          TasksAPI.update(task.id, { order: index })
        );
      await Promise.all(updatePromises);
    } catch (err) {
      console.error('Error saving task order:', err);
      // Don't revert local state - the order change still works locally
    }
  }, []);

  // Meeting functions
  const addMeeting = useCallback(async (meeting: Omit<Meeting, 'id'>) => {
    try {
      const newMeeting = await MeetingsAPI.create(meeting);
      setMeetings(prev => [...prev, newMeeting]);
      toast.success('Meeting scheduled', newMeeting.title);
    } catch (err) {
      console.error('Error adding meeting:', err);
      setError('Failed to add meeting');
      toast.error('Could not schedule meeting');

      const localMeeting: Meeting = { ...meeting, id: uuidv4() };
      setMeetings(prev => [...prev, localMeeting]);
    }
  }, [toast]);

  const updateMeeting = useCallback(async (meetingId: string, updates: Partial<Meeting>) => {
    try {
      const updatedMeeting = await MeetingsAPI.update(meetingId, updates);
      setMeetings(prev => prev.map(meeting => meeting.id === meetingId ? updatedMeeting : meeting));
    } catch (err) {
      console.error('Error updating meeting:', err);
      setError('Failed to update meeting');
      
      // Update local state even if API fails
      setMeetings(prev => prev.map(meeting => meeting.id === meetingId ? { ...meeting, ...updates } : meeting));
    }
  }, []);

  const deleteMeeting = useCallback(async (meetingId: string) => {
    const m = meetings.find(x => x.id === meetingId);
    try {
      await MeetingsAPI.delete(meetingId);
      setMeetings(prev => prev.filter(meeting => meeting.id !== meetingId));
      toast.success('Meeting deleted', m?.title);
    } catch (err) {
      console.error('Error deleting meeting:', err);
      setError('Failed to delete meeting');
      toast.error('Could not delete meeting');

      setMeetings(prev => prev.filter(meeting => meeting.id !== meetingId));
    }
  }, [meetings, toast]);

  const toggleMeetingCompletion = useCallback(async (meetingId: string) => {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    
    try {
      const updatedMeeting = await MeetingsAPI.update(meetingId, { completed: !meeting.completed });
      setMeetings(prev => prev.map(m => m.id === meetingId ? updatedMeeting : m));
    } catch (err) {
      console.error('Error toggling meeting completion:', err);
      setError('Failed to update meeting');
      
      // Update local state even if API fails
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, completed: !m.completed } : m));
    }
  }, [meetings]);

  // Reminder functions
  const addReminder = useCallback(async (reminder: Omit<Reminder, 'id'>) => {
    try {
      const newReminder = await RemindersAPI.create(reminder);
      setReminders(prev => [...prev, newReminder]);
      toast.success('Reminder added', newReminder.title);
    } catch (err) {
      console.error('Error adding reminder:', err);
      setError('Failed to add reminder');
      toast.error('Could not add reminder');

      const localReminder: Reminder = { ...reminder, id: uuidv4() };
      setReminders(prev => [...prev, localReminder]);
    }
  }, [toast]);

  const updateReminder = useCallback(async (reminderId: string, updates: Partial<Reminder>) => {
    try {
      const updatedReminder = await RemindersAPI.update(reminderId, updates);
      setReminders(prev => prev.map(reminder => reminder.id === reminderId ? updatedReminder : reminder));
    } catch (err) {
      console.error('Error updating reminder:', err);
      setError('Failed to update reminder');
      
      // Update local state even if API fails
      setReminders(prev => prev.map(reminder => reminder.id === reminderId ? { ...reminder, ...updates } : reminder));
    }
  }, []);

  const deleteReminder = useCallback(async (reminderId: string) => {
    const r = reminders.find(x => x.id === reminderId);
    try {
      await RemindersAPI.delete(reminderId);
      setReminders(prev => prev.filter(reminder => reminder.id !== reminderId));
      toast.success('Reminder deleted', r?.title);
    } catch (err) {
      console.error('Error deleting reminder:', err);
      setError('Failed to delete reminder');
      toast.error('Could not delete reminder');

      setReminders(prev => prev.filter(reminder => reminder.id !== reminderId));
    }
  }, [reminders, toast]);

  const toggleReminderCompletion = useCallback(async (reminderId: string) => {
    const reminder = reminders.find(r => r.id === reminderId);
    if (!reminder) return;
    
    try {
      const updatedReminder = await RemindersAPI.update(reminderId, { completed: !reminder.completed });
      setReminders(prev => prev.map(r => r.id === reminderId ? updatedReminder : r));
    } catch (err) {
      console.error('Error toggling reminder completion:', err);
      setError('Failed to update reminder');
      
      // Update local state even if API fails
      setReminders(prev => prev.map(r => r.id === reminderId ? { ...r, completed: !r.completed } : r));
    }
  }, [reminders]);

  // Timer functions
  const startTimer = useCallback((taskId: string, initialTime: number = 0) => {
    setActiveTaskId(taskId);
    setCurrentTimer(initialTime);
    setIsPaused(false);
    
    // Clear any existing intervals
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
    }
    
    const startTime = Date.now() - (initialTime * 1000);
    const timerId = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      setCurrentTimer(elapsedSeconds);
    }, 1000);
    
    timerIntervalRef.current = timerId;
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsPaused(true);

    // Start break timer
    if (breakIntervalRef.current !== null) {
      window.clearInterval(breakIntervalRef.current);
    }
    
    const breakTimerId = window.setInterval(() => {
      setBreakTime(prev => prev + 1);
    }, 1000);
    
    breakIntervalRef.current = breakTimerId;
  }, []);

  const resumeTimer = useCallback(() => {
    if (!activeTaskId) return;

    // Stop break timer
    if (breakIntervalRef.current !== null) {
      window.clearInterval(breakIntervalRef.current);
      breakIntervalRef.current = null;
    }

    startTimer(activeTaskId, currentTimer);
  }, [activeTaskId, currentTimer, startTimer]);

  const stopTimer = useCallback(async (taskId: string) => {
    // Clear all intervals
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (breakIntervalRef.current !== null) {
      window.clearInterval(breakIntervalRef.current);
      breakIntervalRef.current = null;
    }
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const timerSession: TimerSession = {
      id: uuidv4(),
      startTime: new Date(Date.now() - currentTimer * 1000),
      endTime: new Date(),
      duration: currentTimer,
      breakTime: breakTime
    };
    
    const updatedTimers = [...task.timers, timerSession];
    const updatedTimeSpent = task.timeSpent + currentTimer;
    
    try {
      await updateTask(taskId, {
        timers: updatedTimers,
        timeSpent: updatedTimeSpent
      });
    } catch (err) {
      console.error('Error saving timer session:', err);
    }
    
    setActiveTaskId(null);
    setCurrentTimer(0);
    setIsPaused(false);
    setBreakTime(0);
    localStorage.removeItem('timerState');
  }, [currentTimer, tasks, updateTask, breakTime]);

  // Convert a reminder to a task
  const convertReminderToTask = useCallback(async (reminderId: string) => {
    const reminder = reminders.find(r => r.id === reminderId);
    if (!reminder) return;
    
    try {
      // Create a new task based on the reminder
      const newTask = {
        title: reminder.title,
        description: reminder.description,
        priority: 'medium' as const,
        completed: false,
        // Use current date for the due date instead of reminder date
        dueDate: new Date(), 
        convertedFromReminder: reminder.id
      };
      
      // Add the task
      const createdTask = await TasksAPI.create(newTask);
      setTasks(prev => [...prev, createdTask]);
      
      // For recurring reminders, store the conversion date instead of a boolean
      const today = new Date(currentDate);
      today.setHours(0, 0, 0, 0);
      
      const updates: Partial<Reminder> = reminder.recurring
        ? {
            convertedToTaskDates: [...(reminder.convertedToTaskDates || []), today.toISOString()]
          }
        : { convertedToTask: true };
      
      // Update the reminder to mark it as converted
      const updatedReminder = await RemindersAPI.update(reminderId, updates);
      
      setReminders(prev => prev.map(r => 
        r.id === reminderId ? updatedReminder : r
      ));
      toast.success('Task created from reminder', reminder.title);

    } catch (err) {
      console.error('Error converting reminder to task:', err);
      setError('Failed to convert reminder to task');
      toast.error('Could not convert reminder');
      
      // Fallback to local state if API fails
      const newTask: Task = {
        id: uuidv4(),
        title: reminder.title,
        description: reminder.description,
        priority: 'medium',
        completed: false,
        createdAt: new Date(),
        // Use current date for the due date instead of reminder date
        dueDate: new Date(),
        timeSpent: 0,
        timers: [],
        convertedFromReminder: reminder.id
      };
      
      const today = new Date(currentDate);
      today.setHours(0, 0, 0, 0);
      
      setTasks(prev => [...prev, newTask]);
      setReminders(prev => prev.map(r => 
        r.id === reminderId 
          ? { 
              ...r, 
              ...(r.recurring 
                ? { convertedToTaskDates: [...(r.convertedToTaskDates || []), today.toISOString()] }
                : { convertedToTask: true }
              )
            } 
          : r
      ));
    }
  }, [reminders, currentDate, toast]);

  // Helper function to check if a reminder can be converted to task
  const canConvertReminderToTask = useCallback((reminder: Reminder): boolean => {
    // Get today's date with time set to midnight
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);
    
    // For non-recurring reminders, also check if the date is today
    if (!reminder.recurring) {
      const reminderDate = new Date(reminder.date);
      reminderDate.setHours(0, 0, 0, 0);
      
      // If the reminder is not for today, we can't convert it
      if (reminderDate.getTime() !== today.getTime()) {
        return false;
      }
      
      // If it's already been converted, we can't convert it again
      if (reminder.convertedToTask) {
        return false;
      }
    }
    
    // Find any task that was created from this reminder today
    const hasTaskForToday = tasks.some(task => {
      // Check if the task was created from this reminder
      if (task.convertedFromReminder !== reminder.id) {
        return false;
      }
      
      // Check if the task was created today
      const taskDate = new Date(task.createdAt);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() === today.getTime();
    });
    
    // Can convert if there's no task for today
    return !hasTaskForToday;
  }, [currentDate, tasks]);

  // Journal functions
  const addJournal = useCallback(async (journal: Omit<Journal, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newJournal = await JournalsAPI.create(journal);
      setJournals(prev => [...prev, newJournal]);
    } catch (err) {
      console.error('Error adding journal:', err);
      setError('Failed to add journal');
      
      // Add to local state even if API fails
      const localJournal: Journal = {
        ...journal,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setJournals(prev => [...prev, localJournal]);
    }
  }, []);

  const updateJournal = useCallback(async (journalId: string, updates: Partial<Journal>) => {
    try {
      // Find the current journal
      const currentJournal = journals.find(j => j.id === journalId);
      if (!currentJournal) return;
      
      // Check if there are actual changes to save
      let hasChanges = false;
      
      for (const key in updates) {
        if (key === 'updatedAt') continue; // Ignore updatedAt changes
        
        const typedKey = key as keyof Journal;
        if (typedKey === 'tags') {
          // Special handling for arrays
          const currentTags = currentJournal.tags || [];
          const newTags = updates.tags || [];
          
          if (JSON.stringify(currentTags) !== JSON.stringify(newTags)) {
            hasChanges = true;
            break;
          }
        } else if (updates[typedKey] !== currentJournal[typedKey]) {
          hasChanges = true;
          break;
        }
      }
      
      if (!hasChanges) {
        // No actual changes, skip API call
        return;
      }
      
      const updatedJournal = await JournalsAPI.update(journalId, updates);
      setJournals(prev => prev.map(journal => journal.id === journalId ? updatedJournal : journal));
    } catch (err) {
      console.error('Error updating journal:', err);
      setError('Failed to update journal');
      
      // Update local state even if API fails
      setJournals(prev => prev.map(journal => journal.id === journalId ? { 
        ...journal, 
        ...updates, 
        updatedAt: new Date() 
      } : journal));
    }
  }, [journals]);

  const deleteJournal = useCallback(async (journalId: string) => {
    try {
      await JournalsAPI.delete(journalId);
      setJournals(prev => prev.filter(journal => journal.id !== journalId));
    } catch (err) {
      console.error('Error deleting journal:', err);
      setError('Failed to delete journal');
      
      // Delete from local state even if API fails
      setJournals(prev => prev.filter(journal => journal.id !== journalId));
    }
  }, []);

  const searchJournals = useCallback(async (query: string): Promise<Journal[]> => {
    try {
      return await JournalsAPI.search(query);
    } catch (err) {
      console.error('Error searching journals:', err);
      setError('Failed to search journals');
      
      // Local search fallback
      return journals.filter(journal => 
        journal.title.toLowerCase().includes(query.toLowerCase()) || 
        journal.content.toLowerCase().includes(query.toLowerCase()) ||
        (journal.tags && journal.tags.some(tag => 
          tag.toLowerCase().includes(query.toLowerCase())))
      );
    }
  }, [journals]);

  return (
    <AppContext.Provider
      value={{
        tasks,
        addTask,
        updateTask,
        deleteTask,
        toggleTaskCompletion,
        reorderTasks,
        
        meetings,
        addMeeting,
        updateMeeting,
        deleteMeeting,
        toggleMeetingCompletion,
        
        reminders,
        addReminder,
        updateReminder,
        deleteReminder,
        toggleReminderCompletion,
        convertReminderToTask,
        
        journals,
        addJournal,
        updateJournal,
        deleteJournal,
        searchJournals,
        
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        activeTaskId,
        currentTimer,
        
        currentDate,
        setCurrentDate,
        
        isLoading,
        isAddingTask,
        isDeletingTask,
        isUpdatingTask,
        isTogglingTask,
        error,
        
        canConvertReminderToTask,
        isPaused,
        breakTime,
        
        isJournalPinVerified,
        setJournalPinVerified,

        refreshTasks,
        refreshMeetings,
        refreshReminders,
        refreshJournals,

        contacts,
        addContact,
        updateContact,
        deleteContact,
        refreshContacts,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the app context
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}; 