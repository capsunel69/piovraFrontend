import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import { useAppContext } from '../context/AppContext';
import { ContactsAPI } from '../services/api';
import type { Contact, GmailCorrespondentSuggestion } from '../types';
import {
  PageContainer, PageHeader, PageTitle, PageSubtitle,
  Card, CardHeader, CardTitle, CardSection,
  Button, IconButton, EmptyState, Input, Textarea, Label, Field,
} from '../components/ui/primitives';
import { IconPlus, IconTrash, IconEdit, IconRefresh } from '../components/ui/icons';

const PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--s-4);
  width: 100%;
`;

const Subtitle = styled(PageSubtitle)`
  max-width: 58ch;
  line-height: 1.55;
`;

const Row = styled.div`
  padding: var(--s-5) var(--s-6);
  display: flex;
  gap: var(--s-4);
  align-items: flex-start;
  border-top: 1px solid var(--border-1);
  &:first-child { border-top: none; }
  &:hover { background: var(--bg-3); }

  @media (max-width: 720px) {
    padding: var(--s-4) var(--s-4);
  }
`;

const Body = styled.div` flex: 1; min-width: 0; `;

const Title = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
`;

const Meta = styled.div`
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
  word-break: break-all;
`;

const Desc = styled.p`
  font-size: 13px;
  color: var(--text-2);
  margin: 8px 0 0 0;
  white-space: pre-wrap;
  line-height: 1.5;
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
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
`;

const SuggestionPanel = styled.div`
  margin-top: var(--s-5);
  padding: var(--s-4);
  border-radius: var(--r-md);
  background: var(--bg-1);
  border: 1px solid var(--border-1);
  max-height: 240px;
  overflow-y: auto;
`;

const SuggestionBtn = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border: none;
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--text-1);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
  &:hover { background: var(--bg-3); }
  .em { color: var(--text-2); font-size: 12px; }
`;

const ListBody = styled.div<{ $empty?: boolean }>`
  padding: 0;
  min-height: ${(p) => (p.$empty ? 'min(40vh, 200px)' : 'auto')};
`;

const Contacts: React.FC = () => {
  const { contacts, addContact, updateContact, deleteContact } = useAppContext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GmailCorrespondentSuggestion[]>([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

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
    try {
      const q = name.trim() || email.trim();
      const rows = await ContactsAPI.gmailSuggestions(q || undefined);
      setSuggestions(rows);
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
        <PageHeader>
          <div>
            <PageTitle>Contacts</PageTitle>
            <Subtitle>
              Names and emails the assistant uses when you say things like &ldquo;email Vlad&rdquo;. Suggestions
              come from recent Gmail threads (same Google connection as mail skills).
            </Subtitle>
          </div>
        </PageHeader>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit contact' : 'Add contact'}</CardTitle>
          </CardHeader>
          <CardSection>
            <form onSubmit={(e) => void onSubmit(e)}>
              <FormFields>
                <TwoCol>
                  <Field>
                    <Label htmlFor="contact-name">Display name</Label>
                    <Input
                      id="contact-name"
                      placeholder="e.g. Vlad"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                    />
                  </Field>
                  <Field>
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      placeholder="name@company.com"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                </TwoCol>
                <Field>
                  <Label htmlFor="contact-desc">Description (optional)</Label>
                  <Textarea
                    id="contact-desc"
                    placeholder="How you know them, role, notes for the assistant…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </Field>
              </FormFields>
              <ActionsRow>
                <Button type="submit" $variant="primary">
                  {editingId ? 'Save changes' : <><IconPlus size={16} /> Add contact</>}
                </Button>
                {editingId && (
                  <Button type="button" $variant="ghost" onClick={resetForm}>
                    Cancel edit
                  </Button>
                )}
                <Button
                  type="button"
                  $variant="secondary"
                  disabled={loadingSuggest}
                  onClick={() => void loadGmailSuggestions()}
                >
                  <IconRefresh size={16} />
                  {loadingSuggest ? 'Loading…' : 'Suggest from Gmail'}
                </Button>
              </ActionsRow>
            </form>
            {suggestions.length > 0 && (
              <SuggestionPanel>
                {suggestions.map((s) => (
                  <SuggestionBtn
                    key={s.email}
                    type="button"
                    onClick={() => pickSuggestion(s)}
                  >
                    <strong>{s.name || s.email}</strong>
                    {s.name && <span className="em"> · {s.email}</span>}
                  </SuggestionBtn>
                ))}
              </SuggestionPanel>
            )}
          </CardSection>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your contacts ({contacts.length})</CardTitle>
          </CardHeader>
          <ListBody $empty={contacts.length === 0}>
            {contacts.length === 0 ? (
              <EmptyState>No contacts yet — add one above or pull suggestions from Gmail.</EmptyState>
            ) : (
              contacts.map((c) => (
                <Row key={c.id}>
                  <Body>
                    <Title>{c.displayName}</Title>
                    <Meta>{c.email}</Meta>
                    {c.description?.trim() ? <Desc>{c.description}</Desc> : null}
                  </Body>
                  <Actions>
                    <IconButton
                      type="button"
                      $variant="ghost"
                      title="Edit"
                      onClick={() => startEdit(c)}
                    >
                      <IconEdit />
                    </IconButton>
                    <IconButton
                      type="button"
                      $variant="ghost"
                      title="Delete"
                      onClick={() => {
                        if (window.confirm(`Remove ${c.displayName}?`)) void deleteContact(c.id);
                      }}
                    >
                      <IconTrash />
                    </IconButton>
                  </Actions>
                </Row>
              ))
            )}
          </ListBody>
        </Card>
      </PageStack>
    </PageContainer>
  );
};

export default Contacts;
