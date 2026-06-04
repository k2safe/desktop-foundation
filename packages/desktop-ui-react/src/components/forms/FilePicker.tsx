import { useRef, type ChangeEvent, type ReactNode } from "react";
import { useLocale } from "../../locale";
import { Button } from "../primitives/Button";

export interface FilePickerProps {
  label?: ReactNode;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  emptyLabel?: string;
  files?: File[];
  onFilesChange?: (files: File[]) => void;
}

export function FilePicker({
  label,
  accept,
  multiple,
  disabled,
  buttonLabel,
  emptyLabel,
  files = [],
  onFilesChange
}: FilePickerProps) {
  const { t } = useLocale();
  const resolvedButtonLabel = buttonLabel ?? t("filePicker.choose");
  const resolvedEmptyLabel = emptyLabel ?? t("filePicker.empty");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesChange?.(Array.from(event.target.files || []));
  }

  return (
    <div className="df-file-picker">
      {label ? <div className="df-field__label">{label}</div> : null}
      <div className="df-file-picker__control">
        <Button variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
          {resolvedButtonLabel}
        </Button>
        <span className="df-file-picker__summary">
          {files.length ? files.map((file) => file.name).join(", ") : resolvedEmptyLabel}
        </span>
      </div>
      <input ref={inputRef} className="df-file-picker__input" type="file" accept={accept} multiple={multiple} disabled={disabled} onChange={handleChange} />
    </div>
  );
}
