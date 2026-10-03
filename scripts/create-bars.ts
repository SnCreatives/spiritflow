
import { MasterService } from '../src/server/services/masterService.js';

async function createBars() {
  const ownerId = 'b649fa66-a1c0-45fe-9184-c8164dc43ef0';
  const barA = await MasterService.createBar({ name: 'Bar Alpha' }, ownerId);
  const barB = await MasterService.createBar({ name: 'Bar Beta' }, ownerId);
  console.log('Created bars:', [barA, barB]);
}
createBars().catch(console.error);
