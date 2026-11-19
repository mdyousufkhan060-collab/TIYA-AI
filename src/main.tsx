import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { installClientApi } from './lib/clientApi';
import './index.css';

// AI calls run on the device (works on Vercel and in the Android app)
installClientApi();

createRoot(document.getElementById('root')!).render(<App />);
