import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { httpsCallable } from 'firebase/functions';
import { functions, isFirebaseConfigured, auth } from './firebaseConfig';
import { TeamMember, Project } from '../types';

let Notifications: any = null;

// Remote push notifications were removed from Expo Go starting in SDK 53.
// We conditionally require expo-notifications only when running in a standalone or development build.
if (!isRunningInExpoGo()) {
  try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority?.HIGH ?? 4,
      }),
    });
  } catch (e) {
    console.warn('[Notifications] Native push module init warning:', e);
  }
} else {
  console.log('ℹ️ [Notifications] Running in Expo Go. Push tokens are simulated. In-app notifications are fully active.');
}

/**
 * Register for Push Notifications and retrieve Expo Push Token
 */
export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  if (isRunningInExpoGo() || !Notifications) {
    // In Expo Go, push notifications require a custom dev build.
    return null;
  }

  try {
    let token: string | null = null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#38bdf8',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return null;
    }

    const pushTokenData = await Notifications.getExpoPushTokenAsync();
    token = pushTokenData.data;
    console.log('[Notifications] Expo Push Token registered:', token);
    return token;
  } catch (e) {
    console.log('[Notifications] Failed to get push token:', e);
    return null;
  }
};

/**
 * Dispatch responsibility assigned notification via Cloud Functions
 */
export const notifyResponsibilityAssigned = async (
  assignees: TeamMember[],
  project: Project,
  itemType: 'phase' | 'task',
  itemName: string
): Promise<boolean> => {
  if (!isFirebaseConfigured() || !auth?.currentUser) {
    console.log(`[NotificationService] Mock notification for ${itemType}: ${itemName}`);
    return true;
  }

  try {
    const callable = httpsCallable(functions, 'notifyResponsibilityAssigned');
    await callable({
      projectId: project.id,
      projectName: project.name,
      itemType,
      itemName,
      assignees: assignees.map((a) => ({
        uid: a.uid,
        email: a.email,
        displayName: a.displayName,
      })),
    });
    return true;
  } catch (error) {
    console.error('[NotificationService] Cloud function notification error:', error);
    return false;
  }
};
