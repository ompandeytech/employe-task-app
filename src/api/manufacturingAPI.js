// frontend/src/api/manufacturingAPI.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://techiohisab.com/api';

const manufacturingAPI = {
  // Get all manufacturing orders
  async getManufacturingOrders() {
    try {
      const response = await fetch(`${API_BASE_URL}/manufacturing/orders`);
      if (!response.ok) throw new Error('Failed to fetch manufacturing orders');
      return await response.json();
    } catch (error) {
      console.error('Error fetching manufacturing orders:', error);
      throw error;
    }
  },

  // Accept manufacturing order
  async acceptOrder(orderId) {
    try {
      const response = await fetch(`${API_BASE_URL}/manufacturing/accept/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to accept manufacturing order');
      return await response.json();
    } catch (error) {
      console.error('Error accepting manufacturing order:', error);
      throw error;
    }
  }
};

export default manufacturingAPI;
