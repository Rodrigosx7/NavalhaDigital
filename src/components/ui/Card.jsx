import './Card.css'

export default function Card({ elevated = true, padding = 'lg', className = '', children, ornament = false, ...rest }) {
  const classes = [
    'card',
    elevated ? 'card--elevated' : '',
    `card--pad-${padding}`,
    ornament ? 'card--ornament' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
