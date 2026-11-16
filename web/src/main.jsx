import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { syncContentRevision } from './utils/contentRevision.js';

/** 在加载持久化阅读状态前处理重置，避免先显示旧图、再跳走。 */
async function bootstrap() {
  await syncContentRevision();
  const [{ default: App }, { AuthProvider }, { AppStateProvider }] = await Promise.all([
    import('./App.jsx'), import('./contexts/AuthContext.jsx'), import('./contexts/AppStateContext.jsx'),
  ]);

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AuthProvider>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </AuthProvider>
    </StrictMode>
  );
}

bootstrap();
