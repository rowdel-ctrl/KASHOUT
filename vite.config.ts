import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'node:fs';

// Firebase web settings are read from google-services.json (the same file the
// Android build uses). The file is git-ignored. Without it the app runs in demo mode.
function firebaseConfig() {
  const path = process.env.GOOGLE_SERVICES_JSON_PATH || 'android/app/google-services.json';
  if (!existsSync(path)) return null;
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    const projectId = j.project_info.project_id as string;
    const client = j.client[0];
    return {
      // FIREBASE_WEB_API_KEY (from the Firebase "Web app") is preferred: the Android key in
      // google-services.json can be locked to Android apps and refuse web calls.
      apiKey: (process.env.FIREBASE_WEB_API_KEY || client.api_key[0].current_key) as string,
      appId: client.client_info.mobilesdk_app_id as string,
      projectId,
      authDomain: `${projectId}.firebaseapp.com`,
    };
  } catch {
    return null;
  }
}

export default defineConfig({
  plugins: [react()],
  define: { __FIREBASE_CONFIG__: JSON.stringify(firebaseConfig()) },
  build: { outDir: 'dist', target: 'es2020' },
  test: { include: ['tests/*.test.ts'] },
});
