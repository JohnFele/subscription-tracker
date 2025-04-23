import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { serve } = require('@upstash/workflow/express');
import Subscription from '../models/subscription.model.js';
import dayjs from 'dayjs';
import { sendEmailReminder } from '../utils/send.email.js';

const reminders = {
  1: '1d',
  3: '3d',
  7: '7d',
  14: '14d',
  30: '30d',
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

  for (const [key, value] of Object.entries(reminders)) {
    const reminderDate = renewalDate.subtract(parseInt(value), 'day');
    if (reminderDate.isAfter(dayjs())) {
      await sleepUntilReminder(context, `${key} reminder`, reminderDate);
    };

    if (reminderDate.isSame(dayjs(), 'day')) {
      await sendReminder(context, `${key} days before reminder`, subscription);
    }
    
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

const sendReminder = async (context, label, subscription) => {
  return context.run(label, async () => {
    console.log(`Sending ${label} reminder`);
    await sendEmailReminder({ to: subscription.user.email, type: label, subscription });
  });
};