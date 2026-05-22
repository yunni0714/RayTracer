import { useState } from 'react';
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
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      width: 420,
      flexShrink: 0,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 10,
      overflow: 'hidden',
      alignSelf: 'stretch',
    }}>
      {/* 수직 탭 버튼 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: 40,
        background: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        flexShrink: 0,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              border: 'none',
              background: activeTab === tab.id ? '#2980b9' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#94a3b8',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              padding: '14px 4px',
              lineHeight: 1.4,
              textAlign: 'center',
              fontFamily: 'inherit',
              whiteSpace: 'pre-line',
              transition: 'background 0.2s, color 0.2s',
              borderBottom: '1px solid #e2e8f0',
            }}
            onMouseEnter={e => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = '#e2e8f0';
                e.currentTarget.style.color = '#334155';
              }
            }}
            onMouseLeave={e => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 패널 콘텐츠 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 18, minWidth: 0 }}>
        {activeTab === 'next-map' && <NextMapPanel />}
        {activeTab === 'suggestion' && <SuggestionPanel />}
      </div>
    </div>
  );
}
