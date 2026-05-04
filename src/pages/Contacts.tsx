import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import { useAppContext } from '../context/AppContext';
import { ContactsAPI } from '../services/api';
import type { Contact, GmailCorrespondentSuggestion } from '../types';
import {
  PageContainer, PageHeader, PageTitle, PageSubtitle,
  Card, CardHeader, CardTitle, CardBody,
  Button, IconButton, EmptyState, GhostInput,
} from '../components/ui/primitives';
import { IconPlus, IconTrash, IconEdit, IconRefresh } from '../components/ui/icons';

const Row = styled.div`
  padding: var(--s-4) var(--s-5);
  display: flex;
  gap: var(--s-3);
  align-items: flex-start;
  border-top: 1px solid var(--border-1);
  &:first-child { border-top: none; }
  &:hover { background: var(--bg-3); }
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

const FormGrid = styled.div`
  display: grid;
  gap: var(--s-3);
  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const SuggestionPanel = styled.div`
  margin-top: var(--s-4);
  padding: var(--s-3);
  border-radius: var(--r-sm);
  background: var(--bg-2);
  border: 1px solid var(--border-1);
  max-height: 220px;
  overflow-y: auto;
`;

const SuggestionBtn = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-1);
  font-size: 13px;
  cursor: pointer;
  &:hover { background: var(--bg-3); }
  .em { color: var(--text-2); font-size: 12px; }
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
      <PageHeader>
        <PageTitle>Contacts</PageTitle>
        <PageSubtitle>
          Names and emails the assistant uses when you say things like &ldquo;email Vlad&rdquo;. Suggestions
          come from recent Gmail threads (same Google connection as mail skills).
        </PageSubtitle>
      </PageHeader>

      <Card style={{ marginBottom: 'var(--s-5)' }}>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit contact' : 'Add contact'}</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={(e) => void onSubmit(e)}>
            <FormGrid>
              <GhostInput
                placeholder="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <GhostInput
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </FormGrid>
            <GhostInput
              style={{ marginTop: 'var(--s-3)' }}
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div style={{ marginTop: 'var(--s-4)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <Button type="submit" $variant="primary">
                {editingId ? 'Save changes' : <><IconPlus size={16} /> Add</>}
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
                <IconRefresh size={16} style={{ marginRight: 6 }} />
                {loadingSuggest ? 'Loading…' : 'Suggest from Gmail'}
              </Button>
            </div>
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your contacts ({contacts.length})</CardTitle>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
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
        </CardBody>
      </Card>
    </PageContainer>
  );
};

export default Contacts;
