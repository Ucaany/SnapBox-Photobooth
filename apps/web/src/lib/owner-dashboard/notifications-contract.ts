import { z } from 'zod';

export const notificationIdSchema = z.string().uuid();
export const NOTIFICATION_RETENTION_DAYS = 30;
export const NOTIFICATION_PAGE_SIZE = 100;

export type OwnerNotification = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};
