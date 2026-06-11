import { useState } from 'react';
import { Tabs } from '../ui';
import { NextMapPanel } from './NextMapPanel';
import { SuggestionPanel } from './SuggestionPanel';

type Tab = 'next-map' | 'suggestion';

const TABS: { id: Tab; label: string }[] = [
  { id: 'next-map', label: '🧩 다음 문제' },
  { id: 'suggestion', label: '💡 풀이 제안' },
];

// 플레이 모드 우 존의 좁은 폭(사이드바/모바일 시트)에 맞춘 세로 스택 패널.
// 탭은 팔레트와 동일한 폴더탭 패턴을 쓴다.
export function RightSidePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('next-map');

  return (
    <div className="border border-line rounded-tile overflow-hidden">
      <Tabs
        variant="folder"
        items={TABS.map(t => ({ id: t.id, label: t.label }))}
        value={activeTab}
        onChange={(id) => setActiveTab(id as Tab)}
      />
      <div className="p-2 bg-surface">
        {activeTab === 'next-map' && <NextMapPanel />}
        {activeTab === 'suggestion' && <SuggestionPanel />}
      </div>
    </div>
  );
}
