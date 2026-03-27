// native fetch
import jwt from 'jsonwebtoken';

async function test() {
  try {
    const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@darwinbox.io', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    console.log('Login:', loginData);

    const token = loginData.data?.token;
    if (!token) return console.log('No token');

    const collectionsRes = await fetch('http://localhost:4000/api/v1/catalog/collections', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const collectionsData = await collectionsRes.json();
    
    // Find a collection and a field
    const modules = Object.keys(collectionsData.data || {});
    if (!modules.length) return console.log('No modules');
    
    const collId = collectionsData.data[modules[0]][0]._id;
    
    const collDetailRes = await fetch(`http://localhost:4000/api/v1/catalog/collections/${collId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const collDetailData = await collDetailRes.json();
    
    const fields = collDetailData.data?.fields || [];
    if (!fields.length) return console.log('No fields');
    
    const fieldToUpdate = fields[0];
    console.log('Updating field:', fieldToUpdate._id);

    const updateRes = await fetch(`http://localhost:4000/api/v1/catalog/fields/${fieldToUpdate._id}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ manualDescription: 'Test override' })
    });
    
    const updateData = await updateRes.json();
    console.log('Update Status:', updateRes.status);
    console.log('Update Data:', updateData);
  } catch (err) {
    console.error(err);
  }
}

test();
