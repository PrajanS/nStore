/*For Mock API testing*/
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Function to read JSON file
const readJsonFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });
  });
};

// Function to write JSON file
const writeJsonFile = (filePath, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const ordersFilePath = path.join(__dirname, '../src/info/orders.json');
const dataFilePath = path.join(__dirname, '../src/info/data.json'); // Path to data.json
const trackFilePath = path.join(__dirname, '../src/info/track.json'); // Path to track.json

// Variable to store extracted data
let extractedData = null;

// Variable to store delivery partners from data.json
let dataJsonDeliveryPartners = [];

// Array to store order IDs from orders.json
let orderIDs = [];

// Function to extract data from orders.json and update orderIDs
const extractData = async () => {
  try {
    const jsonData = await readJsonFile(ordersFilePath);
    orderIDs = jsonData.map(order => order.id); // Update orderIDs with all order IDs
    const lastData = jsonData[jsonData.length - 1];

    extractedData = {
      id: lastData.id,
      customer: lastData.customer,
      store: lastData.store,
      amount: lastData.amount,
      status: lastData.status,
      orderUrl: lastData.orderUrl,
      quoteUrl: '', // Placeholder for quoteUrl, update if available
      statusUrl: lastData.statusUrl,
      pickup: lastData.pickup,
      drop: lastData.drop
    };

    console.log('Extracted Data:', extractedData);
    console.log('Updated Order IDs:', orderIDs);
  } catch (error) {
    console.error('Error reading or parsing JSON file:', error);
  }
};

// Function to read delivery partners from data.json
const extractDataJsonDeliveryPartners = async () => {
  try {
    const data = await readJsonFile(dataFilePath);
    dataJsonDeliveryPartners = data.partners.map(partner => partner.name);
    console.log('Delivery Partners from data.json:', dataJsonDeliveryPartners);
  } catch (error) {
    console.error('Error reading or parsing data.json file:', error);
  }
};

// Function to watch for changes in orders.json
const watchOrdersJsonChanges = () => {
  fs.watch(ordersFilePath, (event, filename) => {
    if (filename) {
      console.log(`Changes detected in ${filename}. Reloading order IDs...`);
      extractData(); // Update orderIDs and extractedData
    }
  });
};

// Mock function to simulate axios.post
const mockAxiosPost = (url, data) => {
  return new Promise((resolve) => {
    console.log(`Mock POST request to ${url} with data:`, data);

    // Simulate different responses based on the URL
    if (url.includes('order')) {
      resolve({
        data: {
          success: true,
          deliveryUrl: 'https://mock.delivery.url',
          orderId: orderIDs[orderIDs.length - 1] // Use the latest order ID
        }
      });
    } else if (url.includes('status')) {
      resolve({
        data: {
          status: 'delivered'
        }
      });
    } else {
      resolve({
        data: {}
      });
    }
  });
};

// Use the mock function instead of axios.post for testing
const postRequest = mockAxiosPost;

// Function to place an order with the selected delivery partner
async function placeOrder(orderUrl, customerData, orderId, pickupLocation, dropLocation) {
  console.log(`Placing order with orderUrl: ${orderUrl}`);
  const response = await postRequest(orderUrl, {
    pickupLocation,
    dropLocation,
    customerData,
    orderId
  });
  console.log(`Order response: ${JSON.stringify(response.data)}`);
  return response.data;
}

// Function to check order status
async function checkOrderStatus(statusUrl, orderId) {
  console.log(`Checking order status with statusUrl: ${statusUrl}`);
  const response = await postRequest(statusUrl, { orderId });
  console.log(`Status response: ${JSON.stringify(response.data)}`);
  return response.data;
}

// Function to append order ID and delivery URL to track.json
const appendToTrack = async (orderId, deliveryUrl) => {
  try {
    // Make a GET request to /mockStatus to fetch updated tracking details
    const ordersData = await readJsonFile(ordersFilePath);

    // Assuming this is how your mockStatus endpoint responds
    // Read existing track.json content
    let trackData = [];
    if (fs.existsSync(trackFilePath)) {
      const trackJson = await readJsonFile(trackFilePath);
      trackData = trackJson;
    }

    // Function to check if an orderId already exists in trackData
    const isDuplicateOrder = (orderId) => {
      return trackData.some(entry => entry.orderId === orderId);
    };

    // Append new order to trackData if it's not a duplicate
    for (const order of ordersData) {
      const response = await axios.get('http://localhost:5000/mockStatus');
      const webhookTrackingDetails = response.data;
      if (!isDuplicateOrder(orderId)) {
        trackData.push({
          orderId: order.id,
          trackingDetails: webhookTrackingDetails,
          orderUrl: order.orderUrl
        });

        // Write updated trackData back to track.json
        fs.writeFileSync(trackFilePath, JSON.stringify(trackData, null, 2));
        console.log(`Appended order ${orderId} to track.json with webhook tracking details`);
      } else {
        console.log(`Order ${orderId} already exists in track.json. Skipping.`);
      }
    }

    console.log('Finished appending orders to track.json');
  } catch (error) {
    console.error('Error appending to track.json:', error);
  }
};

// Function to check if all tracking details are completed
const areAllTrackingDetailsCompleted = (trackingDetails) => {
  return trackingDetails.every(detail => detail.completed);
};

// Function to update order status to "Completed"
const updateOrderStatus = async () => {
  try {
    // Read the track.json file
    const trackData = await readJsonFile(trackFilePath);
    
    // Read the orders.json file
    const ordersData = await readJsonFile(ordersFilePath);

    // Create a flag to track if any order was updated
    let ordersUpdated = false;

    // Iterate through each order in track.json
    trackData.forEach(trackEntry => {
      if (areAllTrackingDetailsCompleted(trackEntry.trackingDetails)) {
        // Find the corresponding order in orders.json
        const order = ordersData.find(order => order.id === trackEntry.orderId);
        if (order && order.status !== 'Completed') {
          order.status = 'Completed';
          ordersUpdated = true;
        }
        else if (order.status == 'Completed'){
          order.status = 'Completed';
          ordersUpdated = true;
        }
        else{
            order.status = 'Failed';
            ordersUpdated = true;
        }
      }
    });

    // If any orders were updated, write back to orders.json
    if (ordersUpdated) {
      await writeJsonFile(ordersFilePath, ordersData);
      console.log('Orders updated successfully.');
    } else {
      console.log('No orders needed updating.');
    }
  } catch (error) {
    console.error('Error updating order status:', error);
  }
};

// Delivery partners configuration
let deliveryPartners = [];

// Function to initialize the server
const initializeServer = async () => {
  await extractData();
  await extractDataJsonDeliveryPartners();
  watchOrdersJsonChanges(); // Start watching orders.json for changes

  if (extractedData && dataJsonDeliveryPartners.length > 0) {
    deliveryPartners = dataJsonDeliveryPartners.map(partnerName => ({
      name: partnerName,
      endpoints: {
        quoteUrl: Math.floor(Math.random() * 200), // Random quote for demonstration
        orderUrl: extractedData.orderUrl,
        statusUrl: extractedData.statusUrl
      }
    }));

    // Utility function to delay execution
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Function to get quotes from all delivery partners
    async function getQuotes(pickupLocation, dropLocation) {
      const quotes = deliveryPartners.map(partner => ({
        partner: partner.name,
        quote: partner.endpoints.quoteUrl,
        orderUrl: partner.endpoints.orderUrl,
        statusUrl: partner.endpoints.statusUrl
      }));
      return quotes;
    }

    // Place order and check status automatically once
    try {
      console.log('Automatically placing order...');
      const { id: orderId, pickup, drop } = extractedData;
      const customerData = extractedData;

      // Get quotes
      console.log('Sending requests to delivery partners for quotes...');
      const quotes = await getQuotes(pickup, drop);

      // Select best quote
      const bestQuote = quotes.reduce((prev, current) => (prev.quote < current.quote ? prev : current));
      console.log(`Best quote from: ${bestQuote.partner} - $${bestQuote.quote}`);

      // Place order
      console.log('Placing order with the best quote...');
      const orderResponse = await placeOrder(bestQuote.orderUrl, customerData, orderId, pickup, drop);

      if (orderResponse.success) {
        const deliveryUrl = orderResponse.deliveryUrl;

        // Wait for 3 seconds
        await delay(3000);

        // Check order status
        console.log('Checking order status after 3 seconds...');
        const statusResponse = await checkOrderStatus(bestQuote.statusUrl, orderId);

        if (statusResponse.status === 'delivered') {
          console.log('Order request delivered to partner successfully.');
          await appendToTrack(orderId, deliveryUrl);
        } else {
          console.log('Order status unknown.');
        }
      } else {
        console.error('Failed to place order with the selected partner');
      }
    } catch (error) {
      console.error('Error processing order:', error);
    }
  } else {
    console.error('Failed to extract data or delivery partners. Server not started.');
  }
};

initializeServer();

// API endpoint to process order
app.post('/place-order', async (req, res) => {
  res.status(404).json({ message: 'This endpoint is not accessible directly. Please use the /status endpoint.' });
});

// API endpoint to check order status
app.post('/status', async (req, res) => {
  res.status(404).json({ message: 'This endpoint is not accessible directly. Please use the /place-order endpoint.' });
});

// Run the entire server initialization process every 15 seconds
setInterval(initializeServer, 15000);

// Run the updateOrderStatus function every 15 seconds
setInterval(updateOrderStatus, 15000);

app.listen(4000, () => {
  console.log('Server is running on port 4000');
});






/* For Real Time Api
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Function to read JSON file
const readJsonFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    });
  });
};

// Function to write JSON file
const writeJsonFile = (filePath, data) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const ordersFilePath = path.join(__dirname, '../src/info/orders.json');
const dataFilePath = path.join(__dirname, '../src/info/data.json'); // Path to data.json
const trackFilePath = path.join(__dirname, '../src/info/track.json'); // Path to track.json

// Variable to store extracted data
let extractedData = null;

// Variable to store delivery partners from data.json
let dataJsonDeliveryPartners = [];

// Array to store order IDs from orders.json
let orderIDs = [];

// Function to extract data from orders.json and update orderIDs
const extractData = async () => {
  try {
    const jsonData = await readJsonFile(ordersFilePath);
    orderIDs = jsonData.map(order => order.id); // Update orderIDs with all order IDs
    const lastData = jsonData[jsonData.length - 1];

    extractedData = {
      id: lastData.id,
      customer: lastData.customer,
      store: lastData.store,
      amount: lastData.amount,
      status: lastData.status,
      orderUrl: lastData.orderUrl,
      quoteUrl: '', // Placeholder for quoteUrl, update if available
      statusUrl: lastData.statusUrl,
      pickup: lastData.pickup,
      drop: lastData.drop
    };

    console.log('Extracted Data:', extractedData);
    console.log('Updated Order IDs:', orderIDs);
  } catch (error) {
    console.error('Error reading or parsing JSON file:', error);
  }
};

// Function to read delivery partners from data.json
const extractDataJsonDeliveryPartners = async () => {
  try {
    const data = await readJsonFile(dataFilePath);
    dataJsonDeliveryPartners = data.partners.map(partner => partner.name);
    console.log('Delivery Partners from data.json:', dataJsonDeliveryPartners);
  } catch (error) {
    console.error('Error reading or parsing data.json file:', error);
  }
};

// Function to watch for changes in orders.json
const watchOrdersJsonChanges = () => {
  fs.watch(ordersFilePath, (event, filename) => {
    if (filename) {
      console.log(`Changes detected in ${filename}. Reloading order IDs...`);
      extractData(); // Update orderIDs and extractedData
    }
  });
};

// Use Axios for actual API requests
const postRequest = axios.post;

// Function to place an order with the selected delivery partner
async function placeOrder(orderUrl, customerData, orderId, pickupLocation, dropLocation) {
  try {
    console.log(`Placing order with orderUrl: ${orderUrl}`);
    const response = await postRequest(orderUrl, {
      pickupLocation,
      dropLocation,
      customerData,
      orderId
    });
    console.log(`Order response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error(`Error placing order: ${error}`);
    throw error;
  }
}

// Function to check order status
async function checkOrderStatus(statusUrl, orderId) {
  try {
    console.log(`Checking order status with statusUrl: ${statusUrl}`);
    const response = await postRequest(statusUrl, { orderId });
    console.log(`Status response: ${JSON.stringify(response.data)}`);
    return response.data;
  } catch (error) {
    console.error(`Error checking order status: ${error}`);
    throw error;
  }
}

// Function to append order ID and delivery URL to track.json
const appendToTrack = async (orderId, deliveryUrl) => {
  try {
    // Read existing track.json content
    let trackData = [];
    if (fs.existsSync(trackFilePath)) {
      const trackJson = await readJsonFile(trackFilePath);
      trackData = trackJson;
    }

    // Check if the orderId already exists in trackData
    const isDuplicateOrder = (orderId) => {
      return trackData.some(entry => entry.orderId === orderId);
    };

    if (!isDuplicateOrder(orderId)) {
      // Append new order to trackData
      trackData.push({
        orderId,
        deliveryUrl
      });

      // Write updated trackData back to track.json
      await writeJsonFile(trackFilePath, trackData);
      console.log(`Appended order ${orderId} to track.json with delivery URL: ${deliveryUrl}`);
    } else {
      console.log(`Order ${orderId} already exists in track.json. Skipping.`);
    }

    console.log('Finished appending orders to track.json');
  } catch (error) {
    console.error('Error appending to track.json:', error);
  }
};

// Function to check if all tracking details are completed
const areAllTrackingDetailsCompleted = (trackingDetails) => {
  return trackingDetails.every(detail => detail.completed);
};

// Function to update order status to "Completed"
const updateOrderStatus = async () => {
  try {
    // Read the track.json file
    const trackData = await readJsonFile(trackFilePath);
    
    // Read the orders.json file
    const ordersData = await readJsonFile(ordersFilePath);

    // Create a flag to track if any order was updated
    let ordersUpdated = false;

    // Iterate through each order in track.json
    trackData.forEach(trackEntry => {
      if (areAllTrackingDetailsCompleted(trackEntry.trackingDetails)) {
        // Find the corresponding order in orders.json
        const order = ordersData.find(order => order.id === trackEntry.orderId);
        if (order && order.status !== 'Completed') {
          order.status = 'Completed';
          ordersUpdated = true;
        } else {
          order.status = 'Failed';
          ordersUpdated = true;
        }
      }
    });

    // If any orders were updated, write back to orders.json
    if (ordersUpdated) {
      await writeJsonFile(ordersFilePath, ordersData);
      console.log('Orders updated successfully.');
    } else {
      console.log('No orders needed updating.');
    }
  } catch (error) {
    console.error('Error updating order status:', error);
  }
};

// Delivery partners configuration
let deliveryPartners = [];

// Function to initialize the server
const initializeServer = async () => {
  await extractData();
  await extractDataJsonDeliveryPartners();
  watchOrdersJsonChanges(); // Start watching orders.json for changes

  if (extractedData && dataJsonDeliveryPartners.length > 0) {
    deliveryPartners = dataJsonDeliveryPartners.map(partnerName => ({
      name: partnerName,
      endpoints: {
        quoteUrl: Math.floor(Math.random() * 200), // Random quote for demonstration
        orderUrl: extractedData.orderUrl,
        statusUrl: extractedData.statusUrl
      }
    }));

    // Utility function to delay execution
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Function to get quotes from all delivery partners
    async function getQuotes(pickupLocation, dropLocation) {
      const quotes = deliveryPartners.map(partner => ({
        partner: partner.name,
        quote: partner.endpoints.quoteUrl,
        orderUrl: partner.endpoints.orderUrl,
        statusUrl: partner.endpoints.statusUrl
      }));
      return quotes;
    }

    // Place order and check status automatically once
    try {
      console.log('Automatically placing order...');
      const { id: orderId, pickup, drop } = extractedData;
      const customerData = extractedData;

      // Get quotes
      console.log('Sending requests to delivery partners for quotes...');
      const quotes = await getQuotes(pickup, drop);

      // Select best quote
      const bestQuote = quotes.reduce((prev, current) => (prev.quote < current.quote ? prev : current));
      console.log(`Best quote from: ${bestQuote.partner} - $${bestQuote.quote}`);

      // Place order
      console.log('Placing order with the best quote...');
      const orderResponse = await placeOrder(bestQuote.orderUrl, customerData, orderId, pickup, drop);

      if (orderResponse.success) {
        const deliveryUrl = orderResponse.deliveryUrl;

        // Wait for 3 seconds
        await delay(3000);

        // Check order status
        console.log('Checking order status after 3 seconds...');
        const statusResponse = await checkOrderStatus(bestQuote.statusUrl, orderId);

        if (statusResponse.status === 'delivered') {
          console.log('Order request delivered successfully.');
        } else {
          console.log(`Order status: ${statusResponse.status}`);
        }

        // Append to track.json
        await appendToTrack(orderId, deliveryUrl);

        // Update order status to "Completed" in orders.json
        await updateOrderStatus();
      } else {
        console.log('Order request failed.');
      }
    } catch (error) {
      console.error('Error in automatic order placement and status check:', error);
    }
  }
};

// Initialize the server
initializeServer();

// Start the Express server
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});


*/

