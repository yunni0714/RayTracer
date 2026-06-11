import { useState } from 'react';
import { cx } from '../ui';
import { NextMapPanel } from './NextMapPanel';
import { SuggestionPanel } from './SuggestionPanel';

type Tab = 'next-map' | 'suggestion';

const TABS: { id: Tab; label: string }[] = [
  { id: 'next-map', label: '다\n음\n문\n제' },
  { id: 'suggestion', label: '풀\n이\n제\n안' },
];

export function RightSidePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('next-map');

  return (
    <div className="flex flex-row w-full min-h-[300px] bg-surface border border-line rounded-card overflow-hidden">
      {/* 수직 탭 버튼 */}
      <div className="flex flex-col w-10 bg-surface-2 border-r border-line shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              'flex-1 text-[11px] font-bold px-1 py-3.5 leading-relaxed text-center whitespace-pre-line transition-colors border-b border-line',
              activeTab === tab.id
                ? 'bg-primary text-primary-ink'
                : 'bg-transparent text-ink-muted hover:bg-surface-3 hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 패널 콘텐츠 */}
      <div className="flex-1 overflow-y-auto p-[18px] min-w-0">
        {activeTab === 'next-map' && <NextMapPanel />}
        {activeTab === 'suggestion' && <SuggestionPanel />}
      </div>
    </div>
  );
}
