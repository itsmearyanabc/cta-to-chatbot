import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/admin/login', {
      username: 'admin',
      password: 'admin123'
    });
    console.log('Success:', res.data);
  } catch (error: any) {
    console.log('Error:', error.response?.status, error.response?.data);
  }
}
test();
