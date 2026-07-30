import { Pill } from '../../components/ui';

/* 어드민 백본용 빈 탭 패널.
   세부 기능이 정해지면 각 탭 파일에서 이 컴포넌트를 실제 UI 로 교체한다. */
export function TabPlaceholder({ icon, title, note }: { icon: string; title: string; note: string }) {
  return (
    <div className="h-full overflow-y-auto p-8 flex flex-col items-center justify-center gap-2 text-center">
      <span className="text-4xl" aria-hidden>{icon}</span>
      <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
      <p className="max-w-sm text-xs text-ink-muted leading-relaxed">{note}</p>
      <Pill tone="neutral" className="mt-1">준비 중</Pill>
    </div>
  );
}
