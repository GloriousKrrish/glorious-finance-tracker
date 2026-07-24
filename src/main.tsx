if (typeof window !== "undefined" && !(window as any).$_TSR) {
  (window as any).$R = (window as any).$R || {};
  (window as any).$_TSR = {
    hydrated: true,
    streamEnded: true,
    initialized: true,
    buffer: [],
    h() { (this as any).hydrated = true; (this as any).c(); },
    e() { (this as any).streamEnded = true; (this as any).c(); },
    c() {},
    p(e: any) { if (typeof e === "function") e(); },
    router: {
      manifest: { routes: {} },
      matches: [{ i: "__root__", u: Date.now(), s: "success", ssr: false }],
      lastMatchId: "__root__"
    }
  };
}

import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}
