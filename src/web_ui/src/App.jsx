import { useMemo, useState } from "react";
import AppShell from "./components/AppShell.jsx";
import LearningContentView from "./views/LearningContentView.jsx";
import LearningResultsView from "./views/LearningResultsView.jsx";
import TextNoteView from "./views/TextNoteView.jsx";
import WeeklyReportsView from "./views/WeeklyReportsView.jsx";

const views = {
  results: LearningResultsView,
  notes: TextNoteView,
  reports: WeeklyReportsView,
  content: LearningContentView,
};

export default function App() {
  const [activeView, setActiveView] = useState("results");
  const ActiveView = useMemo(() => views[activeView], [activeView]);

  return (
    <AppShell activeView={activeView} onViewChange={setActiveView}>
      <ActiveView />
    </AppShell>
  );
}
