import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/modules/auth/AuthContext";
import { LoginPage, SignupPage } from "@/modules/auth/AuthPages";
import { HomePage } from "@/modules/scenarios/HomePage";
import { LearnPage, WatchPage } from "@/modules/scenarios/ScenarioPages";
import { SetupPage } from "@/modules/scenarios/SetupPage";
import { MyScenariosPage } from "@/modules/scenarios/MyScenariosPage";
import {
  CreateScenarioPage,
  EditMyScenarioPage,
} from "@/modules/scenarios/CreateScenarioPage";
import { PracticePage } from "@/modules/practice/PracticePage";
import { FeedbackPage } from "@/modules/feedback/FeedbackPage";
import { ReportsPage } from "@/modules/reports/ReportsPage";
import { JourneyPage } from "@/modules/journey/JourneyPage";
import { AppShell, RequireAuth } from "@/shared/ui/AppShell";
import { AdminShell, RequireAdmin } from "@/modules/admin/AdminShell";
import {
  AdminDashboardPage,
  AdminHealthPage,
  AdminPromptEditPage,
  AdminPromptsPage,
  AdminScenarioEditPage,
  AdminScenariosPage,
  AdminSessionDetailPage,
  AdminSessionsPage,
  AdminTracksPage,
  AdminUserDetailPage,
  AdminUsersPage,
} from "@/modules/admin/AdminPages";
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
              <Route path="/my-scenarios" element={<MyScenariosPage />} />
              <Route path="/my-scenarios/:scenarioId/edit" element={<EditMyScenarioPage />} />
              <Route path="/scenarios/create" element={<CreateScenarioPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/journey" element={<JourneyPage />} />
              <Route path="/scenarios/:scenarioId/learn" element={<LearnPage />} />
              <Route path="/scenarios/:scenarioId/watch" element={<WatchPage />} />
              <Route path="/scenarios/:scenarioId/setup" element={<SetupPage />} />
              <Route path="/scenarios/:scenarioId/practice" element={<PracticePage />} />
              <Route path="/sessions/:sessionId/feedback" element={<FeedbackPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminShell />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="users/:id" element={<AdminUserDetailPage />} />
                  <Route path="tracks" element={<AdminTracksPage />} />
                  <Route path="scenarios" element={<AdminScenariosPage />} />
                  <Route path="scenarios/new" element={<AdminScenarioEditPage />} />
                  <Route path="scenarios/:id" element={<AdminScenarioEditPage />} />
                  <Route path="prompts" element={<AdminPromptsPage />} />
                  <Route path="prompts/:id" element={<AdminPromptEditPage />} />
                  <Route path="sessions" element={<AdminSessionsPage />} />
                  <Route path="sessions/:id" element={<AdminSessionDetailPage />} />
                  <Route path="health" element={<AdminHealthPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
