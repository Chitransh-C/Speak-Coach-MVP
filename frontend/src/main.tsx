import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/modules/auth/AuthContext";
import { LoginPage, SignupPage } from "@/modules/auth/AuthPages";
import { HomePage } from "@/modules/scenarios/HomePage";
import { LearnPage, WatchPage } from "@/modules/scenarios/ScenarioPages";
import { SetupPage } from "@/modules/scenarios/SetupPage";
import { PracticePage } from "@/modules/practice/PracticePage";
import { FeedbackPage } from "@/modules/feedback/FeedbackPage";
import { ReportsPage } from "@/modules/reports/ReportsPage";
import { JourneyPage } from "@/modules/journey/JourneyPage";
import { AppShell, RequireAuth } from "@/shared/ui/AppShell";
import "@/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/journey" element={<JourneyPage />} />
              <Route path="/scenarios/:scenarioId/learn" element={<LearnPage />} />
              <Route path="/scenarios/:scenarioId/watch" element={<WatchPage />} />
              <Route path="/scenarios/:scenarioId/setup" element={<SetupPage />} />
              <Route path="/scenarios/:scenarioId/practice" element={<PracticePage />} />
              <Route path="/sessions/:sessionId/feedback" element={<FeedbackPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
