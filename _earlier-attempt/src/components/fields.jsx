import { useId } from 'react';
import { CircleAlert } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

/** Turns a validation error { code, params } from the ledger into a translated message. */
export function useErrorText() {
  const { t } = useI18n();
  return (error) => (error ? t(error.code, error.params) : '');
}

export function Field({ label, error, hint, required, children }) {
  const id = useId();
  const { t } = useI18n();
  const errorText = useErrorText()(error);
  const describedBy = [errorText ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`field ${errorText ? 'has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="req" title={t('common.required')} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': errorText ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {errorText && (
        <p className="error-text" id={`${id}-err`} role="alert">
          <CircleAlert size={14} aria-hidden="true" /> {errorText}
        </p>
      )}
    </div>
  );
}

export function TextField({ label, value, onChange, error, hint, required, type = 'text', inputMode, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(aria) => <input {...aria} {...rest} type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

/** Text input that shows a numeric keypad on phones and accepts Persian digits. */
export function NumberField(props) {
  return <TextField {...props} inputMode="decimal" autoComplete="off" />;
}

export function SelectField({ label, value, onChange, error, hint, required, children, ...rest }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(aria) => (
        <select {...aria} {...rest} value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
      )}
    </Field>
  );
}
