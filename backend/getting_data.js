//For MOCK API 
const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');

const app = express();
const port = 8000;

// Connect to SQLite database
const db = new sqlite3.Database("../src/info/data.sqlite", (err) => {
  if (err) {
    console.error('Error connecting to database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS Orders_details (
  id INTEGER PRIMARY KEY UNIQUE,
  customer_name TEXT,
  store TEXT,
  amount TEXT,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) {
    console.error('Error creating table:', err.message);
  } else {
    console.log('Table created successfully.');
  }
});

// Function to select specific data from the JSON response
let selectData = (data) => {
  let id = data.id;
  let customer = data.customer;
  let store = data.store;
  let amount = data.amount;
  let status = data.status;
  let orderUrl = data.orderUrl;
  let quoteUrl = data.quoteUrl;
  let statusUrl = data.statusUrl;
  let pickup = data.pickup;
  let drop = data.drop;
  return { id, customer, store, amount, status, orderUrl, quoteUrl, statusUrl, pickup, drop };
};

// Function to check if a store has a delivery partner
let checkDeliveryPartner = (store, storesData) => {
  let storeData = storesData.stores.find(s => s.name === store);
  return storeData ? storeData.hasDeliveryPartner : false;
};

// Function to fetch, select, and save JSON data
let fetchDataAndSave = () => {
  try {
    const mockDataFilePath = path.join(__dirname, 'mock_data.json');
    const storesDataFilePath = "../src/info/data.json";

    // Read stores data from JSON file
    fs.readFile(storesDataFilePath, 'utf8', (err, storesFileData) => {
      if (err) {
        console.error('Error reading stores data file:', err.message);
        return;
      }

      const storesData = JSON.parse(storesFileData);

      // Read mock data from JSON file
      fs.readFile(mockDataFilePath, 'utf8', (err, mockFileData) => {
        if (err) {
          console.error('Error reading mock data file:', err.message);
          return;
        }

        try {
          const data = JSON.parse(mockFileData);

          // Map and select specific data
          const selectedData = data.map(item => selectData(item));

          // Path to the output JSON file
          const outputFilePath = "../src/info/orders.json";

          // Read the existing data from the JSON file
          fs.readFile(outputFilePath, 'utf8', (err, fileData) => {
            let jsonData = []; // Initialize jsonData as an empty array

            if (err) {
              if (err.code !== 'ENOENT') {
                console.error('Error reading the file:', err.message);
                return;
              }
            } else {
              try {
                // Parse the existing data to a JavaScript array if the file exists
                jsonData = JSON.parse(fileData);
              } catch (parseErr) {
                console.error('Error parsing JSON data:', parseErr.message);
                return;
              }
            }

            // Filter selectedData based on delivery partner status and remove duplicates
            const filteredData = selectedData.filter(item => {
              return !checkDeliveryPartner(item.store, storesData) && !jsonData.some(existingItem => existingItem.id === item.id);
            });

            // Append the filtered data to the array
            jsonData = jsonData.concat(filteredData);

            // Convert the updated object back to a JSON string
            const updatedData = JSON.stringify(jsonData, null, 2);

            // Write the updated JSON string back to the file
            fs.writeFile(outputFilePath, updatedData, 'utf8', (writeErr) => {
              if (writeErr) {
                console.error('Error writing the file:', writeErr.message);
                return;
              }
              console.log('Data appended successfully:', filteredData);

              // Insert filtered data into SQLite database after JSON file is successfully updated
              filteredData.forEach((data) => {
                db.run(`INSERT INTO Orders_details (id, customer_name, store, amount, status) VALUES (?, ?, ?, ?, ?)`,
                  [data.id, data.customer, data.store, data.amount, data.status],
                  function(err) {
                    if (err) {
                      console.error('Error inserting data into database:', err.message);
                    } else {
                      console.log('Data inserted successfully into database');
                    }
                  });
              });
            });
          });
        } catch (parseErr) {
          console.error('Error parsing JSON data:', parseErr.message);
        }
      });
    });
  } catch (error) {
    console.error('Error fetching or processing data:', error);
  }
};

// Endpoint to fetch, select, and save JSON data
app.get('/', (req, res) => {
  fetchDataAndSave();
  res.json({ message: 'Data fetched, selected, and processed successfully' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  
  // Automatically call the endpoint every 15 seconds
  setInterval(() => {
    http.get(`http://localhost:${port}/`);
  }, 15000); // 15000 milliseconds = 15 seconds
});





/* FOR REAL API 
const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const axios = require('axios');

const app = express();
const port = 8000;

// Connect to SQLite database
const db = new sqlite3.Database("../src/info/data.sqlite", (err) => {
  if (err) {
    console.error('Error connecting to database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Create table if not exists
db.run(`CREATE TABLE IF NOT EXISTS Orders_details (
  id INTEGER PRIMARY KEY UNIQUE,
  customer_name TEXT,
  store TEXT,
  amount TEXT,
  status TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`, (err) => {
  if (err) {
    console.error('Error creating table:', err.message);
  } else {
    console.log('Table created successfully.');
  }
});

// Function to select specific data from the JSON response
let selectData = (data) => {
  let id = data.id;
  let customer = data.customer;
  let store = data.store;
  let amount = data.amount;
  let status = data.status;
  let orderUrl = data.orderUrl;
  let quoteUrl = data.quoteUrl;
  let statusUrl = data.statusUrl;
  let pickup = data.pickup;
  let drop = data.drop;
  return { id, customer, store, amount, status, orderUrl, quoteUrl, statusUrl, pickup, drop };
};

// Function to check if a store has a delivery partner
let checkDeliveryPartner = (store, storesData) => {
  let storeData = storesData.stores.find(s => s.name === store);
  return storeData ? storeData.hasDeliveryPartner : false;
};

// Function to fetch, select, and save JSON data
let fetchDataAndSave = async () => {
  try {
    const apiUrl = 'https://api.example.com/orders'; // Replace with your actual API URL
    const storesDataFilePath = "../src/info/data.json";

    // Fetch stores data from JSON file
    const storesFileData = await fs.promises.readFile(storesDataFilePath, 'utf8');
    const storesData = JSON.parse(storesFileData);

    // Fetch data from the API
    const response = await axios.get(apiUrl);
    const data = response.data; // Adjust based on actual response structure

    // Map and select specific data
    const selectedData = data.map(item => selectData(item));

    // Path to the output JSON file
    const outputFilePath = "../src/info/orders.json";

    // Read the existing data from the JSON file
    let jsonData = [];
    try {
      const fileData = await fs.promises.readFile(outputFilePath, 'utf8');
      jsonData = JSON.parse(fileData);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Error reading the file:', err.message);
        return;
      }
    }

    // Filter selectedData based on delivery partner status and remove duplicates
    const filteredData = selectedData.filter(item => {
      return !checkDeliveryPartner(item.store, storesData) && !jsonData.some(existingItem => existingItem.id === item.id);
    });

    // Append the filtered data to the array
    jsonData = jsonData.concat(filteredData);

    // Convert the updated object back to a JSON string
    const updatedData = JSON.stringify(jsonData, null, 2);

    // Write the updated JSON string back to the file
    await fs.promises.writeFile(outputFilePath, updatedData, 'utf8');
    console.log('Data appended successfully:', filteredData);

    // Insert filtered data into SQLite database after JSON file is successfully updated
    filteredData.forEach((data) => {
      db.run(`INSERT INTO Orders_details (id, customer_name, store, amount, status) VALUES (?, ?, ?, ?, ?)`,
        [data.id, data.customer, data.store, data.amount, data.status],
        function(err) {
          if (err) {
            console.error('Error inserting data into database:', err.message);
          } else {
            console.log('Data inserted successfully into database');
          }
        });
    });
  } catch (error) {
    console.error('Error fetching or processing data:', error);
  }
};

// Endpoint to fetch, select, and save JSON data
app.get('/', async (req, res) => {
  await fetchDataAndSave();
  res.json({ message: 'Data fetched, selected, and processed successfully' });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  
  // Automatically call the endpoint every 15 seconds
  setInterval(() => {
    http.get(`http://localhost:${port}/`);
  }, 15000); // 15000 milliseconds = 15 seconds
});

*/