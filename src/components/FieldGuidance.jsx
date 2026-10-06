import { fieldGuidance } from '../utils/incidentGuidance'

export default function FieldGuidance({ name, id, label }) {
  const guidance = fieldGuidance[name]
  if (!guidance) return null

  return <div className="form-text">
    <div id={`${id}-help`}>{guidance.text}</div>
    {guidance.example && <details className="mt-1">
      <summary>Example<span className="visually-hidden"> for {label}</span></summary>
      <div className="mt-1">{guidance.example}</div>
    </details>}
  </div>
}
