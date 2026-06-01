import { useMemo, useState, type ReactNode } from "react";
import { Button } from "../primitives/Button";

export interface DateRangeValue {
  start?: string;
  end?: string;
}

export interface DateRangePickerProps {
  label?: ReactNode;
  value: DateRangeValue;
  startLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  applyLabel?: string;
  clearLabel?: string;
  onChange: (value: DateRangeValue) => void;
}

function toInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthDays(anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const days: Date[] = [];
  for (let index = 0; index < startOffset; index += 1) {
    days.push(new Date(year, month, index - startOffset + 1));
  }
  const count = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= count; day += 1) {
    days.push(new Date(year, month, day));
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1];
    days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return days;
}

export function DateRangePicker({
  label,
  value,
  startLabel = "开始日期",
  endLabel = "结束日期",
  disabled,
  applyLabel = "Apply",
  clearLabel = "Clear",
  onChange
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeValue>(value);
  const [viewDate, setViewDate] = useState(() => (value.start ? new Date(value.start) : new Date()));
  const anchor = viewDate;
  const days = useMemo(() => monthDays(anchor), [anchor]);
  const display = value.start || value.end ? `${value.start || "..."} - ${value.end || "..."}` : `${startLabel} - ${endLabel}`;
  const activeMonth = anchor.getMonth();

  function pick(date: Date) {
    const picked = toInputValue(date);
    if (!draft.start || (draft.start && draft.end)) {
      setDraft({ start: picked, end: undefined });
      return;
    }
    if (picked < draft.start) {
      setDraft({ start: picked, end: draft.start });
      return;
    }
    setDraft({ ...draft, end: picked });
  }

  return (
    <div className="df-date-range">
      {label ? <div className="df-field__label">{label}</div> : null}
      <button className="df-date-range__trigger" type="button" disabled={disabled} onClick={() => setOpen((current) => !current)}>
        {display}
      </button>
      {open ? (
        <div className="df-date-range__panel">
          <div className="df-date-range__header">
            <button type="button" onClick={() => setViewDate(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>
              ‹
            </button>
            <strong>
              {anchor.getFullYear()}-{String(anchor.getMonth() + 1).padStart(2, "0")}
            </strong>
            <button type="button" onClick={() => setViewDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>
              ›
            </button>
          </div>
          <div className="df-date-range__weekdays">
            {["S", "M", "T", "W", "T", "F", "S"].map((item, index) => (
              <span key={`${item}-${index}`}>{item}</span>
            ))}
          </div>
          <div className="df-date-range__grid">
            {days.map((day) => {
              const text = toInputValue(day);
              const selected = text === draft.start || text === draft.end;
              const inRange = draft.start && draft.end && text > draft.start && text < draft.end;
              return (
                <button
                  key={text}
                  className={[
                    day.getMonth() !== activeMonth ? "is-outside" : "",
                    selected ? "is-selected" : "",
                    inRange ? "is-in-range" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  type="button"
                  onClick={() => pick(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <div className="df-date-range__actions">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDraft({});
                onChange({});
                setOpen(false);
              }}
            >
              {clearLabel}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              {applyLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
