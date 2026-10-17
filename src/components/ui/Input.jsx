import './Input.css'

export default function Input({
  label,
  error,
  helperText,
  id,
  type = 'text',
  className = '',
  inputClassName = '',
  ...rest
}) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={inputId} className="field__label">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        className={`field__input ${error ? 'field__input--error' : ''} ${inputClassName}`}
        {...rest}
      />
      {(error || helperText) && (
        <span className={`field__hint ${error ? 'field__hint--error' : ''}`}>
          {error || helperText}
        </span>
      )}
    </div>
  )
}
