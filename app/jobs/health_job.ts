// app/jobs/health_job.ts
// INFRA-08: Minimal job class used to verify queue dispatch in tests.
// The static `executed` flag is reset before each test and checked after dispatch.
// ~20 lines — intentionally trivial. Not used in production flows.
import { Job } from '@adonisjs/queue'

export default class HealthJob extends Job<Record<string, never>> {
  // Static flag: set to true when execute() is called.
  // Tests reset this to false before dispatch and assert it is true after.
  static executed = false

  async execute(): Promise<void> {
    HealthJob.executed = true
  }
}
