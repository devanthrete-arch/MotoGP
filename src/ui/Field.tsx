import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type FieldProps = {
  /** Always required. Use hideLabel when the layout has no room for it; it is still announced. */
  label: string;
  hint?: string;
  /** Shown instead of the hint and marks the control invalid. */
  error?: string;
  hideLabel?: boolean;
};

export function useFieldIds(id?: string) {
  const generated = useId();
  const base = id ?? generated;
  return { id: base, hintId: `${base}-hint`, errorId: `${base}-error` };
}

type Ids = ReturnType<typeof useFieldIds>;
type Described = { "aria-describedby"?: string; "aria-invalid"?: ComponentProps<"input">["aria-invalid"] };

/** ARIA wiring for a control: the field's own hint or error is added to whatever the caller passed. */
export const controlAria = (ids: Ids, hint: string | undefined, error: string | undefined, caller: Described) => ({
  "aria-describedby": cx(caller["aria-describedby"], error ? ids.errorId : hint ? ids.hintId : undefined) || undefined,
  "aria-invalid": error ? true : caller["aria-invalid"],
});

export function FieldShell({ label, hint, error, hideLabel, ids, children }: FieldProps & { ids: Ids; children: ReactNode }) {
  return (
    <div className={cx("ui-field", error && "ui-field--invalid")}>
      <label className={cx("ui-field__label", hideLabel && "ui-visually-hidden")} htmlFor={ids.id}>{label}</label>
      {children}
      {error ? <p className="ui-field__error" id={ids.errorId}>{error}</p>
        : hint ? <p className="ui-field__hint" id={ids.hintId}>{hint}</p> : null}
    </div>
  );
}

export type TextFieldProps = FieldProps & ComponentProps<"input">;

export function TextField({ label, hint, error, hideLabel, id, className, ...input }: TextFieldProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} ids={ids}>
      <input {...input} id={ids.id} className={cx("ui-field__control", className)} {...controlAria(ids, hint, error, input)} />
    </FieldShell>
  );
}

export type TextAreaFieldProps = FieldProps & ComponentProps<"textarea">;

export function TextAreaField({ label, hint, error, hideLabel, id, className, rows = 4, ...textarea }: TextAreaFieldProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} ids={ids}>
      <textarea {...textarea} rows={rows} id={ids.id} className={cx("ui-field__control", className)}
        {...controlAria(ids, hint, error, textarea)} />
    </FieldShell>
  );
}

export type SelectOption = string | { value: string; label: string };
export type SelectFieldProps = FieldProps & Omit<ComponentProps<"select">, "children"> & {
  options: readonly SelectOption[];
  /** An unselectable first entry such as "Choose a brand". Shown until something is picked. */
  placeholder?: string;
};

export function SelectField({ label, hint, error, hideLabel, id, className, options, placeholder, ...select }: SelectFieldProps) {
  const ids = useFieldIds(id);
  // A browser never preselects a disabled option, so without this the first real option would
  // show (and submit) as if it had been chosen.
  const startEmpty = placeholder !== undefined && select.value === undefined && select.defaultValue === undefined;
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} ids={ids}>
      <select {...select} {...(startEmpty ? { defaultValue: "" } : {})} id={ids.id}
        className={cx("ui-field__control", className)} {...controlAria(ids, hint, error, select)}>
        {placeholder !== undefined ? <option value="" disabled>{placeholder}</option> : null}
        {options.map((option) => {
          const { value, label: text } = typeof option === "string" ? { value: option, label: option } : option;
          return <option key={value} value={value}>{text}</option>;
        })}
      </select>
    </FieldShell>
  );
}
