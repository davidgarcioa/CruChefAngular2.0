import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '..', 'src', 'app', 'environment.ts');
const defaultAdminEmails = 'davidgarciaparada2020@gmail.com';

function parseCsv(value) {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const environment = {
  production: process.env.VERCEL === '1' || process.env.NODE_ENV === 'production',
  apiBaseUrl: process.env.CRUCHEF_API_BASE_URL || 'http://localhost:3000/api',
  voiceBackendUrl: process.env.CRUCHEF_VOICE_BACKEND_URL || 'http://localhost:8000',
  adminEmails: parseCsv(process.env.CRUCHEF_ADMIN_EMAILS || defaultAdminEmails),
  firebaseConfig: {
    apiKey: process.env.CRUCHEF_FIREBASE_API_KEY || 'AIzaSyDyURnZJ6DEFHW04R8lJvDIY9drPK8is6c',
    authDomain: process.env.CRUCHEF_FIREBASE_AUTH_DOMAIN || 'cruchefangular.firebaseapp.com',
    projectId: process.env.CRUCHEF_FIREBASE_PROJECT_ID || 'cruchefangular',
    storageBucket: process.env.CRUCHEF_FIREBASE_STORAGE_BUCKET || 'cruchefangular.firebasestorage.app',
    messagingSenderId: process.env.CRUCHEF_FIREBASE_MESSAGING_SENDER_ID || '451514637467',
    appId: process.env.CRUCHEF_FIREBASE_APP_ID || '1:451514637467:web:a2393ca908935a637afa3e',
  },
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(
  outputPath,
  `export const environment = ${JSON.stringify(environment, null, 2)};\n`,
);

console.log(`Environment written to ${outputPath}`);
