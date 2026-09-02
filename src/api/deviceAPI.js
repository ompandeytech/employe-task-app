import client from "./client";

export const registerDeviceToken = async (userId, token, platform = 'android') => {
  try {
    const response = await client.post('/devices/register', {
      fcm_token: token,
      device_info: {
        platform: platform
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to register device token:', error);
    throw error;
  }
};

export const updateDeviceToken = async (userId, oldToken, newToken, platform = 'android') => {
  try {
    const response = await client.put('/devices/update', {
      userId,
      oldToken,
      newToken,
      platform
    });
    return response.data;
  } catch (error) {
    console.error('Failed to update device token:', error);
    throw error;
  }
};

export const removeDeviceToken = async (userId, token) => {
  try {
    const response = await client.delete('/devices/remove', {
      data: { userId, token }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to remove device token:', error);
    throw error;
  }
};