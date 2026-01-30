import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    'https://cbac493acbfb8447d6c75b64a7537aa7@o4510517820653568.ingest.us.sentry.io/4510517821964288',

  integrations: [Sentry.expressIntegration(), Sentry.httpIntegration(), nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
});

export default Sentry;
