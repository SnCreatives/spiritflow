
import { BarStoreService } from '../src/server/services/barStoreService.js';

async function listBars() {
  const bars = await BarStoreService.getBars('test-user-id');
  console.log('Existing bars:', bars);
}
listBars().catch(console.error);
