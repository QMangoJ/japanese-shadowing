import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { UsageDock } from "./UsageDock.tsx";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
		<UsageDock />
	</StrictMode>,
);
