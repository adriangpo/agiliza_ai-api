// tests/jobs/health_job.spec.ts
// INFRA-08: Verifies a job can be dispatched and processed by the Sync adapter.
// The Sync adapter (NODE_ENV=test) executes jobs immediately in the same process.
// ROADMAP Phase 1 success criterion 4: "job can be dispatched and processed".
import { test } from '@japa/runner'
import { Locator } from '@adonisjs/queue'
import HealthJob from '#jobs/health_job'

test.group('HealthJob dispatch', (group) => {
  group.setup(() => {
    // Register HealthJob with the Locator so the Sync adapter can resolve it by name
    Locator.register('HealthJob', HealthJob)
  })

  test('Sync adapter executes job synchronously on dispatch', async ({ assert }) => {
    // Reset the static flag before dispatch
    HealthJob.executed = false
    assert.isFalse(HealthJob.executed, 'executed must be false before dispatch')

    // Dispatch via static method — Sync adapter runs it immediately
    await HealthJob.dispatch({})

    assert.isTrue(HealthJob.executed, 'executed must be true after Sync adapter processes the job')
  })
})
