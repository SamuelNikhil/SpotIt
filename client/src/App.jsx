import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Screen from './pages/Screen';
import Controller from './pages/Controller';
import './index.css';

/**
 * SpotIt Main Application Entry
 *
 * Routes:
 * /screen             - The main game view (displayed on TV/Monitor)
 * /join/:roomId/:token - The private entry link accessed via QR code
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route redirects to screen creation */}
        <Route path="/" element={<Navigate to="/screen" replace />} />

        {/* The Host/TV view */}
        <Route path="/screen" element={<Screen />} />

        {/* The Player/Smartphone view
            Accessible only via the specific Room ID and Security Token
        */}
        <Route path="/join/:roomId/:token" element={<Controller />} />

        {/* Fallback for invalid URLs */}
        <Route path="*" element={
          <div className="min-h-screen bg-dark flex items-center justify-center text-white">
            <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
