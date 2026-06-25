import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { welcomeEmailSequence, surveyEmailSequence, surveyEmailSequenceTest } from '@/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [welcomeEmailSequence, surveyEmailSequence, surveyEmailSequenceTest],
})
