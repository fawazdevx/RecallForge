import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.tsx";
import { dAppKit } from "./dApp-kit.ts";
import { RecallForgeProvider } from "./context/RecallForgeContext.tsx";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        <RecallForgeProvider>
          <App />
        </RecallForgeProvider>
      </DAppKitProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
