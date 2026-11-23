/**
 * App shell: state-based tab navigation (GitHub Pages safe — no history
 * routes), sticky summary bar, and modal management.
 */

import { useState } from 'react';
import { Brain, Home, Save, Settings2, TrendingUp } from 'lucide-react';
import { StickySummaryBar } from './components/layout/StickySummaryBar';
import { HomeOutputsTab } from './components/tabs/HomeOutputsTab';
import { PlannerSettingsTab } from './components/tabs/PlannerSettingsTab';
import { ExitPlannerTab } from './components/tabs/ExitPlannerTab';
import { SavedScenariosTab } from './components/tabs/SavedScenariosTab';
import { AiScenarioReviewDrawer } from './components/modals/AiScenarioReviewDrawer';
import { CgtRulesModal } from './components/modals/CgtRulesModal';
import { LocalAiSettingsModal } from './components/modals/LocalAiSettingsModal';
import { TaxUpdateDiffModal } from './components/modals/TaxUpdateDiffModal';

type Tab = 'home' | 'settings' | 'exit' | 'saved';

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home & Outputs', icon: Home },
  { id: 'settings', label: 'Planner Settings', icon: Settings2 },
  { id: 'exit', label: 'Exit Planner', icon: TrendingUp },
  { id: 'saved', label: 'Saved Scenarios', icon: Save },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showAiReview, setShowAiReview] = useState(false);
  const [showCgtRules, setShowCgtRules] = useState(false);
  const [showTaxDiff, setShowTaxDiff] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-2">
            <h1 className="text-base font-bold leading-tight">NSW Property Purchase &amp; Exit Strategy Planner</h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              100% local &amp; private — your data never leaves this browser
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <t.icon size={15} />
                {t.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setShowAiSettings(true)}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/40"
          >
            <Brain size={15} />
            Local AI
          </button>
        </div>
      </header>

      <StickySummaryBar onToggleTheme={() => undefined} />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {tab === 'home' && <HomeOutputsTab onOpenAiReview={() => setShowAiReview(true)} onOpenCgtRules={() => setShowCgtRules(true)} onOpenTaxDiff={() => setShowTaxDiff(true)} />}
        {tab === 'settings' && <PlannerSettingsTab />}
        {tab === 'exit' && <ExitPlannerTab onOpenCgtRules={() => setShowCgtRules(true)} />}
        {tab === 'saved' && <SavedScenariosTab />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-6">
        <p className="text-[11px] leading-relaxed text-zinc-400">
          Estimates only — not financial, tax or legal advice. ATO tables, NSW duty/land-tax schedules and LMI bands are
          embedded data and may lag legislative change; verify with the ATO, Revenue NSW and your lender. All computation
          runs locally in your browser; the optional AI features talk only to your own LM Studio server.
        </p>
      </footer>

      {showAiSettings && <LocalAiSettingsModal onClose={() => setShowAiSettings(false)} />}
      {showAiReview && <AiScenarioReviewDrawer onClose={() => setShowAiReview(false)} />}
      {showCgtRules && <CgtRulesModal onClose={() => setShowCgtRules(false)} />}
      {showTaxDiff && <TaxUpdateDiffModal onClose={() => setShowTaxDiff(false)} />}
    </div>
  );
}
