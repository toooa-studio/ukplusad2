'use client';

import { SLOT_WEEK_COLOR_PRESETS } from '@/lib/scheduleSlotStyle';
import { useTeacherLocaleOptional } from '@/lib/hooks/useTeacherLocale';
import { translations, type TeacherLocale } from '@/lib/teacher/i18n/translations';

const PRESET_LABEL_EN: Record<string, string> = {
  default: 'Default',
  mint: 'Mint',
  sky: 'Sky',
  violet: 'Violet',
  amber: 'Amber',
  rose: 'Rose',
  slate: 'Slate',
  coral: 'Coral',
};

export function SlotWeekColorPresetStrip({
  value,
  onChange,
  showCustomOption,
  locale: localeProp,
}: {
  value: string;
  onChange: (presetId: string) => void;
  showCustomOption?: boolean;
  locale?: TeacherLocale;
}) {
  const teacherLocale = useTeacherLocaleOptional();
  const locale = localeProp ?? teacherLocale?.locale ?? 'ja';
  const t = teacherLocale?.t ?? ((key: keyof typeof translations.ja) => translations[locale][key]);

  return (
    <div className="border border-gray-200 p-3 rounded-[6px]">
      <p className="text-xs font-medium text-gray-700 mb-2">{t('colorStrip.title')}</p>
      <div className="flex flex-wrap gap-2">
        {SLOT_WEEK_COLOR_PRESETS.map((p) => {
          const selected = value === p.id;
          const presetLabel = locale === 'en' ? (PRESET_LABEL_EN[p.id] ?? p.label) : p.label;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              title={presetLabel}
              aria-label={presetLabel}
              aria-pressed={selected}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[6px] border transition-colors shrink-0 ${
                selected
                  ? 'border-blue-600 ring-2 ring-blue-500 ring-offset-1'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {p.id === 'default' ? (
                <span className="text-xs font-medium text-gray-600 px-1">{t('colorStrip.auto')}</span>
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
            title={t('colorStrip.customTitle')}
            aria-pressed={value === 'custom'}
            className={`min-w-[44px] min-h-[44px] px-2 flex items-center justify-center rounded-[6px] border text-xs font-medium transition-colors shrink-0 ${
              value === 'custom'
                ? 'border-blue-600 ring-2 ring-blue-500 ring-offset-1 text-blue-800'
                : 'border-gray-300 text-gray-600 hover:border-gray-400'
            }`}
          >
            {t('colorStrip.custom')}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 leading-relaxed">
        {t('colorStrip.hint')}
      </p>
    </div>
  );
}
