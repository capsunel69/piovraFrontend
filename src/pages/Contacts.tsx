import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { ContactsAPI } from '../services/api';
import type { Contact, GmailCorrespondentSuggestion } from '../types';
import {
  PageContainer,
  PageHeader,
  PageTitle,
  Card,
  CardHeader,
  CardTitle,
  CardSubtle,
  CardSection,
  Button,
  IconButton,
  EmptyState,
  Input,
  Textarea,
  Label,
  Field,
} from '../components/ui/primitives';
import { IconPlus, IconTrash, IconEdit, IconRefresh } from '../components/ui/icons';
import ConnectGmailBanner from '../components/agents/ConnectGmailBanner';

function contactHue(name: string): number {
  const s = name.trim();
  if (!s) return 200;
  return (s.charCodeAt(0) * 47 + (s.charCodeAt(s.length - 1) ?? 0) * 13) % 360;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0] ?? ''}${p[p.length - 1]![0] ?? ''}`.toUpperCase();
}

const PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-5);
  width: 100%;

  @media (max-width: 720px) {
    gap: var(--s-4);
  }
`;

const HeroIntro = styled.div`
  max-width: 56ch;

  p {
    margin: var(--s-2) 0 0 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-3);
  }

  @media (max-width: 720px) {
    max-width: none;

    p {
      font-size: 14px;
    }
  }
`;

const ContactsPageHeader = styled(PageHeader)`
  @media (max-width: 720px) {
    align-items: flex-start;
  }
`;

const FormCard = styled(Card)`
  border-color: var(--border-1);
  box-shadow: 0 4px 28px rgba(0, 0, 0, 0.08);
  background: linear-gradient(180deg, rgba(76, 194, 255, 0.04), var(--bg-2));
`;

const ListCard = styled(Card)`
  overflow: hidden;
`;

const ContactGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
  padding: var(--s-4) var(--s-5) var(--s-5);

  @media (max-width: 720px) {
    padding: var(--s-3);
  }
`;

const ContactTile = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--s-4);
  padding: var(--s-4) var(--s-5);
  border-radius: var(--r-md);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.12s;

  &:hover {
    border-color: var(--border-2);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
  }

  @media (max-width: 720px) {
    padding: var(--s-4);
    flex-wrap: wrap;
  }
`;

const Avatar = styled.div<{ $hue: number }>`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #06121d;
  background: linear-gradient(
    135deg,
    hsl(${(p) => p.$hue}, 72%, 58%),
    hsl(${(p) => p.$hue + 38}, 62%, 48%)
  );
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
`;

const TileBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const TileName = styled.h3`
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
  letter-spacing: -0.01em;
`;

const TileEmail = styled.div`
  font-size: 13px;
  color: var(--text-2);
  margin-top: 4px;
  font-family: var(--font-mono);
  word-break: break-all;
  opacity: 0.95;
`;

const TileNote = styled.p`
  font-size: 13px;
  color: var(--text-3);
  margin: 10px 0 0 0;
  line-height: 1.55;
  white-space: pre-wrap;
`;

const TileActions = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;

  @media (max-width: 720px) {
    width: 100%;
    justify-content: flex-end;
    margin-top: var(--s-2);
  }
`;

const TwoCol = styled.div`
  display: grid;
  gap: var(--s-4);
  @media (min-width: 640px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const FormFields = styled.div`
  display: grid;
  gap: var(--s-4);
`;

const ActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3);
  margin-top: var(--s-5);
  padding-top: var(--s-5);
  border-top: 1px solid var(--border-1);

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: stretch;
    gap: var(--s-2);
    margin-top: var(--s-4);
    padding-top: var(--s-4);

    & > * {
      width: 100%;
      justify-content: center;
    }
  }
`;

const SuggestionPanel = styled.div`
  margin-top: var(--s-5);
  padding: var(--s-4);
  border-radius: var(--r-md);
  background: linear-gradient(180deg, rgba(76, 194, 255, 0.06), var(--bg-1));
  border: 1px solid var(--border-1);
  max-height: min(260px, 42vh);
  overflow-y: auto;
`;

const SuggestionHint = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.04em;
  margin-bottom: var(--s-2);
  text-transform: uppercase;
`;

const SuggestionBtn = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  background: var(--bg-2);
  color: var(--text-1);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 6px;
  transition: border-color 0.12s, background 0.12s;
  &:hover {
    background: var(--bg-3);
    border-color: var(--border-1);
  }
  .em {
    color: var(--text-3);
    font-size: 12px;
    font-family: var(--font-mono);
    display: block;
    margin-top: 2px;
  }
`;

const EmptyWrap = styled.div`
  padding: var(--s-7) var(--s-5);
  text-align: center;
  background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(76, 194, 255, 0.08), transparent);
`;

const Contacts: React.FC = () => {
  const { contacts, addContact, updateContact, deleteContact } = useAppContext();
  const { googleGmailUpgradeUrl } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GmailCorrespondentSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [gmailNeedsConnect, setGmailNeedsConnect] = useState(false);

  const resetForm = (): void => {
    setName('');
    setEmail('');
    setDescription('');
    setEditingId(null);
    setSuggestions([]);
  };

  const loadGmailSuggestions = useCallback(async (): Promise<void> => {
    setLoadingSuggest(true);
    setSuggestions([]);
    setGmailNeedsConnect(false);
    try {
      const q = name.trim() || email.trim();
      const { suggestions: rows, needsGmailConnect } = await ContactsAPI.gmailSuggestions(q || undefined);
      setSuggestions(rows);
      setGmailNeedsConnect(needsGmailConnect);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggest(false);
    }
  }, [name, email]);

  const pickSuggestion = (s: GmailCorrespondentSuggestion): void => {
    setEmail(s.email);
    if (s.name && !name.trim()) setName(s.name);
    setSuggestions([]);
  };

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const dn = name.trim();
    const em = email.trim();
    if (!dn || !em) return;
    if (editingId) {
      await updateContact(editingId, {
        displayName: dn,
        email: em,
        description: description.trim(),
      });
    } else {
      await addContact({ displayName: dn, email: em, description: description.trim() });
    }
    resetForm();
  };

  const startEdit = (c: Contact): void => {
    setEditingId(c.id);
    setName(c.displayName);
    setEmail(c.email);
    setDescription(c.description ?? '');
    setSuggestions([]);
  };

  return (
    <PageContainer>
      <PageStack>
        <ContactsPageHeader>
          <HeroIntro>
            <PageTitle>Contacts</PageTitle>
            <p>
              Save people you email often. The assistant can match a first name to these entries when you ask it to send
              mail. You can also pull names from your recent Gmail threads.
            </p>
          </HeroIntro>
        </ContactsPageHeader>

        <ConnectGmailBanner />

        <FormCard>
          <CardHeader>
            <div>
              <CardTitle>{editingId ? 'Edit contact' : 'Add someone'}</CardTitle>
              <CardSubtle style={{ marginTop: 6 }}>
                {editingId
                  ? 'Update their details below, then save.'
                  : 'Name and email are required. Notes are optional — they help the assistant understand who this is.'}
              </CardSubtle>
            </div>
          </CardHeader>
          <CardSection>
            <form onSubmit={(e) => void onSubmit(e)}>
              <FormFields>
                <TwoCol>
                  <Field>
                    <Label htmlFor="contact-name">Name</Label>
                    <Input
                      id="contact-name"
                      placeholder="Their name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      placeholder="name@example.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                </TwoCol>
                <Field>
                  <Label htmlFor="contact-desc">Note (optional)</Label>
                  <Textarea
                    id="contact-desc"
                    placeholder="e.g. colleague, client, how you usually say hi…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </Field>
              </FormFields>
              <ActionsRow>
                <Button type="submit" $variant="primary">
                  {editingId ? 'Save changes' : (
                    <>
                      <IconPlus size={16} /> Save contact
                    </>
                  )}
                </Button>
                {editingId && (
                  <Button type="button" $variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
                <Button
                  type="button"
                  $variant="secondary"
                  disabled={loadingSuggest}
                  onClick={() => void loadGmailSuggestions()}
                >
                  <IconRefresh size={16} />
                  {loadingSuggest ? 'Loading…' : 'Suggestions from Gmail'}
                </Button>
              </ActionsRow>
            </form>
            {gmailNeedsConnect && (
              <SuggestionPanel>
                <SuggestionHint>
                  Gmail access is required for thread suggestions.{' '}
                  <a href={googleGmailUpgradeUrl}>Connect Gmail</a>
                </SuggestionHint>
              </SuggestionPanel>
            )}
            {suggestions.length > 0 && (
              <SuggestionPanel>
                <SuggestionHint>Tap a suggestion to fill the form</SuggestionHint>
                {suggestions.map((s) => (
                  <SuggestionBtn key={s.email} type="button" onClick={() => pickSuggestion(s)}>
                    <strong>{s.name || s.email}</strong>
                    {s.name ? <span className="em">{s.email}</span> : null}
                  </SuggestionBtn>
                ))}
              </SuggestionPanel>
            )}
          </CardSection>
        </FormCard>

        <ListCard>
          <CardHeader>
            <div>
              <CardTitle>People you’ve saved</CardTitle>
              <CardSubtle style={{ marginTop: 6 }}>
                {contacts.length === 0
                  ? 'No one here yet — add your first contact above.'
                  : `${contacts.length} contact${contacts.length === 1 ? '' : 's'}`}
              </CardSubtle>
            </div>
          </CardHeader>
          {contacts.length === 0 ? (
            <EmptyWrap>
              <EmptyState style={{ background: 'transparent', maxWidth: 360, margin: '0 auto' }}>
                Your contact list is empty. Add someone manually or use Gmail suggestions.
              </EmptyState>
            </EmptyWrap>
          ) : (
            <ContactGrid>
              {contacts.map((c) => (
                <ContactTile key={c.id}>
                  <Avatar $hue={contactHue(c.displayName)} aria-hidden>
                    {initials(c.displayName)}
                  </Avatar>
                  <TileBody>
                    <TileName>{c.displayName}</TileName>
                    <TileEmail>{c.email}</TileEmail>
                    {c.description?.trim() ? <TileNote>{c.description}</TileNote> : null}
                  </TileBody>
                  <TileActions>
                    <IconButton type="button" $variant="ghost" title="Edit" onClick={() => startEdit(c)}>
                      <IconEdit />
                    </IconButton>
                    <IconButton
                      type="button"
                      $variant="ghost"
                      title="Remove"
                      onClick={() => {
                        if (window.confirm(`Remove ${c.displayName} from your contacts?`)) void deleteContact(c.id);
                      }}
                    >
                      <IconTrash />
                    </IconButton>
                  </TileActions>
                </ContactTile>
              ))}
            </ContactGrid>
          )}
        </ListCard>
      </PageStack>
    </PageContainer>
  );
};

export default Contacts;
