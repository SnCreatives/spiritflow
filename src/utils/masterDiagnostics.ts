import { apiGet } from './api';

export async function runMasterDataDiagnostic() {
  console.group('=== MASTER DATA DIAGNOSTIC RUNNER ===');
  try {
    console.log('Fetching /api/master/brands...');
    const res = await apiGet('/api/master/brands');
    console.log('API Response for /api/master/brands:', res);

    const brandsList = Array.isArray(res?.data)
      ? res.data
      : res?.data?.brands || res?.data?.items || (Array.isArray(res) ? res : []);
    console.log('Parsed brands list:', brandsList);

    if (!Array.isArray(brandsList) || brandsList.length === 0) {
      console.warn('DIAGNOSTIC WARNING: Brands array is empty or not an array!');
    } else {
      console.log(`DIAGNOSTIC SUCCESS: Found ${brandsList.length} brands. Sample:`, brandsList[0]?.name || brandsList[0]);
    }
  } catch (err) {
    console.error('DIAGNOSTIC ERROR fetching /api/master/brands:', err);
  }
  console.groupEnd();
}
