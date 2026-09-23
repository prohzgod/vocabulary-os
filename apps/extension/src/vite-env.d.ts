/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL baked into the build, e.g. https://api.example.com. Default: http://localhost:3000 */
  readonly VITE_API_URL?: string;
  /** Web dashboard URL opened from the popup. Default: http://localhost:5173 */
  readonly VITE_DASHBOARD_URL?: string;
}
