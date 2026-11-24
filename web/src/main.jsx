import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { syncContentRevision } from './utils/contentRevision.js';

/** 在加载持久化阅读状态前处理重置，避免先显示旧图、再跳走。 */
async function bootstrap() {
  await syncContentRevision();
  const [{ default: App }, { AuthProvider }] = await Promise.all([
    import('./knowledge/KnowledgeApp.jsx'), import('./contexts/AuthContext.jsx'),
  ]);

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
}

bootstrap();
if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.unlimitedBookNative?.bundled) {
  navigator.serviceWorker.register(new URL('sw.js', document.baseURI), { scope: './' }).catch(error => console.warn('离线应用壳未就绪', error.message));
}
