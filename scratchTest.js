const mongoose = require('mongoose');
require('dotenv').config();

async function testBackendEndpoint() {
  try {
    const res = await fetch('http://www.mayadstudio.com/api/admin/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'mayadstudio122@gmail.com' })
    });
    const data = await res.json();
    console.log('Forgot password test response:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
testBackendEndpoint();
