import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { serve } = require('@upstash/workflow/express');
import Subscription from '../models/subscription.model.js';
import dayjs from 'dayjs';

const Reminders = {
  ONE_DAY: '1d',
  THREE_DAYS: '3d',
  SEVEN_DAYS: '7d',
  FOURTEEN_DAYS: '14d',
  THIRTY_DAYS: '30d',
};

export const sendReminders = serve( async (context) => {
  const { subscriptionId } = context.requestPayload;
  const subscription = await fetchSubscription(context, subscriptionId);

  if (!subscription || subscription.status !== 'active') return;

  const renewalDate = dayjs(subscription.renewalDate);

  if (renewalDate.isBefore(dayjs())) {
    console.log(`Subscription ${subscriptionId} is already expired. Skipping reminder.`);
    return;
  }

  for (const [key, value] of Object.entries(Reminders)) {
    const reminderDate = renewalDate.subtract(parseInt(value), 'day');
    if (reminderDate.isAfter(dayjs())) {
      await sleepUntilReminder(context, `${key} reminder`, reminderDate);
    };

    await sendReminder(context, `${key} reminder`);
    
    // if (reminderDate.isSame(dayjs(), 'day')) {
    //   console.log(`Sending ${key} reminder for subscription ${subscriptionId}`);
    //   // Here you would send the actual reminder (e.g., email, notification)
    // }
  }
});

const fetchSubscription = async (context, subscriptionId) => {
  return await context.run('get subscription', async () => {
    return Subscription.findById(subscriptionId).populate('user', 'name email');
  })
};

const sleepUntilReminder = async (context, label, reminderDate) => {
  console.log(`Sleeping until ${label} reminder date: ${reminderDate}`);
  await context.sleepUntil(label, reminderDate.toDate());
}

const sendReminder = async (context, label) => {
  return context.run(label, () => {
    console.log(`Sending ${label} reminder`);
    // Here you would send the actual reminder (e.g., email, notification)
  });
};