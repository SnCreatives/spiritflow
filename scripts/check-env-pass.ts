
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const match = dbUrl.match(/:\/\/([^:]+):([^@]+)@/);
  if (match) {
    const user = match[1];
    const pass = match[2];
    console.log('User:', user);
    console.log('Pass Length:', pass.length);
    console.log('Pass Start:', pass.substring(0, 2));
    console.log('Pass End:', pass.substring(pass.length - 2));
  } else {
    console.log('No match in URL');
  }
} else {
  console.log('No DATABASE_URL');
}
