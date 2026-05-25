import React from 'react';
import { PageContainer, PageHeader, PageTitle, Card, CardBody } from '../components/ui/primitives';

const Privacy: React.FC = () => (
  <PageContainer>
    <PageHeader>
      <PageTitle>Privacy Policy</PageTitle>
    </PageHeader>
    <Card>
      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)', lineHeight: 1.6 }}>
        <p>
          Piovra (&quot;we&quot;, &quot;the service&quot;) stores your workspace data (tasks, meetings,
          notes, agent runs, etc.) in our Postgres database on infrastructure we operate.
        </p>
        <p>
          When you sign in with Google, we receive your profile (name, email, picture). If you
          explicitly connect Gmail, we access mail on your behalf to power contact suggestions and
          agent mail features. We do not sell your data.
        </p>
        <p>
          Google refresh tokens are encrypted at rest. You can disconnect Google or delete your
          account from the app; we revoke Google tokens and delete your user record (cascade).
        </p>
        <p>
          Agent runs may send prompts to LLM providers (OpenAI, Google Gemini) according to your
          agent configuration. Those providers process data under their own terms.
        </p>
        <p>Contact: privacy@piovra-op.com</p>
      </CardBody>
    </Card>
  </PageContainer>
);

export default Privacy;
