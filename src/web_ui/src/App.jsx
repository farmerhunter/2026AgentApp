import { useMemo, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import LearningContentView from "./views/LearningContentView.jsx";
import LearningResultsView from "./views/LearningResultsView.jsx";
import TextNoteView from "./views/TextNoteView.jsx";
import WeeklyReportsView from "./views/WeeklyReportsView.jsx";
import HomeView from "./views/HomeView.jsx";

const views = {
  home: HomeView,
  results: LearningResultsView,
  notes: TextNoteView,
  reports: WeeklyReportsView,
  content: LearningContentView,
};

export default function App() {
  const [activeView, setActiveView] = useState("home");
  const ActiveView = useMemo(() => views[activeView], [activeView]);

  return (
    <AppShell activeView={activeView} onViewChange={setActiveView}>
      <ActiveView onNavigate={setActiveView} />
    </AppShell>
  );
}
