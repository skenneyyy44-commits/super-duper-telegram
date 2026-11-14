const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_DAYS = 7;

// due-soon window = within 1 day of the due date; anything past due is overdue
export const getWateringStatus = (plant, now = new Date()) => {
  const intervalDays = plant?.wateringIntervalDays || DEFAULT_INTERVAL_DAYS;
  const lastWatered =
    plant?.lastWateredAt?.toDate?.() || plant?.createdAt?.toDate?.() || now;
  const nextDueDate = new Date(lastWatered.getTime() + intervalDays * DAY_MS);
  const daysUntilDue = (nextDueDate.getTime() - now.getTime()) / DAY_MS;

  let state = 'ok';
  if (daysUntilDue < 0) {
    state = 'overdue';
  } else if (daysUntilDue < 1) {
    state = 'due-soon';
  }

  return { state, daysUntilDue, nextDueDate };
};

export const formatWateringDueLabel = (status) => {
  const days = Math.ceil(Math.abs(status.daysUntilDue));

  if (status.state === 'overdue') {
    return days <= 1 ? 'Overdue by 1 day' : `Overdue by ${days} days`;
  }
  if (status.state === 'due-soon') {
    return 'Due today';
  }
  return days <= 1 ? 'Due in 1 day' : `Due in ${days} days`;
};
