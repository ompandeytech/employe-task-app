import { PushNotifications } from "@capacitor/push-notifications";

let registrationListener = null;
let tokenRefreshListener = null;
let notificationListener = null;
let actionListener = null;

export async function initPushNotifications() {
  try {
    let permission = await PushNotifications.checkPermissions();

    if (permission.receive === "prompt") {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== "granted") {
      console.warn("Push notification permission not granted");
      return null;
    }

    await PushNotifications.register();

    const registration = await new Promise((resolve) => {
      let settled = false;

      const finish = async (value) => {
        if (settled) return;
        settled = true;
        if (registrationListener) {
          await registrationListener.remove();
          registrationListener = null;
        }
        resolve(value);
      };

      registrationListener = PushNotifications.addListener(
        "registration",
        (token) => {
          console.log("FCM TOKEN:", token.value);
          finish(token);
        }
      );

      setTimeout(() => {
        finish(null);
      }, 10000);
    });

    return registration?.value || null;
  } catch (error) {
    console.error("Push notification initialization failed:", error);
    return null;
  }
}

export async function setupPushNotificationListeners(onNotificationReceived, onNotificationActionPerformed) {
  try {
    // Listen for incoming notifications when app is in foreground
    notificationListener = await PushNotifications.addListener(
      "pushNotificationReceived",
      (notification) => {
        console.log("Push notification received in foreground:", notification);
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      }
    );

    // Listen for notification action/click events
    actionListener = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action) => {
        console.log("Push notification action performed:", action);
        if (onNotificationActionPerformed) {
          onNotificationActionPerformed(action);
        }
      }
    );

    // Listen for token refresh
    tokenRefreshListener = await PushNotifications.addListener(
      "registrationError",
      (error) => {
        console.error("Push notification registration error:", error);
      }
    );

    console.log("Push notification listeners setup complete");
  } catch (error) {
    console.error("Failed to setup push notification listeners:", error);
  }
}

export async function removePushNotificationListeners() {
  try {
    if (registrationListener) {
      await registrationListener.remove();
      registrationListener = null;
    }
    if (tokenRefreshListener) {
      await tokenRefreshListener.remove();
      tokenRefreshListener = null;
    }
    if (notificationListener) {
      await notificationListener.remove();
      notificationListener = null;
    }
    if (actionListener) {
      await actionListener.remove();
      actionListener = null;
    }
    console.log("Push notification listeners removed");
  } catch (error) {
    console.error("Failed to remove push notification listeners:", error);
  }
}