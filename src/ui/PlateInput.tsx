import type { ComponentProps } from "react";
import { cx } from "./cx";
import { controlAria, FieldShell, useFieldIds, type FieldProps } from "./Field";
import { formatRegistrationInput, parseRegistration, type ParsedRegistration } from "./plate";

type FixedByField = "value" | "onChange" | "defaultValue" | "maxLength" | "inputMode" | "autoCapitalize"
  | "autoComplete" | "autoCorrect" | "spellCheck";

export type PlateInputProps = Partial<Pick<FieldProps, "label">> & Omit<FieldProps, "label"> &
  Omit<ComponentProps<"input">, FixedByField> & {
    /** The text in the field. It can hold lower case mid-edit; store parsed.normalized, not this. */
    value: string;
    /** Called with the text to show and what it parses to. */
    onChange: (value: string, parsed: ParsedRegistration) => void;
  };

/** Registration-number field styled after an Indian number plate. */
export function PlateInput({
  value, onChange, label = "Registration number", hint, error, hideLabel, id, className, onBlur, ...input
}: PlateInputProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell label={label} hint={hint} error={error} hideLabel={hideLabel} ids={ids}>
      <div className={cx("ui-plate", className)}>
        <span className="ui-plate__tag" aria-hidden="true">IND</span>
        <input {...input} id={ids.id} className="ui-plate__input" value={value}
          placeholder={input.placeholder ?? "MH 12 AB 1234"}
          inputMode="text" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
          {...controlAria(ids, hint, error, input)}
          onChange={(event) => {
            const field = event.target;
            // Regroup only while typing at the end. Rewriting the text during an edit in the middle
            // (or an IME composition) would throw the caret to the end; CSS shows capitals meanwhile.
            const composing = (event.nativeEvent as InputEvent).isComposing === true;
            const typingAtEnd = field.selectionStart === null || field.selectionStart === field.value.length;
            const next = typingAtEnd && !composing ? formatRegistrationInput(field.value) : field.value;
            onChange(next, parseRegistration(next));
          }}
          onBlur={(event) => {
            const tidy = formatRegistrationInput(event.target.value);
            if (tidy !== event.target.value) onChange(tidy, parseRegistration(tidy));
            onBlur?.(event);
          }} />
      </div>
    </FieldShell>
  );
}
