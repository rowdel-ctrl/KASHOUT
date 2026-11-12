import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import './styles.css';
import App from './ui/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
