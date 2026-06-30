export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReminderCron } = await import('./lib/cron/reminders');
    startReminderCron();

    const { startRetentionCron } = await import('./lib/cron/retention');
    startRetentionCron();
  }
}
