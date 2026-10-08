import { AuthService } from '../src/server/services/authService.js';
import dotenv from 'dotenv';
dotenv.config();

async function simulate() {
  const token = '8f7c03e794709c24bcaa4955cb7dc83928d8e520ec20229022d54666dbe38b0c';
  console.log('--- SIMULATING VALIDATE SESSION ---');
  const user = await AuthService.validateSession(token);
  if (user) {
    console.log('SUCCESS: User found:', user.mobile_number);
  } else {
    console.log('FAILURE: User not found');
  }
}
simulate();
