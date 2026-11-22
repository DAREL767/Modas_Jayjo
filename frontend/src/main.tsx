import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import "./index.css";

const app = (
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

ReactDOM.createRoot(document.getElementById("root")!).render(
  clientId ? <GoogleOAuthProvider clientId={clientId}>{app}</GoogleOAuthProvider> : app,
);
