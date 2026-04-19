'use client';

import { SLOT_WEEK_COLOR_PRESETS } from '@/lib/scheduleSlotStyle';

export function SlotWeekColorPresetStrip({
  value,
  onChange,
  showCustomOption,
}: {
  value: string;
  onChange: (presetId: string) => void;
  showCustomOption?: boolean;
}) {
  return (
    <div className="border border-gray-200 p-3 rounded-[6px]">
      <p className="text-xs font-medium text-gray-700 mb-2">週表示のコマ色</p>
      <div className="flex flex-wrap gap-2">
        {SLOT_WEEK_COLOR_PRESETS.map((p) => {
          const selected = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              title={p.label}
              aria-label={p.label}
              aria-pressed={selected}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[6px] border transition-colors shrink-0 ${
                selected
                  ? 'border-blue-600 ring-2 ring-blue-500 ring-offset-1'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {p.id === 'default' ? (
                <span className="text-xs font-medium text-gray-600 px-1">自動</span>
              ) : (
                <span
                  className="block w-9 h-9 rounded-[4px] border border-gray-300"
                  style={{ backgroundColor: p.weekCellBg!, color: p.weekCellText! }}
                />
              )}
            </button>
          );
        })}
        {showCustomOption && (
          <button
            type="button"
            onClick={() => onChange('custom')}
            title="色を自分で指定"
            aria-pressed={value === 'custom'}
            className={`min-w-[44px] min-h-[44px] px-2 flex items-center justify-center rounded-[6px] border text-xs font-medium transition-colors shrink-0 ${
              value === 'custom'
                ? 'border-blue-600 ring-2 ring-blue-500 ring-offset-1 text-blue-800'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            その他
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 leading-relaxed">
        「自動」では週表示の共通色（空き・予約済み・閉鎖）が使われます。色を選ぶと、この枠だけ上書き表示されます。
      </p>
    </div>
  );
}
