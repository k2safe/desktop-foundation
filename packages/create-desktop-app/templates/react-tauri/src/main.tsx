import "@desktop-foundation/ui-react/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createProductClient } from "./api/client";

const client = await createProductClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App client={client} />
  </StrictMode>
);
