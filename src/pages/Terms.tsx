import React from 'react';
import { PageContainer, PageHeader, PageTitle, Card, CardBody } from '../components/ui/primitives';

const Terms: React.FC = () => (
  <PageContainer>
    <PageHeader>
      <PageTitle>Terms of Service</PageTitle>
    </PageHeader>
    <Card>
      <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)', lineHeight: 1.6 }}>
        <p>
          Piovra is provided as-is during beta. You are responsible for content you create and
          actions agents take on your connected accounts.
        </p>
        <p>
          Do not use the service to violate applicable law or third-party terms (including Google
          and WhatsApp policies). We may suspend accounts that abuse the platform.
        </p>
        <p>
          Service availability and features may change. Paid plans, if introduced later, will
          be governed by separate billing terms.
        </p>
        <p>Contact: legal@piovra-op.com</p>
      </CardBody>
    </Card>
  </PageContainer>
);

export default Terms;
