import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DemoApp from "./demo/DemoApp.jsx";
import AppApp from "./app/AppApp.jsx";
import { ErrorState } from "./components/DataState.jsx";

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorState error={{ message: "当前路径不存在。" }} label="页面未找到" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/demo" replace />} />
        <Route path="/demo/*" element={<DemoApp />} />
        <Route path="/app/*" element={<AppApp />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
